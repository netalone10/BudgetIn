import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { SAVINGS_KEYWORDS, isSavingsTransaction } from "@/lib/savings-utils";

// GET — semua transaksi savings (allocated + unallocated), lengkap dengan status
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const [user, savingsCategories] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { sheetsId: true } }),
    prisma.category.findMany({ where: { userId, isSavings: true }, select: { name: true } }),
  ]);
  const savingsCategoryNames = savingsCategories.map((c) => c.name);

  // ── GOOGLE SHEETS PATH ────────────────────────────────────────────────────────
  // Transaksi tabungan ada di Sheets, bukan Prisma. Ambil dari Sheets, filter
  // savings, lalu join status alokasi (goalId/goalName) dari SavingsContribution.
  if (user?.sheetsId) {
    let accessToken: string;
    try {
      accessToken = await getValidToken(userId);
    } catch {
      return NextResponse.json({ error: "Sesi expired. Silakan login ulang." }, { status: 401 });
    }

    const savingsCategorySet = new Set(savingsCategoryNames.map((n) => n.toLowerCase()));
    const allTx = await getTransactions(user.sheetsId, accessToken);

    const savingsTx = allTx
      .filter((t) => t.type === "expense" && isSavingsTransaction(t.category, savingsCategorySet))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, 200);

    // Peta alokasi: transactionId → { goalId, goalName }
    const contributions = await prisma.savingsContribution.findMany({
      where: { userId, transactionId: { in: savingsTx.map((t) => t.id) } },
      select: { transactionId: true, goalId: true, goal: { select: { name: true } } },
    });
    const allocByTxId = new Map(
      contributions.map((c) => [c.transactionId, { goalId: c.goalId, goalName: c.goal?.name ?? null }])
    );

    return NextResponse.json({
      transactions: savingsTx.map((t) => {
        const alloc = allocByTxId.get(t.id);
        return {
          id: t.id,
          date: t.date,
          amount: t.amount,
          category: t.category,
          note: t.note,
          goalId: alloc?.goalId ?? null,
          goalName: alloc?.goalName ?? null,
        };
      }),
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
