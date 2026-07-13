import { Decimal } from "@prisma/client/runtime/library";
import { format, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { calcNextOccurrence, occurrenceKey } from "@/utils/recurring-utils";
import { getValidToken } from "@/utils/token";
import { appendTransaction } from "@/utils/sheets";
import { currentJakartaTime } from "@/lib/transaction-time";
import { invalidateDashboardCache } from "@/lib/cache";

type RecurringWithRefs = Awaited<ReturnType<typeof loadForExecution>>;

async function loadForExecution(id: string) {
  return prisma.recurringTransaction.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      account: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
      savingsGoal: { select: { id: true, name: true } },
    },
  });
}

export type RunResult =
  | { ok: true; alreadyRan: boolean; nextDueDate: Date; recurring?: RecurringWithRefs; occurredDay?: Date; amount?: Decimal }
  | { ok: false; error: string; status: number };

export async function runRecurringOccurrence(
  recurringId: string,
  occurredAt: Date = new Date(),
  amountOverride?: number,
  noteOverride?: string,
): Promise<RunResult> {
  const r = await loadForExecution(recurringId);
  if (!r || !r.isActive) return { ok: false, error: "Tidak ditemukan / nonaktif.", status: 404 };

  const occurredDay = startOfDay(occurredAt);
  const key = occurrenceKey(occurredDay);
  const dateStr = format(occurredDay, "yyyy-MM-dd");

  const existing = await prisma.recurringOccurrence.findUnique({
    where: { recurringId_occurrenceKey: { recurringId, occurrenceKey: key } },
  });
  if (existing) {
    return { ok: true, alreadyRan: true, nextDueDate: r.nextDueDate };
  }

  const amount = amountOverride && amountOverride > 0
    ? new Decimal(amountOverride)
    : r.amount;
  const note = noteOverride ?? r.note ?? `${r.name} (otomatis)`;

  // Detect installment type (metadata only, no liability account)
  const isInstallment = !!(r.installmentTotal && r.installmentTenor);

  // Validate per-type prerequisites
  if (r.type === "expense" || r.type === "income") {
    if (!r.accountId) return { ok: false, error: "Akun belum diatur untuk transaksi ini.", status: 400 };
  }
  if (r.type === "transfer") {
    if (!r.accountId || !r.toAccountId) return { ok: false, error: "Akun sumber & tujuan wajib diatur untuk transfer.", status: 400 };
  }

  const nextDueDate = calcNextOccurrence(r.frequency as "daily" | "weekly" | "monthly" | "yearly", r.interval, r.startDate, occurredDay);

  // Installment note: "Name (cicilan X/Y)"
  const installmentNumber = (r.installmentPaid ?? 0) + 1;
  const installmentNote = isInstallment
    ? `${r.name} (cicilan ${installmentNumber}/${r.installmentTenor})`
    : note;

  // ── GOOGLE SHEETS PATH ──────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: r.userId },
    select: { sheetsId: true },
  });

  if (user?.sheetsId) {
    let accessToken: string;
    try {
      accessToken = await getValidToken(r.userId);
    } catch {
      return { ok: false, error: "Sesi Google expired. Hubungkan ulang Google untuk mencatat.", status: 401 };
    }

    const time = currentJakartaTime();
    const amountNum = amount.toNumber();
    let sheetsTxId: string | null = null;

    try {
      if (isInstallment) {
        // Cicilan = simple expense from source account, category "Cicilan"
        const appended = await appendTransaction(user.sheetsId, accessToken, {
          date: dateStr,
          time,
          amount: amountNum,
          category: "Cicilan",
          note: installmentNote,
          type: "expense",
          fromAccountId: r.accountId ?? undefined,
          fromAccountName: r.account?.name,
        });
        sheetsTxId = appended.id;
      } else if (r.type === "expense" || r.type === "income") {
        const appended = await appendTransaction(user.sheetsId, accessToken, {
          date: dateStr,
          time,
          amount: amountNum,
          category: r.category?.name ?? (r.type === "income" ? "Pendapatan" : "Tagihan"),
          note,
          type: r.type,
          ...(r.type === "expense"
            ? { fromAccountId: r.accountId ?? undefined, fromAccountName: r.account?.name }
            : { toAccountId: r.accountId ?? undefined, toAccountName: r.account?.name }),
        });
        sheetsTxId = appended.id;
      } else if (r.type === "transfer") {
        const appended = await appendTransaction(user.sheetsId, accessToken, {
          date: dateStr,
          time,
          amount: amountNum,
          category: "Transfer",
          note,
          type: "expense",
          fromAccountId: r.accountId ?? undefined,
          fromAccountName: r.account?.name,
          toAccountId: r.toAccountId ?? undefined,
          toAccountName: r.toAccount?.name,
        });
        sheetsTxId = appended.id;
      }
    } catch (error) {
      console.error("[recurring-executor] Sheets append gagal:", error);
      return { ok: false, error: "Gagal menulis ke Google Sheets. Coba lagi.", status: 502 };
    }

    await prisma.$transaction(async (tx) => {
      // Mirror Transaction in Postgres for Sheets users (needed for FK references)
      if (sheetsTxId) {
        await tx.transaction.create({
          data: {
            id: sheetsTxId,
            userId: r.userId,
            date: dateStr,
            time,
            amount,
            category: isInstallment ? "Cicilan" : (r.category?.name ?? (r.type === "income" ? "Pendapatan" : r.type === "expense" ? "Tagihan" : "Transfer")),
            note: installmentNote,
            type: "expense",
            accountId: r.accountId,
          },
        });
      }

      // Savings contribution
      if (r.savingsGoalId && sheetsTxId && !isInstallment) {
        await tx.savingsContribution.create({
          data: {
            userId: r.userId,
            goalId: r.savingsGoalId,
            transactionId: sheetsTxId,
            amount,
            date: dateStr,
            note: installmentNote,
          },
        });
      }

      await tx.recurringOccurrence.create({
        data: {
          recurringId: r.id,
          transactionId: sheetsTxId,
          occurredAt: occurredDay,
          amount,
          occurrenceKey: key,
          note: installmentNote,
        },
      });

      // Update recurring record
      const updateData: any = { lastRunAt: occurredDay, nextDueDate };

      // Installment: increment paid count, deactivate if complete
      if (isInstallment) {
        const newPaid = installmentNumber;
        updateData.installmentPaid = { increment: 1 };
        if (newPaid >= r.installmentTenor!) {
          updateData.isActive = false;
        }
      }

      await tx.recurringTransaction.update({
        where: { id: r.id },
        data: updateData,
      });
    });

    invalidateDashboardCache(r.userId);
    return { ok: true, alreadyRan: false, nextDueDate, recurring: r, occurredDay, amount };
  }

  // ── POSTGRES PATH (user email/password) ──────────────────────────────────────
  let createdTxId: string | null = null;

  await prisma.$transaction(async (tx) => {
    if (isInstallment || r.type === "expense" || r.type === "income") {
      // Cicilan and regular expense/income: single transaction
      const txn = await tx.transaction.create({
        data: {
          userId: r.userId,
          accountId: r.accountId,
          type: r.type,
          amount,
          category: isInstallment ? "Cicilan" : (r.category?.name ?? (r.type === "income" ? "Pendapatan" : "Tagihan")),
          date: dateStr,
          note: installmentNote,
        },
      });
      createdTxId = txn.id;

      if (r.savingsGoalId && !isInstallment) {
        await tx.savingsContribution.create({
          data: {
            userId: r.userId,
            goalId: r.savingsGoalId,
            transactionId: txn.id,
            amount,
            date: dateStr,
            note,
          },
        });
      }
    } else if (r.type === "transfer") {
      const transferId = crypto.randomUUID();

      const out = await tx.transaction.create({
        data: {
          userId: r.userId,
          accountId: r.accountId,
          type: "transfer_out",
          amount,
          category: "Transfer",
          date: dateStr,
          note,
          transferId,
        },
      });
      await tx.transaction.create({
        data: {
          userId: r.userId,
          accountId: r.toAccountId,
          type: "transfer_in",
          amount,
          category: "Transfer",
          date: dateStr,
          note,
          transferId,
        },
      });
      createdTxId = out.id;

      if (r.savingsGoalId) {
        await tx.savingsContribution.create({
          data: {
            userId: r.userId,
            goalId: r.savingsGoalId,
            transactionId: out.id,
            amount,
            date: dateStr,
            note,
          },
        });
      }
    }

    await tx.recurringOccurrence.create({
      data: {
        recurringId: r.id,
        transactionId: createdTxId,
        occurredAt: occurredDay,
        amount,
        occurrenceKey: key,
        note: installmentNote,
      },
    });

    // Update recurring record
    const updateData: any = { lastRunAt: occurredDay, nextDueDate };

    // Installment: increment paid count, deactivate if complete
    if (isInstallment) {
      const newPaid = installmentNumber;
      updateData.installmentPaid = { increment: 1 };
      if (newPaid >= r.installmentTenor!) {
        updateData.isActive = false;
      }
    }

    await tx.recurringTransaction.update({
      where: { id: r.id },
      data: updateData,
    });
  });

  invalidateDashboardCache(r.userId);
  return { ok: true, alreadyRan: false, nextDueDate, recurring: r, occurredDay, amount };
}

export type { RecurringWithRefs };
