import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions, getAccounts } from "@/utils/sheets";
import { getSingleAccountBalance } from "@/utils/account-balance";

type Params = { params: Promise<{ accountId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId } = await params;
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "bulan ini";
  const limit = Math.min(Number(searchParams.get("limit") || "200"), 500);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  try {
    if (user?.sheetsId) {
      return await handleSheetsUser(session.userId, user.sheetsId, accountId, period, limit);
    } else {
      return await handleDbUser(session.userId, accountId, period, limit);
    }
  } catch (e) {
    console.error("Failed to fetch account transactions:", e);
    return NextResponse.json({ error: "Gagal mengambil data transaksi" }, { status: 500 });
  }
}

async function handleSheetsUser(
  userId: string,
  sheetsId: string,
  accountId: string,
  period: string,
  limit: number
) {
  const accessToken = await getValidToken(userId);
  const [allAccounts, allTransactions] = await Promise.all([
    getAccounts(sheetsId, accessToken),
    getTransactions(sheetsId, accessToken),
  ]);

  const account = allAccounts.find((a) => a.id === accountId);
  if (!account) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  // Filter transactions by accountId (fromAccountId or toAccountId)
  let filtered = allTransactions.filter(
    (t) => t.fromAccountId === accountId || t.toAccountId === accountId
  );

  // Apply period filter
  filtered = applyPeriodFilter(filtered, period);

  // Sort by date descending, then by created_at descending
  filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (a.created_at || "") < (b.created_at || "") ? 1 : -1;
  });

  // Compute summary before limiting
  const summary = computeSummary(filtered, accountId);

  // Apply limit
  const transactions = filtered.slice(0, limit).map((t) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    category: t.category,
    note: t.note,
    type: determineTypeForAccount(t, accountId),
    created_at: t.created_at,
    accountId,
    fromAccountName: t.fromAccountName,
    toAccountName: t.toAccountName,
  }));

  return NextResponse.json({
    account: {
      id: account.id,
      name: account.name,
      currentBalance: account.balance.toString(),
      accountType: { name: account.type, classification: account.classification },
      currency: account.currency,
      color: account.color,
      note: account.note,
      tanggalSettlement: account.tanggalSettlement,
      tanggalJatuhTempo: account.tanggalJatuhTempo,
    },
    transactions,
    summary,
  });
}

async function handleDbUser(
  userId: string,
  accountId: string,
  period: string,
  limit: number
) {
  // Verify account ownership
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { accountType: true },
  });

  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  // Build date filter
  const dateFilter = buildDateFilter(period);

  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      accountId,
      ...(dateFilter && { date: dateFilter }),
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  // Compute summary
  let totalIn = 0;
  let totalOut = 0;
  for (const r of rows) {
    const amt = r.amount.toNumber();
    if (r.type === "income" || r.type === "transfer_in") {
      totalIn += amt;
    } else {
      totalOut += amt;
    }
  }

  // Get current balance
  const currentBalance = await getSingleAccountBalance(userId, accountId);

  const transactions = rows.slice(0, limit).map((r) => ({
    id: r.id,
    date: r.date,
    amount: r.amount.toNumber(),
    category: r.category,
    note: r.note,
    type: r.type as "expense" | "income" | "transfer_out" | "transfer_in",
    created_at: r.createdAt.toISOString(),
    accountId: r.accountId,
  }));

  return NextResponse.json({
    account: {
      id: account.id,
      name: account.name,
      currentBalance: currentBalance.toString(),
      accountType: {
        name: account.accountType.name,
        classification: account.accountType.classification,
        icon: account.accountType.icon,
        color: account.accountType.color,
      },
      currency: account.currency,
      color: account.color,
      note: account.note,
      tanggalSettlement: account.tanggalSettlement,
      tanggalJatuhTempo: account.tanggalJatuhTempo,
    },
    transactions,
    summary: {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      count: rows.length,
    },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildDateFilter(period: string): { gte?: string; lte?: string } | null {
  const now = new Date();
  const periodLow = period.toLowerCase();

  if (periodLow.startsWith("custom:")) {
    const [, from, to] = period.split(":");
    if (from && to && from <= to) return { gte: from, lte: to };
  }

  if (periodLow === "bulan ini") {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return { gte: `${ym}-01`, lte: `${ym}-31` };
  }

  if (periodLow === "bulan lalu") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { gte: `${ym}-01`, lte: `${ym}-31` };
  }

  if (periodLow === "3 bulan" || periodLow === "3bulan") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return {
      gte: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
      lte: `${ym}-31`,
    };
  }

  if (periodLow === "semua") return null;

  // Default: bulan ini
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return { gte: `${ym}-01`, lte: `${ym}-31` };
}

function applyPeriodFilter<T extends { date: string }>(txs: T[], period: string): T[] {
  const now = new Date();
  const periodLow = period.toLowerCase();

  if (periodLow.startsWith("custom:")) {
    const [, from, to] = period.split(":");
    if (from && to) return txs.filter((t) => t.date >= from && t.date <= to);
  }

  if (periodLow === "bulan ini") {
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return txs.filter((t) => t.date.startsWith(ym));
  }

  if (periodLow === "bulan lalu") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return txs.filter((t) => t.date.startsWith(ym));
  }

  if (periodLow === "3 bulan" || periodLow === "3bulan") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
    return txs.filter((t) => t.date >= startStr);
  }

  if (periodLow === "semua") return txs;

  // Default: bulan ini
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return txs.filter((t) => t.date.startsWith(ym));
}

/** For Sheets users, determine if a transaction is "in" or "out" relative to this account */
function determineTypeForAccount(
  t: { type: string; fromAccountId?: string; toAccountId?: string },
  accountId: string
): "expense" | "income" | "transfer_out" | "transfer_in" {
  // If it's a transfer (has both from and to)
  if (t.fromAccountId && t.toAccountId) {
    return t.fromAccountId === accountId ? "transfer_out" : "transfer_in";
  }
  // Expense from this account
  if (t.type === "expense" && t.fromAccountId === accountId) return "expense";
  // Income to this account
  if (t.type === "income" && t.toAccountId === accountId) return "income";
  // Fallback
  if (t.fromAccountId === accountId) return "expense";
  if (t.toAccountId === accountId) return "income";
  return t.type as "expense" | "income";
}

function computeSummary(
  txs: { type: string; amount: number; fromAccountId?: string; toAccountId?: string }[],
  accountId: string
) {
  let totalIn = 0;
  let totalOut = 0;
  for (const t of txs) {
    const effectiveType = determineTypeForAccount(t, accountId);
    if (effectiveType === "income" || effectiveType === "transfer_in") {
      totalIn += t.amount;
    } else {
      totalOut += t.amount;
    }
  }
  return { totalIn, totalOut, net: totalIn - totalOut, count: txs.length };
}
