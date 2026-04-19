import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Decimal } from "@prisma/client/runtime/library";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import {
  ensureAccountHeader,
  getAccounts,
  getTransactions,
  type AccountData,
  type Transaction,
} from "@/utils/sheets";

/**
 * Perioda bulan ini: dari (tanggalSettlement - 1) bulan sebelumnya
 * sampai tanggalSettlement bulan berjalan.
 */
function getCreditCardPeriod(settlementDate: number, targetMonth: number, targetYear: number) {
  const start = new Date(targetYear, targetMonth - 2, settlementDate);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(targetYear, targetMonth - 1, settlementDate);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getDueDate(targetMonth: number, targetYear: number, jatuhTempoDate: number) {
  const dueDate = new Date(targetYear, targetMonth, jatuhTempoDate);
  dueDate.setHours(23, 59, 59, 999);
  return dueDate;
}

function aggregateSheetsCashflow(
  transactions: Transaction[],
  accountId: string,
  startDate: string,
  endDate: string
) {
  let totalSpend = new Decimal(0);
  let totalPayment = new Decimal(0);

  for (const tx of transactions) {
    if (tx.date < startDate || tx.date > endDate) continue;

    const amount = new Decimal(tx.amount || 0);
    const isSpend =
      tx.type === "expense" &&
      tx.fromAccountId === accountId &&
      !tx.toAccountId &&
      tx.category !== "Saldo Awal";

    const isPayment = tx.toAccountId === accountId && tx.category !== "Saldo Awal";

    if (isSpend) totalSpend = totalSpend.plus(amount);
    if (isPayment) totalPayment = totalPayment.plus(amount);
  }

  return { totalSpend, totalPayment };
}

function buildCashflowCard(
  account: Pick<AccountData, "id" | "name" | "tanggalSettlement" | "tanggalJatuhTempo">,
  month: number,
  year: number,
  totalSpend: Decimal,
  totalPayment: Decimal
) {
  const settlementDate = account.tanggalSettlement || 17;
  const jatuhTempoDate = account.tanggalJatuhTempo || 5;
  const { start, end } = getCreditCardPeriod(settlementDate, month, year);
  const dueDate = getDueDate(month, year, jatuhTempoDate);
  const outstanding = totalSpend.minus(totalPayment);
  const isOverdue = new Date() > dueDate && outstanding.greaterThan(0);

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
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);

  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Bulan atau tahun tidak valid." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  let creditCards: Array<ReturnType<typeof buildCashflowCard>> = [];

  if (user?.sheetsId) {
    const accessToken = await getValidToken(session.userId);
    await ensureAccountHeader(user.sheetsId, accessToken).catch(() => {});

    const [accounts, transactions] = await Promise.all([
      getAccounts(user.sheetsId, accessToken),
      getTransactions(user.sheetsId, accessToken),
    ]);

    const creditCardAccounts = accounts.filter(
      (account) => account.type === "Kartu Kredit" && account.classification === "liability"
    );

    creditCards = creditCardAccounts.map((account) => {
      const settlementDate = account.tanggalSettlement || 17;
      const { start, end } = getCreditCardPeriod(settlementDate, month, year);
      const aggregates = aggregateSheetsCashflow(
        transactions,
        account.id,
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10)
      );

      return buildCashflowCard(account, month, year, aggregates.totalSpend, aggregates.totalPayment);
    });
  } else {
    const creditCardAccounts = await prisma.account.findMany({
      where: {
        userId: session.userId,
        isActive: true,
        accountType: {
          name: "Kartu Kredit",
          isActive: true,
        },
      },
      select: {
        id: true,
        name: true,
        tanggalSettlement: true,
        tanggalJatuhTempo: true,
      },
    });

    creditCards = await Promise.all(
      creditCardAccounts.map(async (account) => {
        const settlementDate = account.tanggalSettlement || 17;
        const { start, end } = getCreditCardPeriod(settlementDate, month, year);

        const [expenses, payments] = await Promise.all([
          prisma.transaction.aggregate({
            where: {
              userId: session.userId,
              accountId: account.id,
              type: "expense",
              isInitialBalance: false,
              date: {
                gte: start.toISOString().slice(0, 10),
                lte: end.toISOString().slice(0, 10),
              },
            },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: {
              userId: session.userId,
              accountId: account.id,
              type: "transfer_in",
              isInitialBalance: false,
              date: {
                gte: start.toISOString().slice(0, 10),
                lte: end.toISOString().slice(0, 10),
              },
            },
            _sum: { amount: true },
          }),
        ]);

        return buildCashflowCard(
          account,
          month,
          year,
          new Decimal(expenses._sum.amount || 0),
          new Decimal(payments._sum.amount || 0)
        );
      })
    );
  }

  if (creditCards.length === 0) {
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

  let totalSpendSum = new Decimal(0);
  let totalPaymentSum = new Decimal(0);
  let totalOutstandingSum = new Decimal(0);
  let overdueCount = 0;

  for (const card of creditCards) {
    totalSpendSum = totalSpendSum.plus(new Decimal(card.totalSpend));
    totalPaymentSum = totalPaymentSum.plus(new Decimal(card.totalPayment));
    totalOutstandingSum = totalOutstandingSum.plus(new Decimal(card.outstanding));
    if (card.isOverdue) overdueCount++;
  }

  const firstCard = creditCards[0];

  return NextResponse.json({
    period: firstCard
      ? {
          start: firstCard.period.start,
          end: firstCard.period.end,
          dueDate: firstCard.period.dueDate,
          settlementDate: firstCard.settlementDate,
        }
      : null,
    creditCards: creditCards.map(({ period, ...card }) => card),
    summary: {
      totalSpend: totalSpendSum.toString(),
      totalPayment: totalPaymentSum.toString(),
      totalOutstanding: totalOutstandingSum.toString(),
      overdueCount,
    },
  });
}
