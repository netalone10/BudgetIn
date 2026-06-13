import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { getValidToken } from "@/utils/token";
import { appendTransaction, getAccounts } from "@/utils/sheets";
import { blockDemoResponse } from "@/lib/demo-account";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { normalizeTransactionTime } from "@/lib/transaction-time";
import { invalidateDashboardCache } from "@/lib/cache";

/**
 * Wraps `after()` with a try-catch fallback for non-Next.js environments.
 */
function scheduleAfterRequest(fn: () => Promise<void>): void {
  try {
    after(fn);
  } catch {
    fn().catch((err) => console.error("[scheduleAfterRequest] fallback error:", err));
  }
}

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
  const useSheets = !!user?.sheetsId;

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

  // ── GOOGLE SHEETS PATH ────────────────────────────────────────────────────────
  if (useSheets) {
    let accessToken: string;
    try {
      accessToken = await getValidToken(session.userId);
    } catch {
      return NextResponse.json({ error: "Sesi expired. Silakan login ulang." }, { status: 401 });
    }

    const sheetsAccounts = await getAccounts(user!.sheetsId!, accessToken);
    const account = sheetsAccounts.find((a) => a.id === accountId);
    if (!account) {
      return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
    }

    const generatedId = randomUUID();
    const sheetsId = user!.sheetsId!;
    const trimmedNote = note?.trim() || `Kontribusi ke ${goal.name}`;
    const txTime = normalizeTransactionTime(undefined);

    // Upsert category "Tabungan" di Prisma
    await prisma.category.upsert({
      where: { userId_name: { userId, name: "Tabungan" } },
      update: {},
      create: { userId, name: "Tabungan", type: "expense" },
      select: { id: true },
    });

    // Sheets users normally have no prisma.transaction rows, but
    // SavingsContribution.transactionId carries a required FK to Transaction.
    // We persist a mirror Transaction in Prisma as the FK anchor (accountId left
    // null — the real account lives in Sheets and savings reads don't use it).
    // This also surfaces the contribution in the savings history/progress views.
    try {
      const contribution = await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
          data: {
            id: generatedId,
            userId,
            date,
            time: txTime,
            amount,
            category: "Tabungan",
            note: trimmedNote,
            type: "expense",
          },
        });
        return tx.savingsContribution.create({
          data: {
            userId,
            goalId: goal.id,
            transactionId: generatedId,
            amount: new Decimal(amount),
            date,
            note: note?.trim() ?? "",
          },
        });
      });

      // Only append to Sheets once the Prisma write succeeded (avoids orphan
      // rows in the sheet when the contribution fails to persist).
      scheduleAfterRequest(async () => {
        try {
          await appendTransaction(sheetsId, accessToken, {
            date,
            time: txTime,
            amount,
            category: "Tabungan",
            note: trimmedNote,
            type: "expense",
            fromAccountId: accountId,
            fromAccountName: account.name,
          });
        } catch (error) {
          const err = error as Error;
          console.error(
            `[contributions/route] sheets append failed: userId=${userId} transactionId=${generatedId} error=${err.message}`,
            { userId, transactionId: generatedId, errorMessage: err.message, errorStack: err.stack }
          );
        }
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
