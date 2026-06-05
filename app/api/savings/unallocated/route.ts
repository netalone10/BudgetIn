import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SAVINGS_KEYWORDS } from "@/lib/savings-utils";

// GET — list expense transactions that are savings-related but not linked to any goal
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  // Fetch user's isSavings categories so we can include them in the filter
  const savingsCategories = await prisma.category.findMany({
    where: { userId, isSavings: true },
    select: { name: true },
  });
  const savingsCategoryNames = savingsCategories.map((c) => c.name);

  const keywordConditions = SAVINGS_KEYWORDS.map((kw) => ({
    category: { contains: kw, mode: "insensitive" as const },
  }));

  const categoryConditions =
    savingsCategoryNames.length > 0
      ? [{ category: { in: savingsCategoryNames } }]
      : [];

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
