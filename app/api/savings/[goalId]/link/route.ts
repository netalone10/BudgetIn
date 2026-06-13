import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { getValidToken } from "@/utils/token";
import { getTransactionRow } from "@/utils/sheets";
import { blockDemoResponse } from "@/lib/demo-account";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { invalidateDashboardCache } from "@/lib/cache";

// POST — link an existing (unallocated) transaction to a savings goal
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

  const { goalId } = await params;
  const body = await req.json();
  const { transactionId } = body as { transactionId: string };

  if (!transactionId) {
    return NextResponse.json({ error: "transactionId wajib diisi" }, { status: 400 });
  }

  const userId = session.userId;

  // Verify goal ownership
  const goal = await prisma.savingsGoal.findFirst({
    where: { id: goalId, userId },
    select: { id: true, name: true },
  });
  if (!goal) {
    return NextResponse.json({ error: "Goal tidak ditemukan" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sheetsId: true },
  });

  // ── GOOGLE SHEETS PATH ────────────────────────────────────────────────────────
  // The transaction lives in Sheets, not Prisma. Fetch it, then persist a mirror
  // Transaction (same id) + SavingsContribution so the allocation shows up in the
  // savings progress/history. The Sheets row itself is untouched, so account
  // balances and reports stay consistent.
  if (user?.sheetsId) {
    let accessToken: string;
    try {
      accessToken = await getValidToken(userId);
    } catch {
      return NextResponse.json({ error: "Sesi expired. Silakan login ulang." }, { status: 401 });
    }

    const row = await getTransactionRow(user.sheetsId, accessToken, transactionId);
    if (!row || row.type !== "expense") {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    }

    const existing = await prisma.savingsContribution.findUnique({
      where: { transactionId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Transaksi ini sudah dialokasikan ke goal lain" },
        { status: 409 }
      );
    }

    try {
      const contribution = await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            id: transactionId,
            userId,
            date: row.date,
            time: row.time ?? "00:00",
            amount: row.amount,
            category: row.category,
            note: row.note ?? "",
            type: "expense",
          },
        });
        return tx.savingsContribution.create({
          data: {
            userId,
            goalId: goal.id,
            transactionId,
            amount: new Decimal(row.amount),
            date: row.date,
            note: row.note ?? "",
          },
        });
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

  // ── PRISMA / EMAIL PATH ───────────────────────────────────────────────────────
  // Verify transaction ownership and type
  const transaction = await prisma.transaction.findFirst({
    where: { id: transactionId, userId, type: "expense" },
    select: { id: true, amount: true, date: true, note: true },
  });
  if (!transaction) {
    return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
  }

  // Check not already linked
  const existing = await prisma.savingsContribution.findUnique({
    where: { transactionId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Transaksi ini sudah dialokasikan ke goal lain" },
      { status: 409 }
    );
  }

  try {
    const contribution = await prisma.savingsContribution.create({
      data: {
        userId,
        goalId: goal.id,
        transactionId: transaction.id,
        amount: new Decimal(transaction.amount),
        date: transaction.date,
        note: transaction.note ?? "",
      },
    });

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
