/**
 * DB-based transaction CRUD — untuk users yang login via email/password
 * (tidak punya Google Sheets). Mirror dari utils/sheets.ts.
 */

import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { normalizeTransactionTime } from "@/lib/transaction-time";

/** Strip internal [installment:uuid] marker from note for display. */
function stripInstallmentMarker(note: string): string {
  return note.replace(/^\[installment:[^\]]+\]\s*/, "");
}

export interface DbTransaction {
  id: string;
  date: string;
  time: string;
  amount: number;
  category: string;
  note: string;
  created_at: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
  accountId: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
  familyTransferId?: string | null;
  counterpartyUserId?: string | null;
}

interface CreateInput {
  date: string;
  time?: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income";
  accountId: string; // required for new transactions; legacy data may have null in DB
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function appendTransactionDB(
  userId: string,
  data: CreateInput
): Promise<DbTransaction> {
  const tx = await prisma.transaction.create({
    data: {
      id: randomUUID(),
      userId,
      date: data.date,
      time: normalizeTransactionTime(data.time),
      amount: data.amount,
      category: data.category,
      note: data.note,
      type: data.type,
      accountId: data.accountId,
    },
  });

  return {
    id: tx.id,
    date: tx.date,
    time: tx.time,
    amount: tx.amount.toNumber(),
    category: tx.category,
    note: tx.note,
    created_at: tx.createdAt.toISOString(),
    type: tx.type as DbTransaction["type"],
    accountId: tx.accountId,
  };
}

// ── READ ──────────────────────────────────────────────────────────────────────

export async function getTransactionsDB(
  userId: string,
  period: string
): Promise<DbTransaction[]> {
  // Resolve period ke filter tanggal
  const now = new Date();
  let dateFilter: { gte?: string; lte?: string } = {};

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const periodLow = period.toLowerCase();
  if (periodLow.startsWith("custom:")) {
    const [, from, to] = period.split(":");
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
      // Tanggal tidak valid → fallback ke bulan ini
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      dateFilter = { gte: `${ym}-01`, lte: `${ym}-31` };
    } else {
      dateFilter = { gte: from, lte: to };
    }
  } else if (periodLow.includes("bulan ini") || periodLow.includes("this month")) {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    dateFilter = { gte: `${ym}-01`, lte: `${ym}-31` };
  } else if (periodLow.includes("bulan lalu") || periodLow.includes("last month")) {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
    dateFilter = { gte: `${ym}-01`, lte: `${ym}-31` };
  } else if (/^\d{4}-\d{2}$/.test(period)) {
    dateFilter = { gte: `${period}-01`, lte: `${period}-31` };
  } else if (periodLow.includes("minggu ini") || periodLow.includes("this week")) {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    dateFilter = {
      gte: monday.toISOString().slice(0, 10),
      lte: sunday.toISOString().slice(0, 10),
    };
  } else if (periodLow.includes("hari ini") || periodLow.includes("today")) {
    const today = now.toISOString().slice(0, 10);
    dateFilter = { gte: today, lte: today };
  } else if (periodLow.includes("kemarin") || periodLow.includes("yesterday")) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const d = yesterday.toISOString().slice(0, 10);
    dateFilter = { gte: d, lte: d };
  } else if (periodLow === "semua" || periodLow === "all") {
    // Semua waktu — tanpa filter tanggal.
    dateFilter = {};
  } else if (periodLow === "last3months") {
    // Dari awal bulan 3 bulan lalu s/d akhir bulan kemarin
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 0); // hari terakhir bulan lalu
    dateFilter = {
      gte: startMonth.toISOString().slice(0, 10),
      lte: endMonth.toISOString().slice(0, 10),
    };
  } else {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    dateFilter = { gte: `${ym}-01`, lte: `${ym}-31` };
  }

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      date: dateFilter,
    },
    select: {
      id: true,
      date: true,
      time: true,
      amount: true,
      category: true,
      note: true,
      createdAt: true,
      type: true,
      accountId: true,
      transferId: true,
      familyTransferId: true,
      counterpartyUserId: true,
    },
    orderBy: [{ date: "desc" }, { time: "desc" }],
  });

  // ── Resolve transfer pairs via transferId ───────────────────────────────
  // Postgres stores transfers as two rows (transfer_out + transfer_in) linked
  // by transferId. The edit modal needs fromAccountId/toAccountId on BOTH legs.
  const txns = rows.map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time,
    amount: r.amount.toNumber(),
    category: r.category,
    note: stripInstallmentMarker(r.note),
    created_at: r.createdAt.toISOString(),
    type: r.type as DbTransaction["type"],
    accountId: r.accountId,
    transferId: r.transferId,
    familyTransferId: r.familyTransferId,
    counterpartyUserId: r.counterpartyUserId,
  }));

  // Build transferId → partner accountId lookup
  const transferPartners = new Map<string, { sourceAccountId: string; targetAccountId: string }>();
  const transferTxns = txns.filter((t) => t.transferId && (t.type === "transfer_out" || t.type === "transfer_in"));

  for (const t of transferTxns) {
    if (!transferPartners.has(t.transferId!)) {
      // Find the pair in this batch
      const partner = transferTxns.find(
        (p) => p.transferId === t.transferId && p.id !== t.id
      );
      if (partner) {
        const sourceAccountId = t.type === "transfer_out" ? t.accountId! : partner.accountId!;
        const targetAccountId = t.type === "transfer_in" ? t.accountId! : partner.accountId!;
        transferPartners.set(t.transferId!, { sourceAccountId, targetAccountId });
      }
    }
  }

  // Populate fromAccountId/toAccountId on transfer legs
  return txns.map((t) => {
    if (t.transferId && transferPartners.has(t.transferId)) {
      const { sourceAccountId, targetAccountId } = transferPartners.get(t.transferId)!;
      return {
        ...t,
        fromAccountId: sourceAccountId,
        toAccountId: targetAccountId,
      };
    }
    return t;
  });
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateTransactionDB(
  userId: string,
  txId: string,
  data: Partial<Pick<DbTransaction, "date" | "time" | "amount" | "category" | "note">> & { accountId?: string | null }
): Promise<void> {
  await prisma.transaction.updateMany({
    where: { id: txId, userId }, // pastikan milik user ini
    data: {
      ...(data.date !== undefined && { date: data.date }),
      ...(data.time !== undefined && { time: normalizeTransactionTime(data.time) }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.note !== undefined && { note: data.note }),
      ...(data.accountId !== undefined && { accountId: data.accountId }),
    },
  });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteTransactionDB(
  userId: string,
  txId: string
): Promise<void> {
  await prisma.transaction.deleteMany({
    where: { id: txId, userId },
  });
}
