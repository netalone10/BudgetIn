import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";

export interface CalendarTransaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  type: "income" | "expense" | "transfer_in" | "transfer_out";
  accountName?: string;
}

export interface DayData {
  income: number;
  expense: number;
  transactions: CalendarTransaction[];
}

export interface CalendarResponse {
  days: Record<string, DayData>;
  summary: {
    totalIncome: number;
    totalExpense: number;
    net: number;
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Parameter tidak valid" }, { status: 400 });
  }

  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (user?.sheetsId) {
    try {
      const accessToken = await getValidToken(session.userId);
      const allTx = await getTransactions(user.sheetsId, accessToken, prefix);

      const days: Record<string, DayData> = {};
      let totalIncome = 0;
      let totalExpense = 0;

      for (const t of allTx) {
        if (!t.date.startsWith(prefix)) continue;

        const day = t.date;
        if (!days[day]) days[day] = { income: 0, expense: 0, transactions: [] };

        const calTx: CalendarTransaction = {
          id: t.id,
          date: t.date,
          amount: t.amount,
          category: t.category,
          note: t.note,
          type: t.type,
          accountName: t.fromAccountName ?? t.toAccountName,
        };

        if (t.type === "income") {
          days[day].income += t.amount;
          totalIncome += t.amount;
        } else {
          days[day].expense += t.amount;
          totalExpense += t.amount;
        }
        days[day].transactions.push(calTx);
      }

      return NextResponse.json({
        days,
        summary: { totalIncome, totalExpense, net: totalIncome - totalExpense },
      } satisfies CalendarResponse);
    } catch (e) {
      console.error("calendar sheets error:", e);
      return NextResponse.json({ error: "Gagal membaca data Sheets" }, { status: 500 });
    }
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: session.userId,
      date: { startsWith: prefix },
    },
    include: { account: true },
    orderBy: { date: "asc" },
  });

  const days: Record<string, DayData> = {};
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of transactions) {
    if (!days[t.date]) days[t.date] = { income: 0, expense: 0, transactions: [] };

    const amount = Number(t.amount);
    const calTx: CalendarTransaction = {
      id: t.id,
      date: t.date,
      amount,
      category: t.category,
      note: t.note,
      type: t.type as CalendarTransaction["type"],
      accountName: t.account?.name,
    };

    if (t.type === "income" || t.type === "transfer_in") {
      days[t.date].income += amount;
      totalIncome += amount;
    } else if (t.type === "expense" || t.type === "transfer_out") {
      days[t.date].expense += amount;
      totalExpense += amount;
    }
    days[t.date].transactions.push(calTx);
  }

  return NextResponse.json({
    days,
    summary: { totalIncome, totalExpense, net: totalIncome - totalExpense },
  } satisfies CalendarResponse);
}
