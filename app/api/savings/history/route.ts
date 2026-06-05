import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SAVINGS_KEYWORDS } from "@/lib/savings-utils";

// GET — semua transaksi savings (allocated + unallocated), lengkap dengan status
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const savingsCategories = await prisma.category.findMany({
    where: { userId, isSavings: true },
    select: { name: true },
  });
  const savingsCategoryNames = savingsCategories.map((c) => c.name);

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
      OR: [...keywordConditions, ...categoryConditions],
    },
    select: {
      id: true,
      date: true,
      amount: true,
      category: true,
      note: true,
      savingsContribution: {
        select: {
          goalId: true,
          goal: { select: { name: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }],
    take: 200,
  });

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount.toNumber(),
      category: t.category,
      note: t.note,
      goalId: t.savingsContribution?.goalId ?? null,
      goalName: t.savingsContribution?.goal?.name ?? null,
    })),
  });
}
