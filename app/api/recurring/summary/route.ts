import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format, startOfDay, startOfMonth, endOfMonth } from "date-fns";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period"); // "2026-04"

  const period = periodParam ?? format(new Date(), "yyyy-MM");
  const [year, month] = period.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const today = startOfDay(new Date());

  const items = await prisma.recurringTransaction.findMany({
    where: { userId: session.userId, isActive: true },
    include: {
      occurrences: {
        where: { occurredAt: { gte: monthStart, lte: monthEnd } },
      },
    },
  });

  let totalRecurring = 0;
  let paidAmount = 0;
  let pendingAmount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;

  for (const item of items) {
    const amount = item.amount.toNumber();
    totalRecurring++;
    const ranThisMonth = item.occurrences.length > 0;
    const sign = item.type === "income" ? 1 : -1;
    if (ranThisMonth) {
      paidAmount += amount * sign;
    } else {
      pendingAmount += amount * sign;
      const due = startOfDay(item.nextDueDate);
      if (due < today) overdueCount++;
      if (due.getTime() === today.getTime()) dueTodayCount++;
    }
  }

  return NextResponse.json({
    period,
    totalBills: totalRecurring,
    totalRecurring,
    paidAmount: Math.abs(paidAmount),
    pendingAmount: Math.abs(pendingAmount),
    overdueCount,
    dueTodayCount,
  });
}
