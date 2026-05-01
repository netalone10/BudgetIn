import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { calcNextDueDate } from "@/utils/bill-utils";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { getAccounts } from "@/utils/sheets";
import { getValidToken } from "@/utils/token";

async function resolveAccountId(userId: string, accountId: unknown): Promise<string | null | undefined> {
  if (!accountId || typeof accountId !== "string") return null;

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (account) {
    if (account.userId !== userId || !account.isActive) return undefined;
    return account.id;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sheetsId: true },
  });
  if (!user?.sheetsId) return undefined;

  const accessToken = await getValidToken(userId);
  const sheetAccount = (await getAccounts(user.sheetsId, accessToken)).find((a) => a.id === accountId);
  if (!sheetAccount) return undefined;

  await ensureDefaultAccountTypes(userId);
  const typeName = sheetAccount.type || "Lainnya";
  const accountType = await prisma.accountType.upsert({
    where: { userId_name: { userId, name: typeName } },
    update: {},
    create: {
      userId,
      name: typeName,
      classification: sheetAccount.classification === "liability" ? "liability" : "asset",
      icon: "wallet",
      color: sheetAccount.color ?? "#6b7280",
      sortOrder: 100,
    },
  });

  const created = await prisma.account.create({
    data: {
      id: sheetAccount.id,
      userId,
      accountTypeId: accountType.id,
      name: sheetAccount.name,
      initialBalance: 0,
      currency: sheetAccount.currency || "IDR",
      color: sheetAccount.color,
      note: sheetAccount.note ?? "",
      tanggalSettlement: sheetAccount.tanggalSettlement,
      tanggalJatuhTempo: sheetAccount.tanggalJatuhTempo,
    },
  });

  return created.id;
}

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

  try {
    const body = await request.json();
    const { name, amount, dueDay, categoryId, accountId, autoRecord, reminderDays, note } = body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName) return NextResponse.json({ error: "Nama tagihan wajib diisi." }, { status: 400 });
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Nominal tidak valid." }, { status: 400 });
    }
    const day = parseInt(dueDay, 10);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return NextResponse.json({ error: "Tanggal jatuh tempo harus 1-31." }, { status: 400 });
    }

    const resolvedAccountId = await resolveAccountId(session.userId, accountId);
    if (resolvedAccountId === undefined) {
      return NextResponse.json({ error: "Akun pembayaran tidak valid." }, { status: 400 });
    }

    const nextDueDate = calcNextDueDate(day);

    const bill = await prisma.recurringBill.create({
      data: {
        userId: session.userId,
        name: trimmedName,
        amount: new Decimal(parsedAmount),
        dueDay: day,
        categoryId: categoryId || null,
        accountId: resolvedAccountId,
        autoRecord: Boolean(autoRecord),
        reminderDays: Array.isArray(reminderDays) ? reminderDays : [1],
        note: typeof note === "string" ? note.trim() || null : null,
        nextDueDate,
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error("[bills:POST]", error);
    return NextResponse.json({ error: "Gagal menyimpan tagihan." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, name, amount, dueDay, categoryId, accountId, autoRecord, reminderDays, note } = body;
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
    if (!trimmedName) return NextResponse.json({ error: "Nama tagihan wajib diisi." }, { status: 400 });

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

    const resolvedAccountId = await resolveAccountId(session.userId, accountId);
    if (resolvedAccountId === undefined) {
      return NextResponse.json({ error: "Akun pembayaran tidak valid." }, { status: 400 });
    }

    const nextDueDate = day !== existing.dueDay ? calcNextDueDate(day) : existing.nextDueDate;

    const bill = await prisma.recurringBill.update({
      where: { id },
      data: {
        name: trimmedName,
        amount: new Decimal(parsedAmount),
        dueDay: day,
        categoryId: categoryId || null,
        accountId: resolvedAccountId,
        autoRecord: Boolean(autoRecord),
        reminderDays: Array.isArray(reminderDays) ? reminderDays : existing.reminderDays,
        note: typeof note === "string" ? note.trim() || null : null,
        nextDueDate,
      },
      include: {
        category: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(bill);
  } catch (error) {
    console.error("[bills:PUT]", error);
    return NextResponse.json({ error: "Gagal menyimpan tagihan." }, { status: 500 });
  }
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
