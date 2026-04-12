/**
 * DB-based transaction CRUD — untuk users yang login via email/password
 * (tidak punya Google Sheets). Mirror dari utils/sheets.ts.
 */

import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

export interface DbTransaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  created_at: string;
  type: "expense" | "income";
}

interface CreateInput {
  date: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income";
}

// ── CREATE ────────────────────────────────────────────────────────────────────

export async function appendTransactionDB(
  userId: string,
  data: CreateInput
): Promise<DbTransaction> {
  const tx = await prisma.transaction.create({
    data: {
      id: uuidv4(),
      userId,
      date: data.date,
      amount: data.amount,
      category: data.category,
      note: data.note,
      type: data.type,
    },
  });

  return {
    id: tx.id,
    date: tx.date,
    amount: tx.amount,
    category: tx.category,
    note: tx.note,
    created_at: tx.createdAt.toISOString(),
    type: tx.type as "expense" | "income",
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

  const periodLow = period.toLowerCase();
  if (periodLow.includes("bulan ini") || periodLow.includes("this month")) {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    dateFilter = { gte: `${ym}-01`, lte: `${ym}-31` };
  } else if (periodLow.includes("minggu ini") || periodLow.includes("this week")) {
    const day = now.getDay(); // 0=Sun
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
  } else {
    // Fallback: bulan ini
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    dateFilter = { gte: `${ym}-01`, lte: `${ym}-31` };
  }

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      date: dateFilter,
    },
    orderBy: { date: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    category: r.category,
    note: r.note,
    created_at: r.createdAt.toISOString(),
    type: r.type as "expense" | "income",
  }));
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export async function updateTransactionDB(
  userId: string,
  txId: string,
  data: Partial<Pick<DbTransaction, "date" | "amount" | "category" | "note">>
): Promise<void> {
  await prisma.transaction.updateMany({
    where: { id: txId, userId }, // pastikan milik user ini
    data: {
      ...(data.date !== undefined && { date: data.date }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.note !== undefined && { note: data.note }),
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
