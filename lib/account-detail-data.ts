/**
 * Server-side data fetcher for Account Detail page.
 * Fetches account info + recent transactions in parallel.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSingleAccountBalance } from "@/utils/account-balance";
import { getValidToken } from "@/utils/token";
import { getTransactions, getAccounts } from "@/utils/sheets";

export interface AccountDetailData {
  account: {
    id: string;
    name: string;
    currentBalance: string;
    currency: string;
    color: string | null;
    note: string;
    tanggalSettlement: number | null;
    tanggalJatuhTempo: number | null;
    accountType: {
      name: string;
      classification: string;
      icon?: string;
      color?: string;
    };
  };
  transactions: AccountTransaction[];
  summary: {
    totalIn: number;
    totalOut: number;
    net: number;
    count: number;
  };
}

export interface AccountTransaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
  created_at: string;
  accountId: string | null;
  fromAccountName?: string;
  toAccountName?: string;
}

/**
 * Fetch account detail + all transactions for the account (current month).
 * Returns null if account not found or not owned by user.
 */
export async function fetchAccountDetail(
  accountId: string
): Promise<AccountDetailData | null> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (user?.sheetsId) {
    return fetchSheetsAccountDetail(session.userId, user.sheetsId, accountId);
  } else {
    return fetchDbAccountDetail(session.userId, accountId);
  }
}

async function fetchDbAccountDetail(
  userId: string,
  accountId: string
): Promise<AccountDetailData | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { accountType: true },
  });

  if (!account || account.userId !== userId) return null;

  // Fetch balance + this month's transactions in parallel
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [currentBalance, rows] = await Promise.all([
    getSingleAccountBalance(userId, accountId),
    prisma.transaction.findMany({
      where: {
        userId,
        accountId,
        date: { gte: `${ym}-01`, lte: `${ym}-31` },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  let totalIn = 0;
  let totalOut = 0;
  const transactions: AccountTransaction[] = rows.map((r) => {
    const amt = r.amount.toNumber();
    if (r.type === "income" || r.type === "transfer_in") totalIn += amt;
    else totalOut += amt;
    return {
      id: r.id,
      date: r.date,
      amount: amt,
      category: r.category,
      note: r.note,
      type: r.type as AccountTransaction["type"],
      created_at: r.createdAt.toISOString(),
      accountId: r.accountId,
    };
  });

  return {
    account: {
      id: account.id,
      name: account.name,
      currentBalance: currentBalance.toString(),
      currency: account.currency,
      color: account.color,
      note: account.note,
      tanggalSettlement: account.tanggalSettlement,
      tanggalJatuhTempo: account.tanggalJatuhTempo,
      accountType: {
        name: account.accountType.name,
        classification: account.accountType.classification,
        icon: account.accountType.icon,
        color: account.accountType.color,
      },
    },
    transactions,
    summary: { totalIn, totalOut, net: totalIn - totalOut, count: rows.length },
  };
}

async function fetchSheetsAccountDetail(
  userId: string,
  sheetsId: string,
  accountId: string
): Promise<AccountDetailData | null> {
  const accessToken = await getValidToken(userId);
  const [allAccounts, allTxs] = await Promise.all([
    getAccounts(sheetsId, accessToken),
    getTransactions(sheetsId, accessToken),
  ]);

  const account = allAccounts.find((a) => a.id === accountId);
  if (!account) return null;

  // Filter by account
  let filtered = allTxs.filter(
    (t) => t.fromAccountId === accountId || t.toAccountId === accountId
  );

  // Current month filter
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  filtered = filtered.filter((t) => t.date.startsWith(ym));

  // Sort descending
  filtered.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (a.created_at || "") < (b.created_at || "") ? 1 : -1;
  });

  let totalIn = 0;
  let totalOut = 0;
  const transactions: AccountTransaction[] = filtered.map((t) => {
    const effectiveType = determineType(t, accountId);
    if (effectiveType === "income" || effectiveType === "transfer_in") totalIn += t.amount;
    else totalOut += t.amount;
    return {
      id: t.id,
      date: t.date,
      amount: t.amount,
      category: t.category,
      note: t.note,
      type: effectiveType,
      created_at: t.created_at,
      accountId,
      fromAccountName: t.fromAccountName,
      toAccountName: t.toAccountName,
    };
  });

  return {
    account: {
      id: account.id,
      name: account.name,
      currentBalance: account.balance.toString(),
      currency: account.currency,
      color: account.color,
      note: account.note ?? "",
      tanggalSettlement: account.tanggalSettlement,
      tanggalJatuhTempo: account.tanggalJatuhTempo,
      accountType: {
        name: account.type,
        classification: account.classification,
      },
    },
    transactions,
    summary: { totalIn, totalOut, net: totalIn - totalOut, count: filtered.length },
  };
}

function determineType(
  t: { type: string; fromAccountId?: string; toAccountId?: string },
  accountId: string
): AccountTransaction["type"] {
  if (t.fromAccountId && t.toAccountId) {
    return t.fromAccountId === accountId ? "transfer_out" : "transfer_in";
  }
  if (t.type === "expense" && t.fromAccountId === accountId) return "expense";
  if (t.type === "income" && t.toAccountId === accountId) return "income";
  if (t.fromAccountId === accountId) return "expense";
  if (t.toAccountId === accountId) return "income";
  return t.type as AccountTransaction["type"];
}
