/**
 * Tujuan: Handler per-intent untuk POST /api/record — transaksi, bulk, pemasukan, budget, laporan
 * Caller: app/api/record/route.ts
 * Dependensi: prisma, utils/sheets, utils/db-transactions, utils/groq, utils/record/account-resolver
 * Main Functions: handleTransaksi, handleTransaksiBulk, handlePemasukan, handleBudgetSetting, handleLaporan
 * Side Effects: DB write, Sheets write, Groq API call
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  appendTransaction,
  appendBudgetBackup,
  getTransactions,
} from "@/utils/sheets";
import { appendTransactionDB, getTransactionsDB } from "@/utils/db-transactions";
import { callWithRotation } from "@/utils/groq";
import { buildAccountResolver, type RuntimeAccount } from "./account-resolver";
import { correctAmount, isValidAmount } from "./amount-parser";

export interface RecordContext {
  userId: string;
  useSheets: boolean;
  sheetsId?: string;
  accessToken: string;
  userAccounts: RuntimeAccount[];
  prompt: string;
  today: string;
  currentMonth: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedIntent = Record<string, any>;

export async function handleTransaksi(parsed: ParsedIntent, ctx: RecordContext): Promise<NextResponse> {
  const { userId, useSheets, sheetsId, accessToken, userAccounts, prompt } = ctx;
  const raw = parsed;
  parsed.amount = parsed.amount ?? Number(raw.nominal ?? raw.harga ?? 0);
  parsed.category = parsed.category ?? raw.kategori ?? raw.type;
  if (parsed.amount) parsed.amount = correctAmount(prompt, parsed.amount);

  if (!parsed.amount || !parsed.category || !isValidAmount(parsed.amount)) {
    return NextResponse.json({ intent: "unknown", clarification: "Nominal atau kategori tidak terdeteksi. Coba tulis ulang, contoh: 'Makan siang 35rb'" });
  }

  const { resolveAccount, validateAccount } = buildAccountResolver({ userId, prompt, useSheets, sheetsId, accessToken, userAccounts });
  const accountResolution = await resolveAccount(parsed.accountName, "expense");
  if ("clarification" in accountResolution) return NextResponse.json({ intent: "unknown", clarification: accountResolution.clarification });
  const { accountId } = accountResolution;

  const accountError = await validateAccount(accountId);
  if (accountError) return NextResponse.json({ error: accountError.error }, { status: accountError.status });

  const account = userAccounts.find((a) => a.id === accountId);
  const accountName = account?.name ?? "";
  const base = { date: parsed.date ?? ctx.today, amount: parsed.amount, category: parsed.category, note: parsed.note ?? "", type: "expense" as const };

  try {
    const transaction = useSheets
      ? await appendTransaction(sheetsId!, accessToken, { ...base, fromAccountId: accountId, fromAccountName: accountName })
      : await appendTransactionDB(userId, { ...base, accountId });

    // Sheets: saldo dihitung pure-ledger via getAccountsWithBalance (no cache write).

    await prisma.category.upsert({
      where: { userId_name: { userId, name: parsed.category } },
      update: {},
      create: { userId, name: parsed.category },
    });

    return NextResponse.json({
      intent: "transaksi",
      transaction,
      message: `✓ Dicatat: ${parsed.category} — Rp ${parsed.amount.toLocaleString("id-ID")}`,
      details: {
        date: base.date,
        category: parsed.category,
        amount: parsed.amount,
        accountName,
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan transaksi. Coba lagi." }, { status: 500 });
  }
}

export async function handleTransaksiBulk(parsed: ParsedIntent, ctx: RecordContext): Promise<NextResponse> {
  const { userId, useSheets, sheetsId, accessToken, userAccounts, prompt } = ctx;
  const items = parsed.items ?? [];

  if (!items || items.length === 0) {
    return NextResponse.json({ intent: "unknown", clarification: "Tidak bisa mendeteksi item. Coba format: 'Belanja: ayam 30rb, sayur 15rb, telur 25rb'" });
  }

  const { resolveAccount, validateAccount } = buildAccountResolver({ userId, prompt, useSheets, sheetsId, accessToken, userAccounts });
  const accountResolution = await resolveAccount(parsed.accountName, "expense");
  if ("clarification" in accountResolution) return NextResponse.json({ intent: "unknown", clarification: accountResolution.clarification });
  const { accountId } = accountResolution;

  const accountError = await validateAccount(accountId);
  if (accountError) return NextResponse.json({ error: accountError.error }, { status: accountError.status });

  const account = userAccounts.find((a) => a.id === accountId);
  const accountName = account?.name ?? "";

  try {
    const transactions = [];
    for (const item of items) {
      if (!item.amount || !item.category) continue;
      const base = { date: parsed.date ?? ctx.today, amount: item.amount, category: item.category, note: item.note ?? "", type: "expense" as const };
      const transaction = useSheets
        ? await appendTransaction(sheetsId!, accessToken, { ...base, fromAccountId: accountId, fromAccountName: accountName })
        : await appendTransactionDB(userId, { ...base, accountId });

      await prisma.category.upsert({
        where: { userId_name: { userId, name: item.category } },
        update: {},
        create: { userId, name: item.category },
      });
      transactions.push(transaction);
    }

    if (transactions.length === 0) {
      return NextResponse.json({ intent: "unknown", clarification: "Tidak ada item valid yang bisa dicatat. Pastikan setiap item memiliki nominal." });
    }

    const total = transactions.reduce((s, t) => s + t.amount, 0);
    // Sheets: saldo dihitung pure-ledger (no cache write).

    return NextResponse.json({
      intent: "transaksi_bulk",
      transactions,
      message: `✓ ${transactions.length} transaksi dicatat (total Rp ${total.toLocaleString("id-ID")})`,
      details: {
        date: parsed.date ?? ctx.today,
        accountName,
        total,
        count: transactions.length,
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan transaksi. Coba lagi." }, { status: 500 });
  }
}

export async function handlePemasukan(parsed: ParsedIntent, ctx: RecordContext): Promise<NextResponse> {
  const { userId, useSheets, sheetsId, accessToken, userAccounts, prompt } = ctx;
  const raw = parsed;
  let incomeAmount = parsed.incomeAmount ?? Number(raw.amount ?? raw.nominal ?? 0);
  const incomeCategory = parsed.incomeCategory ?? raw.category ?? "Pemasukan";
  if (incomeAmount) incomeAmount = correctAmount(prompt, incomeAmount);

  if (!incomeAmount || !isValidAmount(incomeAmount)) {
    return NextResponse.json({ intent: "unknown", clarification: "Nominal pemasukan tidak terdeteksi. Contoh: 'Gajian 8jt' atau 'Dapat freelance 2.5jt'" });
  }

  const { resolveAccount, validateAccount } = buildAccountResolver({ userId, prompt, useSheets, sheetsId, accessToken, userAccounts });
  const accountResolution = await resolveAccount(parsed.accountName, "income");
  if ("clarification" in accountResolution) return NextResponse.json({ intent: "unknown", clarification: accountResolution.clarification });
  const { accountId } = accountResolution;

  const accountError = await validateAccount(accountId);
  if (accountError) return NextResponse.json({ error: accountError.error }, { status: accountError.status });

  const account = userAccounts.find((a) => a.id === accountId);
  const accountName = account?.name ?? "";
  const base = { date: parsed.date ?? ctx.today, amount: incomeAmount, category: incomeCategory, note: parsed.note ?? "", type: "income" as const };

  try {
    const transaction = useSheets
      ? await appendTransaction(sheetsId!, accessToken, { ...base, toAccountId: accountId, toAccountName: accountName })
      : await appendTransactionDB(userId, { ...base, accountId });

    // Sheets: saldo dihitung pure-ledger (no cache write).

    await prisma.category.upsert({
      where: { userId_name: { userId, name: incomeCategory } },
      update: {},
      create: { userId, name: incomeCategory },
    });

    return NextResponse.json({
      intent: "pemasukan",
      transaction,
      amount: incomeAmount,
      category: incomeCategory,
      message: `✓ Pemasukan dicatat: ${incomeCategory} +Rp ${incomeAmount.toLocaleString("id-ID")}`,
      details: {
        date: base.date,
        category: incomeCategory,
        amount: incomeAmount,
        accountName,
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan pemasukan. Coba lagi." }, { status: 500 });
  }
}

export async function handleBudgetSetting(parsed: ParsedIntent, ctx: RecordContext): Promise<NextResponse> {
  const { userId, useSheets, sheetsId, accessToken, currentMonth } = ctx;
  const raw = parsed;
  const budgetCategory = parsed.budgetCategory ?? raw.budget_category ?? raw.category ?? raw.kategori ?? raw.budgetKategori;
  const budgetAmount = Number(parsed.budgetAmount ?? raw.budget_amount ?? raw.amount ?? raw.nominal ?? raw.budgetNominal);

  if (!budgetCategory || !budgetAmount) {
    return NextResponse.json({ intent: "unknown", clarification: "Kategori atau nominal budget tidak terdeteksi. Contoh: 'Budget makan 500rb'" });
  }

  try {
    const category = await prisma.category.upsert({
      where: { userId_name: { userId, name: budgetCategory } },
      update: {},
      create: { userId, name: budgetCategory },
    });

    await prisma.budget.upsert({
      where: { userId_categoryId_month: { userId, categoryId: category.id, month: currentMonth } },
      update: { amount: budgetAmount },
      create: { userId, categoryId: category.id, amount: budgetAmount, month: currentMonth },
    });

    if (useSheets) {
      await appendBudgetBackup(sheetsId!, accessToken, budgetCategory, budgetAmount, currentMonth).catch(() => {});
    }

    return NextResponse.json({
      intent: "budget_setting",
      category: budgetCategory,
      amount: budgetAmount,
      month: currentMonth,
      message: `✓ Budget ${budgetCategory} bulan ini: Rp ${budgetAmount.toLocaleString("id-ID")}`,
      details: {
        category: budgetCategory,
        amount: budgetAmount,
        month: currentMonth,
      },
    });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan budget. Coba lagi." }, { status: 500 });
  }
}

export async function handleLaporan(parsed: ParsedIntent, ctx: RecordContext): Promise<NextResponse> {
  const { userId, useSheets, sheetsId, accessToken, currentMonth } = ctx;
  const period = parsed.period ?? "bulan ini";

  try {
    const transactions = useSheets
      ? await getTransactions(sheetsId!, accessToken, period)
      : await getTransactionsDB(userId, period);

    const budgets = await prisma.budget.findMany({
      where: { userId, month: currentMonth },
      include: { category: true },
    });

    const spentByCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== "income") spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
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
      budgets: budgets.map((b) => ({ category: b.category.name, budget: b.amount, spent: spentByCategory[b.category.name] ?? 0 })),
      summary: summaryRes.choices[0]?.message?.content ?? "",
      transactionCount: transactions.length,
    });
  } catch {
    return NextResponse.json({ error: "Gagal memuat data. Coba refresh halaman." }, { status: 500 });
  }
}
