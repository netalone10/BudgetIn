import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcNextDueDate } from "@/utils/bill-utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const bill = await prisma.recurringBill.findUnique({ where: { id } });
  if (!bill || bill.userId !== session.userId) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
  }

  const today = new Date();
  const nextDueDate = calcNextDueDate(bill.dueDay, today);

  await prisma.recurringBill.update({
    where: { id },
    data: { nextDueDate },
  });

  return NextResponse.json({ success: true, nextDueDate });
}
