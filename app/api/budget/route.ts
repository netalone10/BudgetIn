import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { getTransactionsDB } from "@/utils/db-transactions";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

// GET /api/budget — ambil semua budget bulan ini + spent per kategori
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentMonth = format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // Ambil budgets dari DB
  const budgets = await prisma.budget.findMany({
    where: { userId: session.userId, month: currentMonth },
    include: { category: true },
    orderBy: { category: { name: "asc" } },
  });

  // Hitung spent + income — dari Sheets (Google) atau DB (email)
  let spentByCategory: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpense = 0;

  try {
    let transactions: { type?: string; amount: number; category: string }[] = [];

    if (user?.sheetsId) {
      // Google user → Sheets
      const accessToken = await getValidToken(session.userId);
      transactions = await getTransactions(user.sheetsId, accessToken, "bulan ini");
    } else {
      // Email user → DB
      transactions = await getTransactionsDB(session.userId, "bulan ini");
    }

    for (const t of transactions) {
      if (t.type === "income") {
        totalIncome += t.amount;
      } else {
        totalExpense += t.amount;
        spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
      }
    }
  } catch {
    // Gagal ambil transaksi — return budgets tanpa spent
  }

  const budgetedCategories = new Set(budgets.map((b) => b.category.name));
  const unbudgeted = Object.entries(spentByCategory)
    .filter(([cat]) => !budgetedCategories.has(cat))
    .map(([category, spent]) => ({ category, spent }))
    .sort((a, b) => a.category.localeCompare(b.category));

  return NextResponse.json({
    month: currentMonth,
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    budgets: budgets.map((b) => ({
      id: b.id,
      category: b.category.name,
      budget: b.amount,
      spent: spentByCategory[b.category.name] ?? 0,
    })),
    unbudgeted,
  });
}

// POST /api/budget — set/update budget kategori
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category, amount, month } = await req.json();
  if (!category || !amount) {
    return NextResponse.json({ error: "category dan amount wajib diisi" }, { status: 400 });
  }

  const targetMonth =
    month ?? format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");

  try {
    const cat = await prisma.category.upsert({
      where: { userId_name: { userId: session.userId, name: category } },
      update: {},
      create: { userId: session.userId, name: category },
    });

    const budget = await prisma.budget.upsert({
      where: {
        userId_categoryId_month: {
          userId: session.userId,
          categoryId: cat.id,
          month: targetMonth,
        },
      },
      update: { amount },
      create: {
        userId: session.userId,
        categoryId: cat.id,
        amount,
        month: targetMonth,
      },
    });

    return NextResponse.json({ success: true, budget });
  } catch {
    return NextResponse.json(
      { error: "Gagal simpan budget. Coba lagi." },
      { status: 500 }
    );
  }
}
