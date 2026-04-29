import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format, startOfDay } from "date-fns";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period"); // "2026-04"

  const period = periodParam ?? format(new Date(), "yyyy-MM");
  const [year, month] = period.split("-").map(Number);

  const today = startOfDay(new Date());

  const bills = await prisma.recurringBill.findMany({
    where: { userId: session.userId, isActive: true },
    include: {
      payments: { where: { paymentMonth: period } },
    },
  });

  let totalBills = 0;
  let paidAmount = 0;
  let pendingAmount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;

  for (const bill of bills) {
    const amount = bill.amount.toNumber();
    totalBills++;
    const paid = bill.payments.length > 0;
    if (paid) {
      paidAmount += amount;
    } else {
      pendingAmount += amount;
      const due = startOfDay(bill.nextDueDate);
      if (due < today) overdueCount++;
      if (due.getTime() === today.getTime()) dueTodayCount++;
    }
  }

  return NextResponse.json({
    period,
    totalBills,
    paidAmount,
    pendingAmount,
    overdueCount,
    dueTodayCount,
  });
}
