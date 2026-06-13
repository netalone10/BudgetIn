import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { SAVINGS_KEYWORDS, isSavingsTransaction } from "@/lib/savings-utils";

// GET — list expense transactions that are savings-related but not linked to any goal
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  // Fetch user's isSavings categories so we can include them in the filter
  const [user, savingsCategories] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { sheetsId: true } }),
    prisma.category.findMany({ where: { userId, isSavings: true }, select: { name: true } }),
  ]);
  const savingsCategoryNames = savingsCategories.map((c) => c.name);

  // ── GOOGLE SHEETS PATH ────────────────────────────────────────────────────────
  // Transaksi tabungan ada di Sheets. Ambil dari Sheets, filter savings, lalu
  // buang yang sudah punya SavingsContribution (sudah dialokasikan ke goal).
  if (user?.sheetsId) {
    let accessToken: string;
    try {
      accessToken = await getValidToken(userId);
    } catch {
      return NextResponse.json({ error: "Sesi expired. Silakan login ulang." }, { status: 401 });
    }

    const savingsCategorySet = new Set(savingsCategoryNames.map((n) => n.toLowerCase()));
    const allTx = await getTransactions(user.sheetsId, accessToken);

    const candidates = allTx
      .filter((t) => t.type === "expense" && isSavingsTransaction(t.category, savingsCategorySet))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.time ?? "").localeCompare(a.time ?? "");
      })
      .slice(0, 100);

    const linked = await prisma.savingsContribution.findMany({
      where: { userId, transactionId: { in: candidates.map((t) => t.id) } },
      select: { transactionId: true },
    });
    const linkedIds = new Set(linked.map((c) => c.transactionId));

    return NextResponse.json({
      transactions: candidates
        .filter((t) => !linkedIds.has(t.id))
        .map((t) => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          category: t.category,
          note: t.note,
          accountId: t.fromAccountId ?? null,
        })),
    });
  }

  // ── PRISMA / EMAIL PATH ───────────────────────────────────────────────────────
  const keywordConditions = SAVINGS_KEYWORDS.map((kw) => ({
    category: { contains: kw, mode: "insensitive" as const },
  }));

  const categoryConditions = savingsCategoryNames.map((name) => ({
    category: { equals: name, mode: "insensitive" as const },
  }));

  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: "expense",
      savingsContribution: { is: null },
      OR: [...keywordConditions, ...categoryConditions],
    },
    select: {
      id: true,
      date: true,
      time: true,
      amount: true,
      category: true,
      note: true,
      accountId: true,
    },
    orderBy: [{ date: "desc" }, { time: "desc" }],
    take: 100,
  });

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount.toNumber(),
      category: t.category,
      note: t.note,
      accountId: t.accountId,
    })),
  });
}
