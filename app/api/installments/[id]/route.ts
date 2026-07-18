import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { randomUUID } from "crypto";
import { blockDemoResponse } from "@/lib/demo-account";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { invalidateDashboardCache } from "@/lib/cache";
import { computeInstallmentMeta, type InstallmentListItem } from "@/lib/installment-utils";

const includeRelations = {
  category: { select: { id: true, name: true } },
  account: { select: { id: true, name: true } },
  savingsGoal: { select: { id: true, name: true } },
  occurrences: { orderBy: { occurredAt: "desc" as const }, take: 50 },
};

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toNumber" in v) return (v as Decimal).toNumber();
  return Number(v) || 0;
}

function serializeDetail(r: any, syncedAccounting = false) {
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
    endDate: r.endDate instanceof Date ? r.endDate.toISOString() : r.endDate,
    source: r.installmentSource ?? null,
    isActive: r.isActive,
    note: r.note,
    toAccountId: r.toAccountId ?? null,
    syncedAccounting,
    account: r.account,
    category: r.category,
    occurrences: (r.occurrences ?? []).map((o: any) => ({
      id: o.id,
      occurredAt: o.occurredAt instanceof Date ? o.occurredAt.toISOString() : o.occurredAt,
      amount: toNum(o.amount),
      occurrenceKey: o.occurrenceKey,
      note: o.note,
    })),
  };
}

async function getSyncedAccounting(userId: string, recurringId: string): Promise<boolean> {
  const count = await prisma.transaction.count({
    where: {
      userId,
      note: { contains: `[installment:${recurringId}]` },
    },
  });
  return count > 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const r = await prisma.recurringTransaction.findUnique({
      where: { id },
      include: includeRelations,
    });

    if (!r || r.userId !== session.userId) {
      return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
    }

    if (!r.installmentTotal || !r.installmentTenor) {
      return NextResponse.json({ error: "Bukan cicilan." }, { status: 400 });
    }

    const syncedAccounting = await getSyncedAccounting(session.userId, r.id);
    return NextResponse.json(serializeDetail(r, syncedAccounting));
  } catch (error) {
    console.error("[installments/[id]:GET]", error);
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.recurringTransaction.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
    }

    if (!existing.installmentTotal || !existing.installmentTenor) {
      return NextResponse.json({ error: "Bukan cicilan." }, { status: 400 });
    }

    const body = await request.json();
    const updateData: { name?: string; note?: string | null } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    if (body.note !== undefined) {
      updateData.note = typeof body.note === "string" ? body.note.trim() || null : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Tidak ada perubahan." }, { status: 400 });
    }

    const updated = await prisma.recurringTransaction.update({
      where: { id },
      data: updateData,
      include: includeRelations,
    });

    invalidateDashboardCache(session.userId);
    return NextResponse.json(serializeDetail(updated));
  } catch (error) {
    console.error("[installments/[id]:PATCH]", error);
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.recurringTransaction.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
    }

    if (!existing.installmentTotal || !existing.installmentTenor) {
      return NextResponse.json({ error: "Bukan cicilan." }, { status: 400 });
    }

    // Deactivate recurring
    await prisma.recurringTransaction.update({
      where: { id },
      data: { isActive: false },
    });

    invalidateDashboardCache(session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[installments/[id]:DELETE]", error);
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}

// ── POST — sync cicilan ke akuntansi ────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const r = await prisma.recurringTransaction.findUnique({
      where: { id },
    });

    if (!r || r.userId !== session.userId) {
      return NextResponse.json({ error: "Tidak ditemukan." }, { status: 404 });
    }
    if (!r.installmentTotal || !r.installmentTenor) {
      return NextResponse.json({ error: "Bukan cicilan." }, { status: 400 });
    }

    // Check if already synced
    const alreadySynced = await getSyncedAccounting(session.userId, r.id);
    if (alreadySynced) {
      return NextResponse.json({ error: "Sudah tersinkronisasi." }, { status: 409 });
    }

    const dateStr = r.startDate instanceof Date
      ? r.startDate.toISOString().slice(0, 10)
      : new Date(r.startDate).toISOString().slice(0, 10);
    const categoryLabel = `[Cicilan] ${r.name}`;
    const noteLabel = `[installment:${r.id}]`;
    const total = r.installmentTotal;

    if (r.toAccountId) {
      // Transfer type
      const sharedTransferId = randomUUID();
      await prisma.$transaction([
        prisma.transaction.create({
          data: {
            userId: session.userId,
            date: dateStr,
            amount: total,
            category: categoryLabel,
            note: noteLabel,
            type: "transfer_out",
            accountId: r.accountId,
            transferId: sharedTransferId,
          },
        }),
        prisma.transaction.create({
          data: {
            userId: session.userId,
            date: dateStr,
            amount: total,
            category: categoryLabel,
            note: noteLabel,
            type: "transfer_in",
            accountId: r.toAccountId,
            transferId: sharedTransferId,
          },
        }),
      ]);
    } else {
      // Expense type (default for legacy cicilan without toAccountId)
      await prisma.transaction.create({
        data: {
          userId: session.userId,
          date: dateStr,
          amount: total,
          category: categoryLabel,
          note: noteLabel,
          type: "expense",
          accountId: r.accountId,
        },
      });
    }

    invalidateDashboardCache(session.userId);
    return NextResponse.json({ success: true, syncedAccounting: true }, { status: 201 });
  } catch (error) {
    console.error("[installments/[id]:POST:sync]", error);
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}
