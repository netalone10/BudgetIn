import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { compareTransactionDateTimeDesc } from "@/lib/transaction-time";

type RecentTx = {
  id: string;
  date: string;
  amount: number;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
};

/**
 * Returns the N most recent transactions per account in a single response.
 * Replaces the N+1 pattern of one fetch per account on the accounts list page.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || "5"), 1), 20);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  try {
    const byAccount: Record<string, RecentTx[]> = user?.sheetsId
      ? await fromSheets(session.userId, user.sheetsId, limit)
      : await fromDb(session.userId, limit);
    return NextResponse.json({ byAccount });
  } catch (e) {
    console.error("Failed to fetch recent transactions:", e);
    return NextResponse.json({ error: "Gagal mengambil transaksi terakhir" }, { status: 500 });
  }
}

async function fromSheets(userId: string, sheetsId: string, limit: number) {
  const accessToken = await getValidToken(userId);
  const all = await getTransactions(sheetsId, accessToken);
  all.sort(compareTransactionDateTimeDesc);

  const byAccount: Record<string, RecentTx[]> = {};
  for (const t of all) {
    const accIds = [t.fromAccountId, t.toAccountId].filter(Boolean) as string[];
    for (const accId of accIds) {
      const bucket = byAccount[accId] ?? (byAccount[accId] = []);
      if (bucket.length >= limit) continue;
      bucket.push({
        id: t.id,
        date: t.date,
        amount: t.amount,
        note: t.note,
        type: classifyForAccount(t, accId),
      });
    }
  }
  return byAccount;
}

async function fromDb(userId: string, limit: number) {
  // Pull the latest 200 transactions for this user, then bucket per account in JS.
  // 200 covers the recent activity for any reasonable user.
  const rows = await prisma.transaction.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { time: "desc" }],
    take: 200,
    select: { id: true, date: true, amount: true, note: true, type: true, accountId: true },
  });

  const byAccount: Record<string, RecentTx[]> = {};
  for (const r of rows) {
    if (!r.accountId) continue;
    const bucket = byAccount[r.accountId] ?? (byAccount[r.accountId] = []);
    if (bucket.length >= limit) continue;
    bucket.push({
      id: r.id,
      date: r.date,
      amount: r.amount.toNumber(),
      note: r.note,
      type: r.type as RecentTx["type"],
    });
  }
  return byAccount;
}

function classifyForAccount(
  t: { type: string; fromAccountId?: string; toAccountId?: string },
  accountId: string
): RecentTx["type"] {
  if (t.fromAccountId && t.toAccountId) {
    return t.fromAccountId === accountId ? "transfer_out" : "transfer_in";
  }
  if (t.fromAccountId === accountId) return "expense";
  if (t.toAccountId === accountId) return "income";
  return t.type as RecentTx["type"];
}
