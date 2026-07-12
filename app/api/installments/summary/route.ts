import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { computeInstallmentMeta, computeProjection, type InstallmentListItem } from "@/lib/installment-utils";

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toNumber" in v) return (v as Decimal).toNumber();
  return Number(v) || 0;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const installments = await prisma.recurringTransaction.findMany({
      where: {
        userId: session.userId,
        installmentTotal: { not: null },
        installmentTenor: { not: null },
        isActive: true,
      },
      include: {
        account: { select: { id: true, name: true } },
        liabilityAccount: { select: { id: true, name: true } },
      },
      orderBy: { nextDueDate: "asc" },
    });

    let totalMonthlyPayment = 0;
    let totalOutstanding = 0;
    const items: InstallmentListItem[] = [];

    for (const r of installments) {
      const total = toNum(r.installmentTotal);
      const tenor = r.installmentTenor ?? 0;
      const paid = r.installmentPaid ?? 0;
      const monthlyAmount = toNum(r.amount);
      const startDate = r.startDate instanceof Date ? r.startDate : new Date(r.startDate);

      if (tenor <= 0) continue;

      const meta = computeInstallmentMeta(total, tenor, paid, monthlyAmount, startDate);
      if (meta.remaining <= 0) continue;

      totalMonthlyPayment += monthlyAmount;
      totalOutstanding += meta.outstandingDebt;

      items.push({
        id: r.id,
        name: r.name,
        totalAmount: total,
        tenor,
        paid,
        remaining: meta.remaining,
        monthlyAmount,
        outstandingDebt: meta.outstandingDebt,
        progressPercent: meta.progressPercent,
        freedomDate: meta.freedomDate instanceof Date ? meta.freedomDate.toISOString() : "",
        startDate: startDate.toISOString(),
        source: r.installmentSource ?? null,
        liabilityAccountId: r.liabilityAccountId ?? null,
        nextDueDate: r.nextDueDate instanceof Date ? r.nextDueDate.toISOString() : String(r.nextDueDate),
        isActive: r.isActive,
      });
    }

    const projection = computeProjection(items, 12);

    return NextResponse.json({
      activeInstallments: items,
      summary: {
        totalMonthlyPayment,
        totalOutstanding,
        activeCount: items.length,
      },
      monthlyProjection: projection,
    });
  } catch (error) {
    console.error("[installments/summary:GET]", error);
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}
