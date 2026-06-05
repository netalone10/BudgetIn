import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { blockDemoResponse } from "@/lib/demo-account";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { normalizeTransactionTime } from "@/lib/transaction-time";
import { invalidateDashboardCache } from "@/lib/cache";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ goalId: string }> }
) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });
  if (user?.sheetsId) {
    return NextResponse.json(
      { error: "Kontribusi manual belum didukung untuk akun Google Sheets. Gunakan AI input." },
      { status: 400 }
    );
  }

  const { goalId } = await params;
  const body = await req.json();
  const { amount, accountId, date, note } = body as {
    amount: number;
    accountId: string;
    date: string;
    note?: string;
  };

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Jumlah harus lebih dari 0" }, { status: 400 });
  }
  if (!accountId) {
    return NextResponse.json({ error: "Akun sumber wajib dipilih" }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  }

  const userId = session.userId;

  const goal = await prisma.savingsGoal.findFirst({
    where: { id: goalId, userId },
    select: { id: true, name: true },
  });
  if (!goal) {
    return NextResponse.json({ error: "Goal tidak ditemukan" }, { status: 404 });
  }

  const account = await prisma.accountType.findFirst({
    where: { id: accountId, userId, isActive: true },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  try {
    const { contribution } = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          id: randomUUID(),
          userId,
          date,
          time: normalizeTransactionTime(undefined),
          amount,
          category: "Tabungan",
          note: note?.trim() || `Kontribusi ke ${goal.name}`,
          type: "expense",
          accountId,
        },
      });

      const contribution = await tx.savingsContribution.create({
        data: {
          userId,
          goalId: goal.id,
          transactionId: transaction.id,
          amount: new Decimal(amount),
          date,
          note: note?.trim() ?? "",
        },
      });

      return { contribution };
    });

    invalidateDashboardCache(userId);

    return NextResponse.json({
      contribution: {
        id: contribution.id,
        transactionId: contribution.transactionId,
        amount: contribution.amount.toNumber(),
        date: contribution.date,
        note: contribution.note,
      },
    });
  } catch (error) {
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}
