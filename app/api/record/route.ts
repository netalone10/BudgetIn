import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyIntent, callWithRotation } from "@/utils/groq";
import { getValidToken } from "@/utils/token";
import {
  appendTransaction,
  getTransactions,
  appendBudgetBackup,
  updateAccountBalance,
  appendAccount,
  getAccounts,
  ensureAccountHeader,
} from "@/utils/sheets";
import { appendTransactionDB, getTransactionsDB } from "@/utils/db-transactions";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

type RuntimeAccount = {
  id: string;
  name: string;
  classification: "asset" | "liability";
};

// ── Nominal parser — cross-check AI amount vs raw prompt ──────────────────────

function parseNominalFromPrompt(text: string): number | null {
  const s = text.toLowerCase();
  const m1 = s.match(/(\d+)[.,](\d+)\s*jt/);
  if (m1) {
    const decimal = parseInt(m1[2]) / Math.pow(10, m1[2].length);
    return (parseInt(m1[1]) + decimal) * 1_000_000;
  }
  const m2 = s.match(/(\d+)\s*(?:jt|juta)/);
  if (m2) return parseInt(m2[1]) * 1_000_000;
  const m3 = s.match(/(\d+)\s*(?:rb|ribu)/);
  if (m3) return parseInt(m3[1]) * 1_000;
  const m4 = s.match(/(\d+)\s*k\b/);
  if (m4) return parseInt(m4[1]) * 1_000;
  return null;
}

// Pola satuan NON-uang yang tidak boleh lolos tanpa nominal IDR
const NON_MONETARY_UNITS = /\b(?:kg|gram|gr|ons|ton|lot|unit|pcs|pack|lembar|batang|buah|meter|cm|mm|ml|liter|ltr|dus|karton|ekor|biji|potong|ikat|helai|lusin|kodi|tangkai|porsi|botol|kaleng|sachet|kantong|bungkus|kotak|toples)\b/i;
// Nominal IDR: rb/ribu/jt/juta/k, Rp prefix, atau angka 4+ digit
const MONETARY_INDICATOR = /\d+\s*(?:rb|ribu|jt|juta|[ck]\b)|(?:rp\.?\s*|idr\s*)\d|\b\d{4,}\b/i;
// Intent yang tidak butuh nominal (laporan)
const REPORT_KEYWORDS = /\b(?:rekap|laporan|lihat|berapa|analisis|summary|ringkasan|pengeluaran|pemasukan bulan)\b/i;

function correctAmount(prompt: string, aiAmount: number): number {
  const expected = parseNominalFromPrompt(prompt);
  if (!expected || aiAmount === expected) return aiAmount;
  const ratio = aiAmount / expected;
  if (Math.round(ratio) === 1000) return expected;
  if (Math.abs(ratio - 0.001) < 0.0001) return expected;
  return aiAmount;
}

function isValidAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000;
}

// ── GET — load riwayat transaksi ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "bulan ini";
  const customFrom = searchParams.get("from");
  const customTo = searchParams.get("to");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // Resolve period — custom range override
  const resolvedPeriod = (period === "custom" && customFrom && customTo)
    ? `custom:${customFrom}:${customTo}`
    : period;

  // ── Email user: baca dari DB ──────────────────────────────────────────────
  if (!user?.sheetsId) {
    try {
      const transactions = await getTransactionsDB(session.userId, resolvedPeriod);
      return NextResponse.json({ transactions: transactions.slice(0, 200) });
    } catch {
      return NextResponse.json({ transactions: [] });
    }
  }

  // ── Google user: baca dari Sheets ─────────────────────────────────────────
  try {
    const accessToken = await getValidToken(session.userId);
    const transactions = await getTransactions(user.sheetsId, accessToken, resolvedPeriod);
    transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
    return NextResponse.json({ transactions: transactions.slice(0, 200) });
  } catch {
    return NextResponse.json({ transactions: [] });
  }
}

// ── POST — klasifikasi intent + simpan ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.userId;

  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt kosong" }, { status: 400 });
  }

  // Ambil user data + kategori
  const [user, userCategories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { sheetsId: true },
    }),
    prisma.category.findMany({
      where: { userId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const useSheets = !!user?.sheetsId;
  let userAccounts: RuntimeAccount[] = [];
  const categoryNames = userCategories.map((c) => c.name);

  // Token hanya diperlukan untuk Google/Sheets users
  let accessToken = "";
  if (useSheets) {
    try {
      accessToken = await getValidToken(userId);
      await ensureAccountHeader(user!.sheetsId!, accessToken).catch(() => {});
    } catch {
      return NextResponse.json(
        { error: "Sesi expired. Silakan login ulang." },
        { status: 401 }
      );
    }

    const sheetsAccounts = await getAccounts(user!.sheetsId!, accessToken);
    userAccounts = sheetsAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      classification: account.classification === "liability" ? "liability" : "asset",
    }));
  } else {
    await ensureDefaultAccountTypes(userId);
    const dbAccounts = await prisma.account.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, accountType: { select: { classification: true } } },
      orderBy: { name: "asc" },
    });
    userAccounts = dbAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      classification: account.accountType.classification === "liability" ? "liability" : "asset",
    }));
  }

  const accountNames = userAccounts.map((a) => a.name);

  // Pre-check: satuan non-uang tanpa nominal IDR → tolak sebelum hit Groq
  if (
    !REPORT_KEYWORDS.test(prompt) &&
    NON_MONETARY_UNITS.test(prompt) &&
    !MONETARY_INDICATOR.test(prompt)
  ) {
    return NextResponse.json({
      intent: "unknown",
      clarification:
        "Input harus mengandung nominal uang (contoh: 35rb, 2jt). " +
        "Untuk aset non-uang, tulis nilainya dalam IDR — misal: 'jual saham BBCA dapat 5jt' atau 'dapat emas senilai 3jt'.",
    });
  }

  // Classify intent via Groq
  let parsed;
  try {
    parsed = await classifyIntent(prompt, categoryNames, accountNames);
  } catch {
    return NextResponse.json(
      { error: "AI sedang tidak tersedia. Coba lagi." },
      { status: 503 }
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[record] parsed:", JSON.stringify(parsed, null, 2));
  }

  const today = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM-dd");
  const currentMonth = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");

  // Helper: match account name dari AI ke account ID
  // Returns accountId jika tepat satu match, null jika tidak ada atau lebih dari satu match
  function matchAccount(accountName?: string): { id: string } | { ambiguous: true; matches: string[] } | null {
    if (!accountName) return null;
    const normalized = accountName.toLowerCase().trim();
    const matches = userAccounts.filter((a) =>
      a.name.toLowerCase().includes(normalized) ||
      normalized.includes(a.name.toLowerCase())
    );
    if (matches.length === 1) return { id: matches[0].id };
    if (matches.length > 1) return { ambiguous: true, matches: matches.map((a) => a.name) };
    return null;
  }

  function getAccountCandidates(accountName?: string): RuntimeAccount[] {
    if (!accountName) return [];

    const normalized = accountName.toLowerCase().trim();
    const combined = `${prompt.toLowerCase()} ${normalized}`;
    const rawTokens = combined.split(/[^a-z0-9]+/).filter(Boolean);
    const ignoredTokens = new Set([
      "pakai",
      "dari",
      "ke",
      "rekening",
      "rek",
      "bank",
      "kartu",
      "kredit",
      "credit",
      "card",
      "cc",
      "transfer",
      "bayar",
      "pake",
      "via",
    ]);
    const tokens = Array.from(new Set(rawTokens.filter((token) => token.length >= 3 && !ignoredTokens.has(token))));
    const prefersLiability = /(kartu kredit|credit card|\bcc\b|paylater|hutang|utang|cicilan)/.test(combined);

    return userAccounts.filter((account) => {
      if (prefersLiability && account.classification !== "liability") return false;
      const name = account.name.toLowerCase();
      return tokens.some((token) => name.includes(token));
    });
  }

  function inferAccountSpec(accountName: string) {
    const lowerName = accountName.toLowerCase();
    const lowerPrompt = prompt.toLowerCase();
    const combined = `${lowerPrompt} ${lowerName}`;

    if (/(kartu kredit|credit card|\bcc\b)/.test(combined)) {
      return { classification: "liability" as const, typeName: "Kartu Kredit" };
    }
    if (/(paylater|hutang|utang|cicilan|pinjaman|loan)/.test(combined)) {
      return { classification: "liability" as const, typeName: "Hutang" };
    }
    if (/(cash|tunai|kas)/.test(combined)) {
      return { classification: "asset" as const, typeName: "Kas" };
    }
    if (/(ovo|gopay|dana|shopeepay|linkaja|e-wallet|ewallet|dompet)/.test(combined)) {
      return { classification: "asset" as const, typeName: "E-Wallet" };
    }
    if (/(bca|bni|bri|mandiri|cimb|permata|jago|seabank|bank)/.test(combined)) {
      return { classification: "asset" as const, typeName: "Bank" };
    }

    return { classification: "asset" as const, typeName: "Lainnya" };
  }

  async function createMissingAccount(accountName: string): Promise<RuntimeAccount> {
    const trimmedName = accountName.trim().slice(0, 50);
    const inferred = inferAccountSpec(trimmedName);

    if (useSheets) {
      const created = await appendAccount(user!.sheetsId!, accessToken, {
        name: trimmedName,
        type: inferred.typeName,
        classification: inferred.classification,
        balance: 0,
        currency: "IDR",
        color: null,
        note: "Auto-created from transaction input",
        tanggalSettlement: inferred.typeName === "Kartu Kredit" ? 17 : null,
        tanggalJatuhTempo: inferred.typeName === "Kartu Kredit" ? 5 : null,
      });

      const runtimeAccount: RuntimeAccount = {
        id: created.id,
        name: created.name,
        classification: inferred.classification,
      };
      userAccounts.push(runtimeAccount);
      return runtimeAccount;
    }

    await ensureDefaultAccountTypes(userId);
    const directType = await prisma.accountType.findFirst({
      where: {
        userId,
        isActive: true,
        name: inferred.typeName,
      },
      select: { id: true },
    });

    const fallbackType = directType ?? await prisma.accountType.findFirst({
      where: {
        userId,
        isActive: true,
        classification: inferred.classification,
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });

    const created = await prisma.account.create({
      data: {
        userId,
        accountTypeId: fallbackType!.id,
        name: trimmedName,
        initialBalance: 0,
        currency: "IDR",
        note: "Auto-created from transaction input",
        ...(inferred.typeName === "Kartu Kredit" && {
          tanggalSettlement: 17,
          tanggalJatuhTempo: 5,
        }),
      },
      select: { id: true, name: true },
    });

    const runtimeAccount: RuntimeAccount = {
      id: created.id,
      name: created.name,
      classification: inferred.classification,
    };
    userAccounts.push(runtimeAccount);
    return runtimeAccount;
  }

  // Helper: resolve matchAccount result ke accountId string, atau return clarification response
  async function resolveAccount(
    accountName: string | undefined,
    transactionType: "expense" | "income"
  ): Promise<{ accountId: string; accountCreated?: string } | { clarification: string }> {
    const result = matchAccount(accountName);
    if (result && "id" in result) return { accountId: result.id };
    if (result && "ambiguous" in result) {
      const accountList = result.matches.join(", ");
      const example = `${prompt} pakai ${result.matches[0]}`;
      return {
        clarification: `Akun mana yang dimaksud? Pilih salah satu: ${accountList}. Contoh: "${example}"`,
      };
    }
    const candidates = getAccountCandidates(accountName);
    if (candidates.length === 1) {
      return { accountId: candidates[0].id };
    }
    if (candidates.length > 1) {
      const accountList = candidates.map((account) => account.name).join(", ");
      const example = `${prompt} pakai ${candidates[0].name}`;
      return {
        clarification: `Akun mana yang dimaksud? Pilih salah satu: ${accountList}. Contoh: "${example}"`,
      };
    }
    if (accountName?.trim()) {
      const created = await createMissingAccount(accountName);
      return { accountId: created.id, accountCreated: created.name };
    }
    return { clarification: askAccountSelection(transactionType) };
  }

  // Helper: validate accountId ownership & status against source aktif
  async function validateAccount(accountId: string): Promise<{ error: string; status: number } | null> {
    if (useSheets) {
      const account = userAccounts.find((a) => a.id === accountId);
      if (!account) return { error: "Akun tidak ditemukan", status: 400 };
      return null;
    }

    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return { error: "Akun tidak ditemukan", status: 400 };
    if (account.userId !== session!.userId) return { error: "Akun tidak valid", status: 400 };
    if (!account.isActive) return { error: "Akun sudah dinonaktifkan", status: 400 };
    return null;
  }

  // Helper: generate account selection clarification
  function askAccountSelection(transactionType: "expense" | "income"): string {
    if (userAccounts.length === 0) {
      return "Belum ada akun. Buat akun dulu di menu Akun sebelum input transaksi.";
    }
    const label = transactionType === "income" ? "masuk ke akun mana" : "dari akun mana";
    const accountList = userAccounts.map((a) => a.name).join(", ");
    return `Transaksi ${label}? Pilih salah satu: ${accountList}. Contoh: "${prompt} pakai ${userAccounts[0].name}"`;
  }

  // ── TRANSAKSI ─────────────────────────────────────────────────────────────
  if (parsed.intent === "transaksi") {
    const raw = parsed as unknown as Record<string, unknown>;
    parsed.amount = parsed.amount ?? Number(raw.nominal ?? raw.harga ?? 0);
    parsed.category = parsed.category ?? (raw.kategori as string) ?? (raw.type as string);
    if (parsed.amount) parsed.amount = correctAmount(prompt, parsed.amount);

    if (!parsed.amount || !parsed.category || !isValidAmount(parsed.amount)) {
      return NextResponse.json({
        intent: "unknown",
        clarification: "Nominal atau kategori tidak terdeteksi. Coba tulis ulang, contoh: 'Makan siang 35rb'",
      });
    }

    // Match account dari AI extraction
    const accountResolution = await resolveAccount(parsed.accountName, "expense");
    if ("clarification" in accountResolution) {
      return NextResponse.json({ intent: "unknown", clarification: accountResolution.clarification });
    }
    const { accountId } = accountResolution;

    // Validasi ownership & status akun
    const accountError = await validateAccount(accountId);
    if (accountError) {
      return NextResponse.json({ error: accountError.error }, { status: accountError.status });
    }

    const account = userAccounts.find((a) => a.id === accountId);
    const accountName = account?.name ?? "";
    const base = {
      date: parsed.date ?? today,
      amount: parsed.amount,
      category: parsed.category,
      note: parsed.note ?? "",
      type: "expense" as const,
    };

    try {
      const transaction = useSheets
        ? await appendTransaction(user!.sheetsId!, accessToken, {
            ...base,
            fromAccountId: accountId,
            fromAccountName: accountName,
          })
        : await appendTransactionDB(session.userId, { ...base, accountId });

      if (useSheets) {
        const expenseDelta = account?.classification === "liability" ? parsed.amount : -parsed.amount;
        await updateAccountBalance(user!.sheetsId!, accessToken, accountId, expenseDelta).catch(() => {});
      }

      await prisma.category.upsert({
        where: { userId_name: { userId: session.userId, name: parsed.category } },
        update: {},
        create: { userId: session.userId, name: parsed.category },
      });

      return NextResponse.json({
        intent: "transaksi",
        transaction,
        message: `✓ Dicatat: ${parsed.category} — Rp ${parsed.amount.toLocaleString("id-ID")}`,
      });
    } catch {
      return NextResponse.json({ error: "Gagal menyimpan transaksi. Coba lagi." }, { status: 500 });
    }
  }

  // ── TRANSAKSI BULK ────────────────────────────────────────────────────────
  if (parsed.intent === "transaksi_bulk") {
    const raw = parsed as unknown as Record<string, unknown>;
    const items = parsed.items ?? (raw.items as typeof parsed.items) ?? [];
    const txDate = parsed.date ?? today;

    if (!items || items.length === 0) {
      return NextResponse.json({
        intent: "unknown",
        clarification: "Tidak bisa mendeteksi item. Coba format: 'Belanja: ayam 30rb, sayur 15rb, telur 25rb'",
      });
    }

    // Match account dari AI extraction
    const accountResolution = await resolveAccount(parsed.accountName, "expense");
    if ("clarification" in accountResolution) {
      return NextResponse.json({ intent: "unknown", clarification: accountResolution.clarification });
    }
    const { accountId } = accountResolution;

    // Validasi ownership & status akun sekali sebelum proses semua item
    const accountError = await validateAccount(accountId);
    if (accountError) {
      return NextResponse.json({ error: accountError.error }, { status: accountError.status });
    }

    const account = userAccounts.find((a) => a.id === accountId);
    const accountName = account?.name ?? "";

    try {
      const transactions = [];
      for (const item of items) {
        if (!item.amount || !item.category) continue;
        const base = {
          date: txDate,
          amount: item.amount,
          category: item.category,
          note: item.note ?? "",
          type: "expense" as const,
        };
        const transaction = useSheets
          ? await appendTransaction(user!.sheetsId!, accessToken, {
              ...base,
              fromAccountId: accountId,
              fromAccountName: accountName,
            })
          : await appendTransactionDB(session.userId, { ...base, accountId });

        await prisma.category.upsert({
          where: { userId_name: { userId: session.userId, name: item.category } },
          update: {},
          create: { userId: session.userId, name: item.category },
        });
        transactions.push(transaction);
      }

      if (transactions.length === 0) {
        return NextResponse.json({
          intent: "unknown",
          clarification: "Tidak ada item valid yang bisa dicatat. Pastikan setiap item memiliki nominal.",
        });
      }

      const total = transactions.reduce((s, t) => s + t.amount, 0);

      if (useSheets) {
        const bulkDelta = account?.classification === "liability" ? total : -total;
        await updateAccountBalance(user!.sheetsId!, accessToken, accountId, bulkDelta).catch(() => {});
      }

      return NextResponse.json({
        intent: "transaksi_bulk",
        transactions,
        message: `✓ ${transactions.length} transaksi dicatat (total Rp ${total.toLocaleString("id-ID")})`,
      });
    } catch {
      return NextResponse.json({ error: "Gagal menyimpan transaksi. Coba lagi." }, { status: 500 });
    }
  }

  // ── PEMASUKAN ─────────────────────────────────────────────────────────────
  if (parsed.intent === "pemasukan") {
    const raw = parsed as unknown as Record<string, unknown>;
    let incomeAmount = parsed.incomeAmount ?? Number(raw.amount ?? raw.nominal ?? 0);
    const incomeCategory = parsed.incomeCategory ?? (raw.category as string) ?? "Pemasukan";
    if (incomeAmount) incomeAmount = correctAmount(prompt, incomeAmount);

    if (!incomeAmount || !isValidAmount(incomeAmount)) {
      return NextResponse.json({
        intent: "unknown",
        clarification: "Nominal pemasukan tidak terdeteksi. Contoh: 'Gajian 8jt' atau 'Dapat freelance 2.5jt'",
      });
    }

    // Match account dari AI extraction
    const accountResolution = await resolveAccount(parsed.accountName, "income");
    if ("clarification" in accountResolution) {
      return NextResponse.json({ intent: "unknown", clarification: accountResolution.clarification });
    }
    const { accountId } = accountResolution;

    // Validasi ownership & status akun
    const accountError = await validateAccount(accountId);
    if (accountError) {
      return NextResponse.json({ error: accountError.error }, { status: accountError.status });
    }

    const account = userAccounts.find((a) => a.id === accountId);
    const accountName = account?.name ?? "";
    const base = {
      date: parsed.date ?? today,
      amount: incomeAmount,
      category: incomeCategory,
      note: parsed.note ?? "",
      type: "income" as const,
    };

    try {
      const transaction = useSheets
        ? await appendTransaction(user!.sheetsId!, accessToken, {
            ...base,
            toAccountId: accountId,
            toAccountName: accountName,
          })
        : await appendTransactionDB(session.userId, { ...base, accountId });

      if (useSheets) {
        const incomeDelta = account?.classification === "liability" ? -incomeAmount : incomeAmount;
        await updateAccountBalance(user!.sheetsId!, accessToken, accountId, incomeDelta).catch(() => {});
      }

      // Simpan kategori income ke DB supaya muncul di dropdown edit
      await prisma.category.upsert({
        where: { userId_name: { userId: session.userId, name: incomeCategory } },
        update: {},
        create: { userId: session.userId, name: incomeCategory },
      });

      return NextResponse.json({
        intent: "pemasukan",
        transaction,
        amount: incomeAmount,
        category: incomeCategory,
        message: `✓ Pemasukan dicatat: ${incomeCategory} +Rp ${incomeAmount.toLocaleString("id-ID")}`,
      });
    } catch {
      return NextResponse.json({ error: "Gagal menyimpan pemasukan. Coba lagi." }, { status: 500 });
    }
  }

  // ── BUDGET SETTING ────────────────────────────────────────────────────────
  if (parsed.intent === "budget_setting") {
    const raw = parsed as unknown as Record<string, unknown>;
    const budgetCategory =
      parsed.budgetCategory ?? raw.budget_category ?? raw.category ?? raw.kategori ?? raw.budgetKategori;
    const budgetAmount =
      parsed.budgetAmount ?? raw.budget_amount ?? raw.amount ?? raw.nominal ?? raw.budgetNominal;

    parsed.budgetCategory = budgetCategory as string;
    parsed.budgetAmount = Number(budgetAmount);

    if (!parsed.budgetCategory || !parsed.budgetAmount) {
      return NextResponse.json({
        intent: "unknown",
        clarification: "Kategori atau nominal budget tidak terdeteksi. Contoh: 'Budget makan 500rb'",
      });
    }

    try {
      const category = await prisma.category.upsert({
        where: { userId_name: { userId: session.userId, name: parsed.budgetCategory } },
        update: {},
        create: { userId: session.userId, name: parsed.budgetCategory },
      });

      await prisma.budget.upsert({
        where: { userId_categoryId_month: { userId: session.userId, categoryId: category.id, month: currentMonth } },
        update: { amount: parsed.budgetAmount },
        create: { userId: session.userId, categoryId: category.id, amount: parsed.budgetAmount, month: currentMonth },
      });

      // Backup ke Sheets hanya untuk Google users
      if (useSheets) {
        await appendBudgetBackup(user!.sheetsId!, accessToken, parsed.budgetCategory, parsed.budgetAmount, currentMonth).catch(() => {});
      }

      return NextResponse.json({
        intent: "budget_setting",
        category: parsed.budgetCategory,
        amount: parsed.budgetAmount,
        month: currentMonth,
        message: `✓ Budget ${parsed.budgetCategory} bulan ini: Rp ${parsed.budgetAmount.toLocaleString("id-ID")}`,
      });
    } catch {
      return NextResponse.json({ error: "Gagal menyimpan budget. Coba lagi." }, { status: 500 });
    }
  }

  // ── LAPORAN ───────────────────────────────────────────────────────────────
  if (parsed.intent === "laporan") {
    const period = parsed.period ?? "bulan ini";

    try {
      const transactions = useSheets
        ? await getTransactions(user!.sheetsId!, accessToken, period)
        : await getTransactionsDB(session.userId, period);

      const budgets = await prisma.budget.findMany({
        where: { userId: session.userId, month: currentMonth },
        include: { category: true },
      });

      const spentByCategory: Record<string, number> = {};
      for (const t of transactions) {
        if (t.type !== "income") {
          spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
        }
      }
      const totalSpent = Object.values(spentByCategory).reduce((s, v) => s + v, 0);

      const summaryPrompt = `Data pengeluaran user periode "${period}":
Total: Rp ${totalSpent.toLocaleString("id-ID")}
Per kategori: ${JSON.stringify(spentByCategory)}
Budget bulan ini: ${JSON.stringify(budgets.map((b) => ({ kategori: b.category.name, budget: b.amount, terpakai: spentByCategory[b.category.name] ?? 0 })))}

Buat ringkasan singkat (3-5 kalimat) dalam bahasa Indonesia yang informatif dan actionable. Sebutkan kategori terbesar, status budget, dan satu saran.`;

      const summaryRes = await callWithRotation((client) =>
        client.chat.completions.create({
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          messages: [{ role: "user", content: summaryPrompt }],
        })
      );

      return NextResponse.json({
        intent: "laporan",
        period,
        totalSpent,
        spentByCategory,
        budgets: budgets.map((b) => ({
          category: b.category.name,
          budget: b.amount,
          spent: spentByCategory[b.category.name] ?? 0,
        })),
        summary: summaryRes.choices[0]?.message?.content ?? "",
        transactionCount: transactions.length,
      });
    } catch {
      return NextResponse.json({ error: "Gagal memuat data. Coba refresh halaman." }, { status: 500 });
    }
  }

  // ── UNKNOWN ───────────────────────────────────────────────────────────────
  return NextResponse.json({
    intent: "unknown",
    clarification: parsed.clarification ?? "Maksudnya catat transaksi atau set budget?",
  });
}
