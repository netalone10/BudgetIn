import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidMonth } from "@/lib/budget-data";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sourceMonth, targetMonth } = await req.json();

    if (!isValidMonth(sourceMonth) || !isValidMonth(targetMonth)) {
      return NextResponse.json(
        { error: "sourceMonth dan targetMonth harus format YYYY-MM" },
        { status: 400 }
      );
    }

    if (sourceMonth === targetMonth) {
      return NextResponse.json(
        { error: "sourceMonth dan targetMonth tidak boleh sama" },
        { status: 400 }
      );
    }

    const sourceBudgets = await prisma.budget.findMany({
      where: { userId: session.userId, month: sourceMonth },
      select: { categoryId: true, amount: true },
    });

    if (sourceBudgets.length === 0) {
      return NextResponse.json({ success: true, copied: 0 });
    }

    const budgets = await prisma.$transaction(
      sourceBudgets.map((budget) =>
        prisma.budget.upsert({
          where: {
            userId_categoryId_month: {
              userId: session.userId,
              categoryId: budget.categoryId,
              month: targetMonth,
            },
          },
          update: { amount: budget.amount },
          create: {
            userId: session.userId,
            categoryId: budget.categoryId,
            month: targetMonth,
            amount: budget.amount,
          },
        })
      )
    );

    return NextResponse.json({ success: true, copied: budgets.length });
  } catch {
    return NextResponse.json(
      { error: "Gagal copy budget. Coba lagi." },
      { status: 500 }
    );
  }
}
