import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Helper: Hitung perioda Kartu Kredit berdasarkan tanggal settlement
 * Perioda bulan ini: mulai dari (tanggalSettlement-1) bulan sebelumnya hingga tanggalSettlement bulan berjalan
 */
function getCreditCardPeriod(settlementDate: number, targetMonth: number, targetYear: number) {
  // Mulai: tanggalSettlement - 1 hari di bulan sebelumnya
  const start = new Date(targetYear, targetMonth - 1, settlementDate);
  start.setDate(start.getDate() - 1); // mundur 1 hari
  start.setHours(0, 0, 0, 0);

  // Akhir: tanggalSettlement bulan berjalan
  const end = new Date(targetYear, targetMonth - 1, settlementDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Helper: Hitung jatuh tempo (bulan berikutnya setelah perioda berakhir)
 */
function getDueDate(settlementDate: number, targetMonth: number, targetYear: number, jatuhTempoDate: number) {
  // Jatuh tempo di bulan berikutnya setelah end date
  const dueDate = new Date(targetYear, targetMonth - 1, settlementDate);
  dueDate.setMonth(dueDate.getMonth() + 1);
  dueDate.setDate(jatuhTempoDate);
  dueDate.setHours(23, 59, 59, 999);
  return dueDate;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Bulan atau tahun tidak valid." }, { status: 400 });
  }

  // Ambil semua akun Kartu Kredit user
  const creditCardAccounts = await prisma.account.findMany({
    where: {
      userId: session.userId,
      isActive: true,
      accountType: {
        name: "Kartu Kredit",
        isActive: true,
      },
    },
    include: { accountType: true },
  });

  if (creditCardAccounts.length === 0) {
    return NextResponse.json({
      period: null,
      creditCards: [],
      summary: {
        totalSpend: "0",
        totalPayment: "0",
        totalOutstanding: "0",
        overdueCount: 0,
      },
    });
  }

  // Hitung perioda untuk setiap kartu
  const creditCards = await Promise.all(
    creditCardAccounts.map(async (account) => {
      const settlementDate = account.tanggalSettlement || 17;
      const jatuhTempoDate = account.tanggalJatuhTempo || 5;

      const { start, end } = getCreditCardPeriod(settlementDate, month, year);
      const dueDate = getDueDate(settlementDate, month, year, jatuhTempoDate);

      // Ambil transaksi expense di perioda ini (pengeluaran)
      const expenses = await prisma.transaction.aggregate({
        where: {
          userId: session.userId,
          accountId: account.id,
          type: "expense",
          date: {
            gte: start.toISOString().slice(0, 10),
            lte: end.toISOString().slice(0, 10),
          },
        },
        _sum: { amount: true },
      });

      // Ambil transaksi transfer_in di perioda ini (pembayaran)
      const payments = await prisma.transaction.aggregate({
        where: {
          userId: session.userId,
          accountId: account.id,
          type: "transfer_in",
          date: {
            gte: start.toISOString().slice(0, 10),
            lte: end.toISOString().slice(0, 10),
          },
        },
        _sum: { amount: true },
      });

      const totalSpend = new Decimal(expenses._sum.amount || 0);
      const totalPayment = new Decimal(payments._sum.amount || 0);
      const outstanding = totalSpend.minus(totalPayment);

      const now = new Date();
      const isOverdue = now > dueDate && outstanding.greaterThan(0);

      return {
        accountId: account.id,
        accountName: account.name,
        settlementDate,
        jatuhTempoDate,
        period: {
          start: start.toISOString(),
          end: end.toISOString(),
          dueDate: dueDate.toISOString(),
        },
        totalSpend: totalSpend.toString(),
        totalPayment: totalPayment.toString(),
        outstanding: outstanding.toString(),
        isOverdue,
      };
    })
  );

  // Summary
  let totalSpendSum = new Decimal(0);
  let totalPaymentSum = new Decimal(0);
  let totalOutstandingSum = new Decimal(0);
  let overdueCount = 0;

  for (const cc of creditCards) {
    totalSpendSum = totalSpendSum.plus(new Decimal(cc.totalSpend));
    totalPaymentSum = totalPaymentSum.plus(new Decimal(cc.totalPayment));
    totalOutstandingSum = totalOutstandingSum.plus(new Decimal(cc.outstanding));
    if (cc.isOverdue) overdueCount++;
  }

  // Period info untuk response
  const firstCC = creditCards[0];
  const periodInfo = firstCC
    ? {
        start: firstCC.period.start,
        end: firstCC.period.end,
        dueDate: firstCC.period.dueDate,
        settlementDate: firstCC.settlementDate,
      }
    : null;

  return NextResponse.json({
    period: periodInfo,
    creditCards: creditCards.map(({ period, ...rest }) => rest),
    summary: {
      totalSpend: totalSpendSum.toString(),
      totalPayment: totalPaymentSum.toString(),
      totalOutstanding: totalOutstandingSum.toString(),
      overdueCount,
    },
  });
}