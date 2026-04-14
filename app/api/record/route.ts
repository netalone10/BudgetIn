import { NextRequest, NextResponse, NextResponse as NR } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyIntent, callWithRotation } from "@/utils/groq";
import { getValidToken } from "@/utils/token";
import { appendTransaction, getTransactions, appendBudgetBackup } from "@/utils/sheets";
import { appendTransactionDB, getTransactionsDB } from "@/utils/db-transactions";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

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

// ── GET — load riwayat transaksi ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NR.json({ error: "Unauthorized" }, { status: 401 });

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
      return NR.json({ transactions: transactions.slice(0, 200) });
    } catch {
      return NR.json({ transactions: [] });
    }
  }

  // ── Google user: baca dari Sheets ─────────────────────────────────────────
  try {
    const accessToken = await getValidToken(session.userId);
    const transactions = await getTransactions(user.sheetsId, accessToken, resolvedPeriod);
    transactions.sort((a, b) => (a.date < b.date ? 1 : -1));
    return NR.json({ transactions: transactions.slice(0, 200) });
  } catch {
    return NR.json({ transactions: [] });
  }
}

// ── POST — klasifikasi intent + simpan ───────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt } = await req.json();
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt kosong" }, { status: 400 });
  }

  // Ambil user data + kategori
  const [user, userCategories] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { sheetsId: true },
    }),
    prisma.category.findMany({
      where: { userId: session.userId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const useSheets = !!user?.sheetsId;
  const categoryNames = userCategories.map((c) => c.name);

  // Token hanya diperlukan untuk Google/Sheets users
  let accessToken = "";
  if (useSheets) {
    try {
      accessToken = await getValidToken(session.userId);
    } catch {
      return NextResponse.json(
        { error: "Sesi expired. Silakan login ulang." },
        { status: 401 }
      );
    }
  }

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
    parsed = await classifyIntent(prompt, categoryNames);
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

  // ── TRANSAKSI ─────────────────────────────────────────────────────────────
  if (parsed.intent === "transaksi") {
    const raw = parsed as unknown as Record<string, unknown>;
    parsed.amount = parsed.amount ?? Number(raw.nominal ?? raw.harga ?? 0);
    parsed.category = parsed.category ?? (raw.kategori as string) ?? (raw.type as string);
    if (parsed.amount) parsed.amount = correctAmount(prompt, parsed.amount);

    if (!parsed.amount || !parsed.category) {
      return NextResponse.json({
        intent: "unknown",
        clarification: "Nominal atau kategori tidak terdeteksi. Coba tulis ulang, contoh: 'Makan siang 35rb'",
      });
    }

    const txData = {
      date: parsed.date ?? today,
      amount: parsed.amount,
      category: parsed.category,
      note: parsed.note ?? "",
      type: "expense" as const,
    };

    try {
      const transaction = useSheets
        ? await appendTransaction(user!.sheetsId!, accessToken, txData)
        : await appendTransactionDB(session.userId, txData);

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

    try {
      const transactions = [];
      for (const item of items) {
        if (!item.amount || !item.category) continue;
        const txData = {
          date: txDate,
          amount: item.amount,
          category: item.category,
          note: item.note ?? "",
          type: "expense" as const,
        };
        const transaction = useSheets
          ? await appendTransaction(user!.sheetsId!, accessToken, txData)
          : await appendTransactionDB(session.userId, txData);

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

    if (!incomeAmount) {
      return NextResponse.json({
        intent: "unknown",
        clarification: "Nominal pemasukan tidak terdeteksi. Contoh: 'Gajian 8jt' atau 'Dapat freelance 2.5jt'",
      });
    }

    const txData = {
      date: parsed.date ?? today,
      amount: incomeAmount,
      category: incomeCategory,
      note: parsed.note ?? "",
      type: "income" as const,
    };

    try {
      const transaction = useSheets
        ? await appendTransaction(user!.sheetsId!, accessToken, txData)
        : await appendTransactionDB(session.userId, txData);

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
