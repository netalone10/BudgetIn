import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { calcNextDueDate } from "@/utils/bill-utils";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bills = await prisma.recurringBill.findMany({
    where: { userId: session.userId, isActive: true },
    include: {
      category: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      payments: { orderBy: { paidAt: "desc" }, take: 1 },
    },
    orderBy: { nextDueDate: "asc" },
  });

  return NextResponse.json(bills);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, amount, dueDay, categoryId, accountId, autoRecord, reminderDays, note } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Nama tagihan wajib diisi." }, { status: 400 });
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Nominal tidak valid." }, { status: 400 });
  }
  const day = parseInt(dueDay, 10);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: "Tanggal jatuh tempo harus 1-31." }, { status: 400 });
  }

  const nextDueDate = calcNextDueDate(day);

  const bill = await prisma.recurringBill.create({
    data: {
      userId: session.userId,
      name: name.trim(),
      amount: new Decimal(parsedAmount),
      dueDay: day,
      categoryId: categoryId || null,
      accountId: accountId || null,
      autoRecord: Boolean(autoRecord),
      reminderDays: Array.isArray(reminderDays) ? reminderDays : [1],
      note: note?.trim() || null,
      nextDueDate,
    },
    include: {
      category: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(bill, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, name, amount, dueDay, categoryId, accountId, autoRecord, reminderDays, note } = body;

  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const existing = await prisma.recurringBill.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "Nominal tidak valid." }, { status: 400 });
  }
  const day = parseInt(dueDay, 10);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return NextResponse.json({ error: "Tanggal jatuh tempo harus 1-31." }, { status: 400 });
  }

  const nextDueDate = day !== existing.dueDay ? calcNextDueDate(day) : existing.nextDueDate;

  const bill = await prisma.recurringBill.update({
    where: { id },
    data: {
      name: name.trim(),
      amount: new Decimal(parsedAmount),
      dueDay: day,
      categoryId: categoryId || null,
      accountId: accountId || null,
      autoRecord: Boolean(autoRecord),
      reminderDays: Array.isArray(reminderDays) ? reminderDays : existing.reminderDays,
      note: note?.trim() || null,
      nextDueDate,
    },
    include: {
      category: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(bill);
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const existing = await prisma.recurringBill.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
  }

  await prisma.recurringBill.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ success: true });
}
