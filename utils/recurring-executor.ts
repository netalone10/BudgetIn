import { Decimal } from "@prisma/client/runtime/library";
import { format, startOfDay } from "date-fns";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { calcNextOccurrence, occurrenceKey } from "@/utils/recurring-utils";

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

  // Validate per-type prerequisites
  if (r.type === "expense" || r.type === "income") {
    if (!r.accountId) return { ok: false, error: "Akun belum diatur untuk transaksi ini.", status: 400 };
  }
  if (r.type === "transfer") {
    if (!r.accountId || !r.toAccountId) return { ok: false, error: "Akun sumber & tujuan wajib diatur untuk transfer.", status: 400 };
  }

  const nextDueDate = calcNextOccurrence(r.frequency as "daily" | "weekly" | "monthly" | "yearly", r.interval, r.startDate, occurredDay);

  let createdTxId: string | null = null;
  let createdTransferId: string | null = null;

  await prisma.$transaction(async (tx) => {
    if (r.type === "expense" || r.type === "income") {
      const txn = await tx.transaction.create({
        data: {
          userId: r.userId,
          accountId: r.accountId,
          type: r.type,
          amount,
          category: r.category?.name ?? (r.type === "income" ? "Pendapatan" : "Tagihan"),
          date: dateStr,
          note,
        },
      });
      createdTxId = txn.id;

      if (r.savingsGoalId) {
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
      const transferId = randomUUID();
      createdTransferId = transferId;

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
        transferId: createdTransferId,
        occurredAt: occurredDay,
        amount,
        occurrenceKey: key,
        note,
      },
    });

    await tx.recurringTransaction.update({
      where: { id: r.id },
      data: { lastRunAt: occurredDay, nextDueDate },
    });
  });

  return { ok: true, alreadyRan: false, nextDueDate, recurring: r, occurredDay, amount };
}

export type { RecurringWithRefs };
