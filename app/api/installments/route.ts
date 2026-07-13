import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { addMonths, format } from "date-fns";
import { getValidToken } from "@/utils/token";
import { appendAccount, appendTransaction } from "@/utils/sheets";
import { blockDemoResponse } from "@/lib/demo-account";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { invalidateDashboardCache } from "@/lib/cache";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { computeInstallmentMeta, type InstallmentListItem } from "@/lib/installment-utils";
import { calcNextOccurrence, occurrenceKey } from "@/utils/recurring-utils";

const includeRelations = {
  category: { select: { id: true, name: true } },
  account: { select: { id: true, name: true } },
  toAccount: { select: { id: true, name: true } },
  liabilityAccount: { select: { id: true, name: true } },
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
    liabilityAccountId: r.liabilityAccountId ?? null,
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

    const monthlyAmount = Math.ceil(parsedTotal / parsedTenor);
    const installmentTotal = new Decimal(parsedTotal);

    // Start date: 1st of startMonth, first payment is next month
    const [yearStr, monthStr] = startMonth.split("-");
    const startDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    if (Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Bulan mulai tidak valid." }, { status: 400 });
    }
    const dateStr = format(startDate, "yyyy-MM-dd");

    // Load user to detect storage type
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { sheetsId: true },
    });
    const isSheetsUser = !!user?.sheetsId;

    // Resolve source account
    const sourceAccount = await prisma.account.findFirst({
      where: { id: sourceAccountId, userId: session.userId, isActive: true },
    });
    if (!sourceAccount && !isSheetsUser) {
      return NextResponse.json({ error: "Akun sumber tidak ditemukan." }, { status: 400 });
    }

    let liabilityAccountId: string;
    let liabilityAccountName: string;
    let initialTxId: string | null = null;

    if (isSheetsUser) {
      let accessToken: string;
      try {
        accessToken = await getValidToken(session.userId);
      } catch {
        return NextResponse.json({ error: "Sesi Google expired." }, { status: 401 });
      }

      // Create liability account in Sheets
      const liabilityAccount = await appendAccount(user!.sheetsId!, accessToken, {
        name: `Cicilan ${trimmedName}`,
        type: "Hutang",
        classification: "liability",
        balance: 0,
        currency: "IDR",
        color: "#ef4444",
        note: `Cicilan ${trimmedName} - ${parsedTenor}x`,
        tanggalSettlement: null,
        tanggalJatuhTempo: null,
        creditLimit: null,
        billingCycleDay: null,
      });
      liabilityAccountId = liabilityAccount.id;
      liabilityAccountName = liabilityAccount.name;

      // Mirror liability account in Postgres
      await ensureDefaultAccountTypes(session.userId);
      const hutangType = await prisma.accountType.upsert({
        where: { userId_name: { userId: session.userId, name: "Hutang" } },
        update: {},
        create: {
          userId: session.userId,
          name: "Hutang",
          classification: "liability",
          icon: "credit-card",
          color: "#ef4444",
          sortOrder: 90,
        },
      });

      await prisma.account.create({
        data: {
          id: liabilityAccountId,
          userId: session.userId,
          accountTypeId: hutangType.id,
          name: liabilityAccountName,
          initialBalance: 0,
          currency: "IDR",
          color: "#ef4444",
          note: `Cicilan ${trimmedName} - ${parsedTenor}x`,
        },
      });

      // Mirror source account to Postgres if missing (FK requirement)
      if (sourceAccountId) {
        const existingSource = await prisma.account.findUnique({ where: { id: sourceAccountId } });
        if (!existingSource) {
          const { getAccounts: getSheetAccounts } = await import("@/utils/sheets");
          const sheetSource = (await getSheetAccounts(user!.sheetsId!, accessToken)).find(a => a.id === sourceAccountId);
          if (sheetSource) {
            const sourceType = await prisma.accountType.upsert({
              where: { userId_name: { userId: session.userId, name: sheetSource.type || "Lainnya" } },
              update: {},
              create: {
                userId: session.userId,
                name: sheetSource.type || "Lainnya",
                classification: sheetSource.classification === "liability" ? "liability" : "asset",
                icon: "wallet",
                color: sheetSource.color ?? "#6b7280",
                sortOrder: 100,
              },
            });
            await prisma.account.create({
              data: {
                id: sheetSource.id,
                userId: session.userId,
                accountTypeId: sourceType.id,
                name: sheetSource.name,
                initialBalance: 0,
                currency: sheetSource.currency || "IDR",
                color: sheetSource.color,
                note: sheetSource.note ?? "",
                tanggalSettlement: sheetSource.tanggalSettlement,
                tanggalJatuhTempo: sheetSource.tanggalJatuhTempo,
                creditLimit: sheetSource.creditLimit ?? null,
                billingCycleDay: sheetSource.billingCycleDay ?? null,
              },
            });
          } else {
            return NextResponse.json({ error: "Akun sumber tidak ditemukan." }, { status: 400 });
          }
        }
      }

      // Create initial expense in Sheets (TOTAL amount, not monthly)
      const appended = await appendTransaction(user!.sheetsId!, accessToken, {
        date: dateStr,
        amount: parsedTotal,
        category: "Cicilan",
        note: `${trimmedName} (pembelian cicilan ${parsedTenor}x)`,
        type: "expense",
        fromAccountId: sourceAccountId,
        fromAccountName: sourceAccount?.name,
        toAccountId: liabilityAccountId,
        toAccountName: liabilityAccountName,
      });
      initialTxId = appended.id;

      // Mirror transaction in Postgres
      await prisma.transaction.create({
        data: {
          id: initialTxId,
          userId: session.userId,
          date: dateStr,
          amount: new Decimal(parsedTotal),
          category: "Cicilan",
          note: `${trimmedName} (pembelian cicilan ${parsedTenor}x)`,
          type: "expense",
          accountId: sourceAccountId,
        },
      });
    } else {
      // DB path: create liability account
      await ensureDefaultAccountTypes(session.userId);
      const hutangType = await prisma.accountType.upsert({
        where: { userId_name: { userId: session.userId, name: "Hutang" } },
        update: {},
        create: {
          userId: session.userId,
          name: "Hutang",
          classification: "liability",
          icon: "credit-card",
          color: "#ef4444",
          sortOrder: 90,
        },
      });

      const liabilityAccount = await prisma.account.create({
        data: {
          userId: session.userId,
          accountTypeId: hutangType.id,
          name: `Cicilan ${trimmedName}`,
          initialBalance: 0,
          currency: "IDR",
          color: "#ef4444",
          note: `Cicilan ${trimmedName} - ${parsedTenor}x`,
        },
      });
      liabilityAccountId = liabilityAccount.id;
      liabilityAccountName = liabilityAccount.name;

      // Initial expense: transfer from source to liability (TOTAL amount)
      const transferId = randomUUID();
      const out = await prisma.transaction.create({
        data: {
          userId: session.userId,
          accountId: sourceAccountId,
          type: "transfer_out",
          amount: new Decimal(parsedTotal),
          category: "Cicilan",
          date: dateStr,
          note: `${trimmedName} (pembelian cicilan ${parsedTenor}x)`,
          transferId,
        },
      });
      await prisma.transaction.create({
        data: {
          userId: session.userId,
          accountId: liabilityAccountId,
          type: "transfer_in",
          amount: new Decimal(parsedTotal),
          category: "Cicilan",
          date: dateStr,
          note: `${trimmedName} (pembelian cicilan ${parsedTenor}x)`,
          transferId,
        },
      });
      initialTxId = out.id;
    }

    // Create recurring transaction — starts NEXT month
    const nextDueDate = calcNextOccurrence("monthly", 1, startDate);

    const recurring = await prisma.recurringTransaction.create({
      data: {
        userId: session.userId,
        name: trimmedName,
        type: "expense",
        amount: new Decimal(monthlyAmount),
        frequency: "monthly",
        interval: 1,
        startDate,
        nextDueDate,
        endDate: addMonths(startDate, parsedTenor),
        accountId: sourceAccountId,
        liabilityAccountId,
        installmentTotal,
        installmentTenor: parsedTenor,
        installmentPaid: 0, // first payment will be when recurring runs
        installmentSource: source ?? null,
        categoryId: categoryId || null,
        autoRecord: false,
        reminderDays: [1],
        note: note ?? null,
      },
      include: includeRelations,
    });

    invalidateDashboardCache(session.userId);

    const serialized = serializeInstallment(recurring);
    return NextResponse.json({
      recurring: serialized,
      liabilityAccount: { id: liabilityAccountId, name: liabilityAccountName },
      initialTransaction: { id: initialTxId },
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
