import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, startOfDay, format } from "date-fns";
import { sendBillReminderEmail } from "@/lib/email";
import { appendBillPaymentToSheet } from "@/utils/sheets-bills";
import { getValidToken } from "@/utils/token";
import { calcNextDueDate } from "@/utils/bill-utils";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = startOfDay(new Date());
  const results: { remindersSent: number; autoRecorded: number; errors: { billId: string; error: string }[] } = {
    remindersSent: 0,
    autoRecorded: 0,
    errors: [],
  };

  // ── 1. Reminders ─────────────────────────────────────────────────────────────
  const checkDays = [1, 3, 7, 14];
  const dueDates = checkDays.map((d) => addDays(today, d));

  const billsToRemind = await prisma.recurringBill.findMany({
    where: {
      isActive: true,
      nextDueDate: { in: dueDates },
    },
    include: { user: { select: { email: true, name: true } } },
  });

  for (const bill of billsToRemind) {
    const daysUntil = Math.round(
      (startOfDay(bill.nextDueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (!bill.reminderDays.includes(daysUntil)) continue;
    try {
      await sendBillReminderEmail({
        to: bill.user.email!,
        billName: bill.name,
        amount: bill.amount.toNumber(),
        dueDate: bill.nextDueDate,
        daysUntil,
      });
      results.remindersSent++;
    } catch (err) {
      results.errors.push({ billId: bill.id, error: String(err) });
    }
  }

  // ── 2. Auto-record ────────────────────────────────────────────────────────────
  const billsDueToday = await prisma.recurringBill.findMany({
    where: {
      isActive: true,
      autoRecord: true,
      nextDueDate: { gte: today, lt: addDays(today, 1) },
    },
    include: {
      user: { select: { id: true, email: true, name: true, sheetsId: true } },
      category: true,
      account: true,
    },
  });

  for (const bill of billsDueToday) {
    const paymentMonth = format(today, "yyyy-MM");
    try {
      const existingPayment = await prisma.billPayment.findUnique({
        where: { billId_paymentMonth: { billId: bill.id, paymentMonth } },
      });
      if (existingPayment) continue;

      let transactionId: string | null = null;
      const dateStr = format(today, "yyyy-MM-dd");

      if (bill.user.sheetsId) {
        const accessToken = await getValidToken(bill.userId);
        await appendBillPaymentToSheet(bill.user.sheetsId, accessToken, {
          date: today,
          amount: bill.amount.toNumber(),
          category: bill.category?.name ?? "Tagihan",
          type: "expense",
          note: `Pembayaran ${bill.name} (auto)`,
          account: bill.account?.name ?? "Cash",
          fromAccountId: bill.accountId ?? undefined,
        });
      } else {
        if (bill.accountId) {
          const tx = await prisma.transaction.create({
            data: {
              userId: bill.userId,
              accountId: bill.accountId,
              type: "expense",
              amount: bill.amount,
              category: bill.category?.name ?? "Tagihan",
              date: dateStr,
              note: `Pembayaran ${bill.name} (auto)`,
            },
          });
          transactionId = tx.id;
        }
      }

      const nextDueDate = calcNextDueDate(bill.dueDay, today);

      await prisma.$transaction([
        prisma.billPayment.create({
          data: {
            billId: bill.id,
            transactionId,
            paidAt: today,
            amount: bill.amount,
            paymentMonth,
            note: "Auto-recorded",
          },
        }),
        prisma.recurringBill.update({
          where: { id: bill.id },
          data: { lastPaidAt: today, nextDueDate },
        }),
      ]);

      results.autoRecorded++;
    } catch (err) {
      results.errors.push({ billId: bill.id, error: String(err) });
    }
  }

  return Response.json(results);
}
