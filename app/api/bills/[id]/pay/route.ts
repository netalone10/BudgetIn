import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { format } from "date-fns";
import { calcNextDueDate } from "@/utils/bill-utils";
import { getValidToken } from "@/utils/token";
import { appendBillPaymentToSheet } from "@/utils/sheets-bills";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const bill = await prisma.recurringBill.findUnique({
    where: { id },
    include: { category: true, account: true, user: true },
  });
  if (!bill || bill.userId !== session.userId) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
  }

  const body = await request.json();
  const paidAmount = body.amount ? Number(body.amount) : bill.amount.toNumber();
  const noteOverride: string = body.note ?? `Pembayaran ${bill.name}`;
  const accountId: string | null = body.accountId ?? bill.accountId;

  const today = new Date();
  const paymentMonth = format(today, "yyyy-MM");

  const existing = await prisma.billPayment.findUnique({
    where: { billId_paymentMonth: { billId: id, paymentMonth } },
  });
  if (existing) {
    return NextResponse.json({ error: "Tagihan bulan ini sudah dibayar." }, { status: 409 });
  }

  const dateStr = format(today, "yyyy-MM-dd");
  let transactionId: string | null = null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (user?.sheetsId) {
    const accessToken = await getValidToken(session.userId);
    await appendBillPaymentToSheet(user.sheetsId, accessToken, {
      date: today,
      amount: paidAmount,
      category: bill.category?.name ?? "Tagihan",
      type: "expense",
      note: noteOverride,
      account: bill.account?.name ?? "Cash",
      fromAccountId: accountId ?? undefined,
    });
  } else {
    if (!accountId) {
      return NextResponse.json({ error: "Akun harus dipilih untuk mencatat pembayaran." }, { status: 400 });
    }
    const tx = await prisma.transaction.create({
      data: {
        userId: session.userId,
        accountId,
        type: "expense",
        amount: new Decimal(paidAmount),
        category: bill.category?.name ?? "Tagihan",
        date: dateStr,
        note: noteOverride,
      },
    });
    transactionId = tx.id;
  }

  const nextDueDate = calcNextDueDate(bill.dueDay, today);

  await prisma.$transaction([
    prisma.billPayment.create({
      data: {
        billId: id,
        transactionId,
        paidAt: today,
        amount: new Decimal(paidAmount),
        paymentMonth,
        note: noteOverride,
      },
    }),
    prisma.recurringBill.update({
      where: { id },
      data: { lastPaidAt: today, nextDueDate },
    }),
  ]);

  return NextResponse.json({ success: true, nextDueDate });
}
