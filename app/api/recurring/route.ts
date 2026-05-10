import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { getAccounts } from "@/utils/sheets";
import { getValidToken } from "@/utils/token";
import { blockDemoResponse } from "@/lib/demo-account";
import {
  calcNextOccurrence,
  RECURRING_FREQUENCIES,
  RECURRING_TYPES,
  type RecurringFrequency,
  type RecurringType,
} from "@/utils/recurring-utils";

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

const includeRelations = {
  category: { select: { id: true, name: true } },
  account: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
  savingsGoal: { select: { id: true, name: true } },
  occurrences: { orderBy: { occurredAt: "desc" as const }, take: 5 },
};

type Payload = {
  id?: string;
  name?: string;
  type?: string;
  amount?: unknown;
  frequency?: string;
  interval?: unknown;
  startDate?: string;
  endDate?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  toAccountId?: string | null;
  savingsGoalId?: string | null;
  autoRecord?: boolean;
  reminderDays?: number[];
  note?: string | null;
};

async function validateAndBuildData(userId: string, body: Payload, existingNextDue?: Date) {
  const trimmedName = typeof body.name === "string" ? body.name.trim() : "";
  if (!trimmedName) return { error: "Nama wajib diisi.", status: 400 } as const;

  const type = body.type as RecurringType;
  if (!RECURRING_TYPES.includes(type)) {
    return { error: "Tipe tidak valid.", status: 400 } as const;
  }

  const parsedAmount = Number(body.amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { error: "Nominal tidak valid.", status: 400 } as const;
  }

  const frequency = body.frequency as RecurringFrequency;
  if (!RECURRING_FREQUENCIES.includes(frequency)) {
    return { error: "Frekuensi tidak valid.", status: 400 } as const;
  }

  const interval = Math.floor(Number(body.interval ?? 1));
  if (!Number.isInteger(interval) || interval < 1 || interval > 999) {
    return { error: "Interval harus antara 1 dan 999.", status: 400 } as const;
  }

  if (!body.startDate) {
    return { error: "Tanggal mulai wajib diisi.", status: 400 } as const;
  }
  const startDate = new Date(body.startDate);
  if (Number.isNaN(startDate.getTime())) {
    return { error: "Tanggal mulai tidak valid.", status: 400 } as const;
  }

  let endDate: Date | null = null;
  if (body.endDate) {
    endDate = new Date(body.endDate);
    if (Number.isNaN(endDate.getTime())) {
      return { error: "Tanggal akhir tidak valid.", status: 400 } as const;
    }
    if (endDate < startDate) {
      return { error: "Tanggal akhir tidak boleh sebelum tanggal mulai.", status: 400 } as const;
    }
  }

  const accountId = await resolveAccountId(userId, body.accountId);
  if (accountId === undefined) return { error: "Akun tidak valid.", status: 400 } as const;

  let toAccountId: string | null | undefined = null;
  if (type === "transfer") {
    if (!accountId) return { error: "Akun sumber wajib diisi untuk transfer.", status: 400 } as const;
    toAccountId = await resolveAccountId(userId, body.toAccountId);
    if (!toAccountId) return { error: "Akun tujuan transfer tidak valid.", status: 400 } as const;
    if (toAccountId === accountId) {
      return { error: "Akun sumber dan tujuan tidak boleh sama.", status: 400 } as const;
    }
  }

  let savingsGoalId: string | null = null;
  if (body.savingsGoalId) {
    const goal = await prisma.savingsGoal.findUnique({ where: { id: String(body.savingsGoalId) } });
    if (!goal || goal.userId !== userId) {
      return { error: "Goal tabungan tidak ditemukan.", status: 400 } as const;
    }
    savingsGoalId = goal.id;
  }

  // Recompute next due if start date changed; else preserve existing.
  const nextDueDate =
    existingNextDue && existingNextDue.getTime() === startDate.getTime()
      ? existingNextDue
      : calcNextOccurrence(frequency, interval, startDate);

  return {
    data: {
      name: trimmedName,
      type,
      amount: new Decimal(parsedAmount),
      frequency,
      interval,
      startDate,
      endDate,
      nextDueDate,
      categoryId: body.categoryId || null,
      accountId: accountId ?? null,
      toAccountId: toAccountId ?? null,
      savingsGoalId,
      autoRecord: Boolean(body.autoRecord),
      reminderDays: Array.isArray(body.reminderDays) ? body.reminderDays.filter((n) => Number.isInteger(n)) : [1],
      note: typeof body.note === "string" ? body.note.trim() || null : null,
    },
  } as const;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.recurringTransaction.findMany({
    where: { userId: session.userId, isActive: true },
    include: includeRelations,
    orderBy: { nextDueDate: "asc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Payload;
    const result = await validateAndBuildData(session.userId, body);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const created = await prisma.recurringTransaction.create({
      data: { userId: session.userId, ...result.data },
      include: includeRelations,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[recurring:POST]", error);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Payload;
    if (!body.id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

    const existing = await prisma.recurringTransaction.findUnique({ where: { id: body.id } });
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
    }

    const result = await validateAndBuildData(session.userId, body, existing.nextDueDate);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const updated = await prisma.recurringTransaction.update({
      where: { id: body.id },
      data: result.data,
      include: includeRelations,
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("[recurring:PUT]", error);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });

  const existing = await prisma.recurringTransaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.userId) {
    return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
  }

  await prisma.recurringTransaction.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
