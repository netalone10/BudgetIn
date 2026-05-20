/**
 * Tujuan: Handler per-intent untuk POST /api/record — transaksi, bulk, pemasukan, budget, laporan
 * Caller: app/api/record/route.ts
 * Dependensi: prisma, utils/sheets, utils/db-transactions, utils/groq, utils/record/account-resolver
 * Main Functions: handleTransaksi, handleTransaksiBulk, handlePemasukan, handleBudgetSetting, handleLaporan
 * Side Effects: DB write, Sheets write, Groq API call
 */

import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import {
  appendTransaction,
  appendBudgetBackup,
  getTransactions,
} from "@/utils/sheets";
import { appendTransactionDB, getTransactionsDB } from "@/utils/db-transactions";
import { callWithRotation } from "@/utils/groq";
import { buildAccountResolver, type RuntimeAccount } from "./account-resolver";
import { correctAmount, isValidAmount } from "./amount-parser";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { isSavingsPrompt, resolveSavingsGoalForPrompt } from "./savings-goal-resolver";
import { resolvePromptTransactionTime } from "@/lib/transaction-time";
import { sanitizeTransactionNote } from "./note-sanitizer";

const TRANSFER_FEE_CATEGORY = "Biaya Admin";

/**
 * Wraps `after()` with a try-catch fallback for non-Next.js environments.
 * Requirement 3.10: WHEN `after()` tidak tersedia di environment (non-Next.js runtime)
 * THEN sistem SHALL CONTINUE TO berfungsi dengan fallback ke synchronous Sheets append.
 */
function scheduleAfterRequest(fn: () => Promise<void>): void {
  try {
    after(fn);
  } catch {
    // Fallback: run synchronously if after() is not available
    fn().catch((err) => console.error("[scheduleAfterRequest] fallback error:", err));
  }
}

export interface RecordContext {
  userId: string;
  useSheets: boolean;
  sheetsId?: string;
  accessToken: string;
  userAccounts: RuntimeAccount[];
  prompt: string;
  today: string;
  currentTime: string;
  currentMonth: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParsedIntent = Record<string, any>;

function formatSignedIDR(amount: number, positivePrefix = ""): string {
  const sign = amount < 0 ? "-" : positivePrefix;
  return `${sign}Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
}

function isValidTransferAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000;
}

function resolveTransactionTime(parsed: ParsedIntent, ctx: RecordContext): string {
  return resolvePromptTransactionTime(ctx.prompt, parsed.time, ctx.currentTime);
}

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
  const { accountId, accountCreated } = accountResolution;

  const accountError = await validateAccount(accountId);
  if (accountError) return NextResponse.json({ error: accountError.error }, { status: accountError.status });

  const account = userAccounts.find((a) => a.id === accountId);
  const accountName = account?.name ?? "";
  const date = parsed.date ?? ctx.today;
  const time = resolveTransactionTime(parsed, ctx);
  const note = sanitizeTransactionNote(parsed.note);
  // Only check the raw prompt — not the AI-assigned category — to avoid false
  // positives when an account name contains "tabungan" (e.g. "BCA Tabungan").
  const goals = isSavingsPrompt(prompt)
    ? (await prisma.savingsGoal.findMany({
        where: { userId },
        select: { id: true, name: true, targetAmount: true },
        orderBy: { createdAt: "asc" },
      })).map((g) => ({ ...g, targetAmount: Number(g.targetAmount) }))
    : [];
  const savingsResolution = resolveSavingsGoalForPrompt({
    prompt,
    category: parsed.category,
    goals,
    amount: parsed.amount,
    accountName,
    date,
    note,
  });
  if (savingsResolution.kind === "ambiguous") {
    return NextResponse.json({
      intent: "unknown",
      clarification: savingsResolution.clarification,
      clarificationType: savingsResolution.clarificationType,
      pendingAction: savingsResolution.pendingAction,
      options: savingsResolution.options,
    });
  }

  const category = savingsResolution.kind === "resolved" || savingsResolution.kind === "unallocated"
    ? savingsResolution.category
    : parsed.category;
  const base = { date, time, amount: parsed.amount, category, note, type: "expense" as const };

  // ── Critical write ─ if this fails, transaction was NOT persisted; return 500.
  let transaction;
  if (useSheets) {
    // Sheets path: generate local ID, schedule appendTransaction() in background via after()
    const generatedId = randomUUID();
    const sheetsPayload = { ...base, fromAccountId: accountId, fromAccountName: accountName };
    scheduleAfterRequest(async () => {
      try {
        await appendTransaction(sheetsId!, accessToken, sheetsPayload);
      } catch (error) {
        const err = error as Error;
        console.error(
          `[handleTransaksi] sheets append failed: userId=${userId} transactionId=${generatedId} error=${err.message}`,
          { userId, transactionId: generatedId, errorMessage: err.message, errorStack: err.stack }
        );
      }
    });
    transaction = { id: generatedId, ...base, accountId, fromAccountId: accountId, fromAccountName: accountName };
  } else {
    try {
      transaction = await appendTransactionDB(userId, { ...base, accountId });
    } catch (err) {
      console.error("[handleTransaksi] critical write failed:", err);
      return NextResponse.json({ error: "Gagal menyimpan transaksi. Coba lagi." }, { status: 500 });
    }
  }

  // ── Secondary side-effects ─ best-effort. Failures logged but do NOT poison the
  // success response (previously they did — user saw an error toast even though
  // the transaction was already in Sheets/DB).
  try {
    await prisma.category.upsert({
      where: { userId_name: { userId, name: category } },
      update: savingsResolution.kind === "resolved" || savingsResolution.kind === "unallocated" ? { isSavings: true } : {},
      create: { userId, name: category, ...(savingsResolution.kind === "resolved" || savingsResolution.kind === "unallocated" ? { isSavings: true } : {}) },
      select: { id: true },
    });
  } catch (err) {
    console.error("[handleTransaksi] category upsert failed (non-fatal):", err);
  }

  if (savingsResolution.kind === "resolved") {
    try {
      await prisma.savingsContribution.create({
        data: {
          userId,
          goalId: savingsResolution.goal.id,
          transactionId: transaction.id,
          amount: new Decimal(parsed.amount),
          date,
          note,
        },
      });
    } catch (err) {
      console.error("[handleTransaksi] savings contribution failed (non-fatal):", err);
    }
  }

  const baseDetails = {
    date: base.date,
    time: base.time,
    category,
    amount: parsed.amount,
    accountName,
    note: note || undefined,
    accountCreated: accountCreated || undefined,
  };

  if (savingsResolution.kind === "resolved") {
    return NextResponse.json({
      intent: "transaksi",
      transaction,
      message: `✓ Tabungan dicatat: ${formatSignedIDR(parsed.amount)} ke ${savingsResolution.goal.name} dari ${accountName}`,
      details: {
        ...baseDetails,
        savingsGoalName: savingsResolution.goal.name,
        contributionStatus: "allocated",
      },
    });
  }

  if (savingsResolution.kind === "unallocated") {
    return NextResponse.json({
      intent: "transaksi",
      transaction,
      message: "✓ Tabungan dicatat sebagai Tabungan umum. Kamu belum punya goal tabungan; buat goal agar kontribusi bisa dilacak per tujuan.",
      details: {
        ...baseDetails,
        contributionStatus: "unallocated",
      },
    });
  }

  return NextResponse.json({
    intent: "transaksi",
    transaction,
    message: `✓ Dicatat: ${category} — ${formatSignedIDR(parsed.amount)} dari ${accountName}`,
    details: baseDetails,
  });
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
  const { accountId, accountCreated } = accountResolution;

  const accountError = await validateAccount(accountId);
  if (accountError) return NextResponse.json({ error: accountError.error }, { status: accountError.status });

  const account = userAccounts.find((a) => a.id === accountId);
  const accountName = account?.name ?? "";
  const time = resolveTransactionTime(parsed, ctx);

  // Per-item writes: collect successes; a single item's failure shouldn't kill the batch.
  const transactions = [];
  const failedItems: { category: string; amount: number; error: string }[] = [];
  for (const item of items) {
    if (!item.amount || !item.category) continue;
    const base = { date: parsed.date ?? ctx.today, time, amount: item.amount, category: item.category, note: sanitizeTransactionNote(item.note), type: "expense" as const };
    if (useSheets) {
      // Sheets path: generate local ID, schedule appendTransaction() in background via after()
      const generatedId = randomUUID();
      const sheetsPayload = { ...base, fromAccountId: accountId, fromAccountName: accountName };
      scheduleAfterRequest(async () => {
        try {
          await appendTransaction(sheetsId!, accessToken, sheetsPayload);
        } catch (error) {
          const err = error as Error;
          console.error(
            `[handleTransaksiBulk] sheets append failed: userId=${userId} transactionId=${generatedId} error=${err.message}`,
            { userId, transactionId: generatedId, errorMessage: err.message, errorStack: err.stack }
          );
        }
      });
      transactions.push({ id: generatedId, ...base, accountId, fromAccountId: accountId, fromAccountName: accountName });
    } else {
      try {
        const transaction = await appendTransactionDB(userId, { ...base, accountId });
        transactions.push(transaction);
      } catch (err) {
        console.error("[handleTransaksiBulk] item write failed:", { item, err });
        failedItems.push({ category: item.category, amount: item.amount, error: "write_failed" });
        continue;
      }
    }
    // Category upsert is non-fatal — losing it doesn't undo the write.
    try {
      await prisma.category.upsert({
        where: { userId_name: { userId, name: item.category } },
        update: {},
        create: { userId, name: item.category },
        select: { id: true },
      });
    } catch (err) {
      console.error("[handleTransaksiBulk] category upsert failed (non-fatal):", err);
    }
  }

  if (transactions.length === 0) {
    return NextResponse.json({ intent: "unknown", clarification: "Tidak ada item valid yang bisa dicatat. Pastikan setiap item memiliki nominal." });
  }

  const total = transactions.reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    intent: "transaksi_bulk",
    transactions,
    message: `✓ ${transactions.length} transaksi dicatat (total ${formatSignedIDR(total)}) ke ${accountName}${failedItems.length > 0 ? ` — ${failedItems.length} item gagal` : ""}`,
    details: {
      date: parsed.date ?? ctx.today,
      time,
      accountName,
      total,
      count: transactions.length,
      accountCreated: accountCreated || undefined,
      failedCount: failedItems.length || undefined,
      failedItems: failedItems.length > 0 ? failedItems : undefined,
    },
  });
}

export async function handleTransfer(parsed: ParsedIntent, ctx: RecordContext): Promise<NextResponse> {
  const { userId, useSheets, sheetsId, accessToken, userAccounts, prompt } = ctx;
  let transferAmount = Number(parsed.transferAmount ?? parsed.amount ?? parsed.nominal ?? 0);
  const fee = parsed.fee === undefined || parsed.fee === null || parsed.fee === "" ? 0 : Number(parsed.fee);
  if (transferAmount) transferAmount = Math.abs(correctAmount(prompt, transferAmount));

  if (!isValidTransferAmount(transferAmount)) {
    return NextResponse.json({ intent: "unknown", clarification: "Nominal transfer tidak terdeteksi. Contoh: 'transfer 1jt dari BCA ke Mandiri fee 2500'" });
  }
  if (!Number.isFinite(fee) || fee < 0 || fee > 1_000_000_000) {
    return NextResponse.json({ intent: "unknown", clarification: "Fee transfer tidak valid. Contoh: 'transfer 1jt dari BCA ke Mandiri fee 2500'" });
  }

  const { resolveAccount, validateAccount } = buildAccountResolver({ userId, prompt, useSheets, sheetsId, accessToken, userAccounts });
  const fromResolution = await resolveAccount(parsed.fromAccountName ?? parsed.accountName, "expense");
  if ("clarification" in fromResolution) return NextResponse.json({ intent: "unknown", clarification: fromResolution.clarification });
  const toResolution = await resolveAccount(parsed.toAccountName, "income");
  if ("clarification" in toResolution) return NextResponse.json({ intent: "unknown", clarification: toResolution.clarification });

  const fromAccountId = fromResolution.accountId;
  const toAccountId = toResolution.accountId;
  if (fromAccountId === toAccountId) {
    return NextResponse.json({ error: "Akun asal dan tujuan tidak boleh sama." }, { status: 400 });
  }

  const fromError = await validateAccount(fromAccountId);
  if (fromError) return NextResponse.json({ error: fromError.error }, { status: fromError.status });
  const toError = await validateAccount(toAccountId);
  if (toError) return NextResponse.json({ error: toError.error }, { status: toError.status });

  const fromAccount = userAccounts.find((a) => a.id === fromAccountId);
  const toAccount = userAccounts.find((a) => a.id === toAccountId);
  const fromAccountName = fromAccount?.name ?? "";
  const toAccountName = toAccount?.name ?? "";
  const date = parsed.date ?? ctx.today;
  const time = resolveTransactionTime(parsed, ctx);
  const note = sanitizeTransactionNote(parsed.note);
  const accountCreatedNames = [fromResolution.accountCreated, toResolution.accountCreated].filter(Boolean) as string[];

  if (useSheets) {
    // Sheets path: generate local IDs, schedule both appendTransaction() calls in background via after()
    const generatedTransferId = randomUUID();
    const generatedFeeId = fee > 0 ? randomUUID() : null;

    const transferPayload = {
      date,
      time,
      amount: transferAmount,
      category: "Transfer",
      note,
      type: "expense" as const,
      fromAccountId,
      fromAccountName,
      toAccountId,
      toAccountName,
    };

    const feePayload = fee > 0 ? {
      date,
      time,
      amount: fee,
      category: TRANSFER_FEE_CATEGORY,
      note: note ? `Fee transfer - ${note}` : "Fee transfer",
      type: "expense" as const,
      fromAccountId,
      fromAccountName,
    } : null;

    scheduleAfterRequest(async () => {
      try {
        await appendTransaction(sheetsId!, accessToken, transferPayload);
      } catch (error) {
        const err = error as Error;
        console.error(
          `[handleTransfer] sheets append failed: userId=${userId} transactionId=${generatedTransferId} error=${err.message}`,
          { userId, transactionId: generatedTransferId, errorMessage: err.message, errorStack: err.stack }
        );
      }

      if (feePayload && generatedFeeId) {
        try {
          await appendTransaction(sheetsId!, accessToken, feePayload);
        } catch (error) {
          const err = error as Error;
          console.error(
            `[handleTransfer] sheets append failed: userId=${userId} transactionId=${generatedFeeId} error=${err.message}`,
            { userId, transactionId: generatedFeeId, errorMessage: err.message, errorStack: err.stack }
          );
        }
      }
    });

    if (fee > 0) {
      try {
        await prisma.category.upsert({
          where: { userId_name: { userId, name: TRANSFER_FEE_CATEGORY } },
          update: {},
          create: { userId, name: TRANSFER_FEE_CATEGORY, type: "expense" },
          select: { id: true },
        });
      } catch (err) {
        console.error("[handleTransfer] fee category upsert failed (non-fatal):", err);
      }
    }

    const transaction = {
      id: generatedTransferId,
      date,
      time,
      amount: transferAmount,
      category: "Transfer",
      note,
      type: "expense",
      fromAccountId,
      fromAccountName,
      toAccountId,
      toAccountName,
    };

    const transactions = [transaction];
    if (fee > 0 && generatedFeeId) {
      transactions.push({
        id: generatedFeeId,
        date,
        time,
        amount: fee,
        category: TRANSFER_FEE_CATEGORY,
        note: note ? `Fee transfer - ${note}` : "Fee transfer",
        type: "expense",
        fromAccountId,
        fromAccountName,
        toAccountId: "",
        toAccountName: "",
      });
    }

    return NextResponse.json({
      intent: "transfer",
      transactions,
      transaction,
      message: `✓ Transfer dicatat: ${fromAccountName} → ${toAccountName} ${formatSignedIDR(transferAmount)}${fee > 0 ? ` + fee ${formatSignedIDR(fee)}` : ""}`,
      details: { date, time, amount: transferAmount, fee, fromAccountName, toAccountName, note: note || undefined, accountCreated: accountCreatedNames.length > 0 ? accountCreatedNames.join(", ") : undefined },
    });
  }

  const transferId = randomUUID();
  try {
    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          accountId: fromAccountId,
          type: "transfer_out",
          amount: new Decimal(transferAmount),
          category: "Transfer",
          date,
          time,
          note,
          transferId,
        },
      }),
      prisma.transaction.create({
        data: {
          userId,
          accountId: toAccountId,
          type: "transfer_in",
          amount: new Decimal(transferAmount),
          category: "Transfer",
          date,
          time,
          note,
          transferId,
        },
      }),
      ...(fee > 0
        ? [
            prisma.transaction.create({
              data: {
                userId,
                accountId: fromAccountId,
                type: "expense",
                amount: new Decimal(fee),
                category: TRANSFER_FEE_CATEGORY,
                date,
                time,
                note: note ? `Fee transfer - ${note}` : "Fee transfer",
              },
            }),
          ]
        : []),
    ]);
  } catch (err) {
    console.error("[handleTransfer] critical $transaction failed:", err);
    return NextResponse.json({ error: "Gagal menyimpan transfer. Coba lagi." }, { status: 500 });
  }

  if (fee > 0) {
    try {
      await prisma.category.upsert({
        where: { userId_name: { userId, name: TRANSFER_FEE_CATEGORY } },
        update: {},
        create: { userId, name: TRANSFER_FEE_CATEGORY, type: "expense" },
        select: { id: true },
      });
    } catch (err) {
      console.error("[handleTransfer] fee category upsert failed (non-fatal):", err);
    }
  }

  return NextResponse.json({
    intent: "transfer",
    transferId,
    message: `✓ Transfer dicatat: ${fromAccountName} → ${toAccountName} ${formatSignedIDR(transferAmount)}${fee > 0 ? ` + fee ${formatSignedIDR(fee)}` : ""}`,
    details: { date, time, amount: transferAmount, fee, fromAccountName, toAccountName, note: note || undefined, accountCreated: accountCreatedNames.length > 0 ? accountCreatedNames.join(", ") : undefined },
  });
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
  const { accountId, accountCreated } = accountResolution;

  const accountError = await validateAccount(accountId);
  if (accountError) return NextResponse.json({ error: accountError.error }, { status: accountError.status });

  const account = userAccounts.find((a) => a.id === accountId);
  const accountName = account?.name ?? "";
  const note = sanitizeTransactionNote(parsed.note);
  const base = { date: parsed.date ?? ctx.today, time: resolveTransactionTime(parsed, ctx), amount: incomeAmount, category: incomeCategory, note, type: "income" as const };

  let transaction;
  if (useSheets) {
    // Sheets path: generate local ID, schedule appendTransaction() in background via after()
    const generatedId = randomUUID();
    const sheetsPayload = { ...base, toAccountId: accountId, toAccountName: accountName };
    scheduleAfterRequest(async () => {
      try {
        await appendTransaction(sheetsId!, accessToken, sheetsPayload);
      } catch (error) {
        const err = error as Error;
        console.error(
          `[handlePemasukan] sheets append failed: userId=${userId} transactionId=${generatedId} error=${err.message}`,
          { userId, transactionId: generatedId, errorMessage: err.message, errorStack: err.stack }
        );
      }
    });
    transaction = { id: generatedId, ...base, accountId, toAccountId: accountId, toAccountName: accountName };
  } else {
    try {
      transaction = await appendTransactionDB(userId, { ...base, accountId });
    } catch (err) {
      console.error("[handlePemasukan] critical write failed:", err);
      return NextResponse.json({ error: "Gagal menyimpan pemasukan. Coba lagi." }, { status: 500 });
    }
  }

  try {
    await prisma.category.upsert({
      where: { userId_name: { userId, name: incomeCategory } },
      update: {},
      create: { userId, name: incomeCategory },
      select: { id: true },
    });
  } catch (err) {
    console.error("[handlePemasukan] category upsert failed (non-fatal):", err);
  }

  return NextResponse.json({
    intent: "pemasukan",
    transaction,
    amount: incomeAmount,
    category: incomeCategory,
    message: `✓ Pemasukan dicatat: ${incomeCategory} ${formatSignedIDR(incomeAmount, "+")} ke ${accountName}`,
    details: {
      date: base.date,
      time: base.time,
      category: incomeCategory,
      amount: incomeAmount,
      accountName,
      note: note || undefined,
      accountCreated: accountCreated || undefined,
    },
  });
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
      select: { id: true },
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
      include: { category: { select: { name: true } } },
    });

    const spentByCategory: Record<string, number> = {};
    for (const t of transactions) {
      if (isExpenseTransaction(t)) spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
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
