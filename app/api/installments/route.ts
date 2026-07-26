import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { addMonths } from "date-fns";
import { blockDemoResponse } from "@/lib/demo-account";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { invalidateDashboardCache } from "@/lib/cache";
import { computeInstallmentMeta, type InstallmentListItem } from "@/lib/installment-utils";
import { calcNextOccurrence } from "@/utils/recurring-utils";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { randomUUID } from "crypto";
import { appendTransaction } from "@/utils/sheets";
import { getValidToken } from "@/utils/token";
import { currentJakartaTime } from "@/lib/transaction-time";

/**
 * Ensure an account exists in Prisma before creating FK-dependent records.
 * For Google Sheets users, account IDs come from Sheets and don't exist in Postgres.
 * This mirrors the account to Prisma if missing.
 */
async function ensureAccountInPrisma(userId: string, accountId: string): Promise<void> {
  const existing = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (existing) return; // already in Prisma

  // Not in Prisma — check if user is a Sheets user, try to read account from Sheets
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sheetsId: true },
  });

  // Find a fallback asset account type for this user
  await ensureDefaultAccountTypes(userId);
  const fallbackType = await prisma.accountType.findFirst({
    where: { userId, isActive: true, classification: "asset" },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  if (!fallbackType) return; // can't create without a type

  await prisma.account.create({
    data: {
      id: accountId,
      userId,
      accountTypeId: fallbackType.id,
      name: "Akun (tersync)",
      initialBalance: 0,
      currency: "IDR",
      note: "Auto-mirrored from Google Sheets for installment tracking",
    },
  });
}

const includeRelations = {
  category: { select: { id: true, name: true } },
  account: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
  savingsGoal: { select: { id: true, name: true } },
  occurrences: { orderBy: { occurredAt: "desc" as const }, take: 5 },
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toNumber" in v) return (v as Decimal).toNumber();
  return Number(v) || 0;
}

function serializeInstallment(r: any): InstallmentListItem {
  const total = toNum(r.installmentTotal);
  const tenor = r.installmentTenor ?? 0;
  const paid = r.installmentPaid ?? 0;
  const monthlyAmount = toNum(r.amount);
  const startDate = r.startDate instanceof Date ? r.startDate : new Date(r.startDate);
  const meta = tenor > 0 ? computeInstallmentMeta(total, tenor, paid, monthlyAmount, startDate) : null;

  return {
    id: r.id,
    name: r.name,
    totalAmount: total,
    tenor,
    paid,
    remaining: meta?.remaining ?? 0,
    monthlyAmount,
    outstandingDebt: meta?.outstandingDebt ?? 0,
    progressPercent: meta?.progressPercent ?? 0,
    freedomDate: meta?.freedomDate instanceof Date ? meta.freedomDate.toISOString() : "",
    startDate: startDate.toISOString(),
    source: r.installmentSource ?? null,
    nextDueDate: r.nextDueDate instanceof Date ? r.nextDueDate.toISOString() : String(r.nextDueDate),
    isActive: r.isActive,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.recurringTransaction.findMany({
    where: {
      userId: session.userId,
      installmentTotal: { not: null },
      installmentTenor: { not: null },
      isActive: true,
    },
    include: includeRelations,
    orderBy: { createdAt: "desc" },
  });

  const data = items.map(serializeInstallment);
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      name,
      totalAmount,
      tenor,
      startMonth, // "YYYY-MM" format
      sourceAccountId,
      categoryId,
      source,
      note,
      transactionType,
      targetAccountId,
    } = body;

    // Validate
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) return NextResponse.json({ error: "Nama wajib diisi." }, { status: 400 });

    const parsedTotal = Number(totalAmount);
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
      return NextResponse.json({ error: "Total harga tidak valid." }, { status: 400 });
    }

    const parsedTenor = Math.floor(Number(tenor));
    if (!Number.isInteger(parsedTenor) || parsedTenor < 1 || parsedTenor > 360) {
      return NextResponse.json({ error: "Tenor harus antara 1 dan 360." }, { status: 400 });
    }

    if (!startMonth) return NextResponse.json({ error: "Bulan mulai wajib diisi." }, { status: 400 });
    if (!sourceAccountId) return NextResponse.json({ error: "Akun sumber wajib diisi." }, { status: 400 });
    if (transactionType === "transfer" && !targetAccountId) {
      return NextResponse.json({ error: "Akun tujuan wajib dipilih untuk tipe transfer." }, { status: 400 });
    }

    const monthlyAmount = Math.ceil(parsedTotal / parsedTenor);
    const installmentTotal = new Decimal(parsedTotal);

    // Start date: 1st of startMonth, first payment is next month
    const [yearStr, monthStr] = startMonth.split("-");
    const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Bulan mulai tidak valid." }, { status: 400 });
    }

    // Ensure account exists in Prisma (Google Sheets users have accounts only in Sheets)
    await ensureAccountInPrisma(session.userId, sourceAccountId);

    // For transfer type, ensure target account exists in Prisma too
    if (transactionType === "transfer" && targetAccountId) {
      await ensureAccountInPrisma(session.userId, targetAccountId);
    }

    // Create recurring transaction — starts NEXT month
    const nextDueDate = calcNextOccurrence("monthly", 1, startDate);

    const recurring = await prisma.recurringTransaction.create({
      data: {
        userId: session.userId,
        name: trimmedName,
        type: transactionType === "transfer" ? "transfer" : "expense",
        amount: new Decimal(monthlyAmount),
        frequency: "monthly",
        interval: 1,
        startDate,
        nextDueDate,
        endDate: addMonths(startDate, parsedTenor),
        accountId: sourceAccountId,
        toAccountId: transactionType === "transfer" && targetAccountId ? targetAccountId : null,
        installmentTotal,
        installmentTenor: parsedTenor,
        installmentPaid: 0,
        installmentSource: source ?? null,
        categoryId: categoryId || null,
        autoRecord: false,
        reminderDays: [1],
        note: note ?? null,
      },
      include: includeRelations,
    });
    // ── Create accounting transactions ──────────────────────────────────
    const dateStr = startDate.toISOString().slice(0, 10);
    const categoryLabel = `[Cicilan] ${trimmedName}`;
    const noteLabel = `[installment:${recurring.id}]`;

    // Check if Sheets user
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { sheetsId: true },
    });
    const isSheetsUser = !!user?.sheetsId;

    if (transactionType === "recorded") {
      // Sudah Tercatat: no accounting transaction, just tracking
    } else if (transactionType === "expense" || !transactionType) {
      // Legacy (no type) creates nothing; explicit expense creates entry
      if (transactionType === "expense") {
        await prisma.transaction.create({
          data: {
            userId: session.userId,
            date: dateStr,
            amount: installmentTotal,
            category: categoryLabel,
            note: noteLabel,
            type: "expense",
            accountId: sourceAccountId,
          },
        });
        // Also write to Sheets for Sheets users
        if (isSheetsUser) {
          const accessToken = await getValidToken(session.userId);
          const time = currentJakartaTime();
          await appendTransaction(user!.sheetsId!, accessToken, {
            date: dateStr, time, amount: installmentTotal.toNumber(),
            category: categoryLabel, note: noteLabel, type: "expense",
            fromAccountId: sourceAccountId,
          });
        }
      }
    } else if (transactionType === "transfer" && targetAccountId) {
      const sharedTransferId = randomUUID();
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            userId: session.userId, date: dateStr, amount: installmentTotal,
            category: categoryLabel, note: noteLabel,
            type: "transfer_out", accountId: sourceAccountId, transferId: sharedTransferId,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: session.userId, date: dateStr, amount: installmentTotal,
            category: categoryLabel, note: noteLabel,
            type: "transfer_in", accountId: targetAccountId, transferId: sharedTransferId,
          },
        }),
      ]);
      // Also write to Sheets for Sheets users
      if (isSheetsUser) {
        const accessToken = await getValidToken(session.userId);
        const time = currentJakartaTime();
        const amt = installmentTotal.toNumber();
        // Single row with both from + to accounts
        await appendTransaction(user!.sheetsId!, accessToken, {
          date: dateStr, time, amount: amt,
          category: categoryLabel, note: noteLabel, type: "expense",
          fromAccountId: sourceAccountId,
          toAccountId: targetAccountId,
        });
      }
    }

    invalidateDashboardCache(session.userId);

    const serialized = serializeInstallment(recurring);
    return NextResponse.json({
      recurring: serialized,
    }, { status: 201 });
  } catch (error) {
    console.error("[installments:POST]", error);
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}
