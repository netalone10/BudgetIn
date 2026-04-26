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

// GET /api/budget — ambil semua budget bulan ini + spent + rollover per kategori
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = toZonedTime(new Date(), TIMEZONE);
  const currentMonth = format(now, "yyyy-MM");
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = format(lastMonthDate, "yyyy-MM");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // Ambil budgets bulan ini + bulan lalu sekaligus
  const [budgets, lastMonthBudgets] = await Promise.all([
    prisma.budget.findMany({
      where: { userId: session.userId, month: currentMonth },
      include: { category: true },
      orderBy: { category: { name: "asc" } },
    }),
    prisma.budget.findMany({
      where: { userId: session.userId, month: lastMonth },
      include: { category: true },
    }),
  ]);

  // Hitung spent bulan ini + bulan lalu — dual-path Sheets vs DB
  let spentByCategory: Record<string, number> = {};
  let lastMonthSpent: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpense = 0;

  try {
    if (user?.sheetsId) {
      const accessToken = await getValidToken(session.userId);
      const [txThisMonth, txLastMonth] = await Promise.all([
        getTransactions(user.sheetsId, accessToken, "bulan ini"),
        getTransactions(user.sheetsId, accessToken, "bulan lalu"),
      ]);

      for (const t of txThisMonth) {
        if (t.type === "income") {
          totalIncome += t.amount;
        } else {
          totalExpense += t.amount;
          spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
        }
      }
      for (const t of txLastMonth) {
        if (t.type !== "income") {
          lastMonthSpent[t.category] = (lastMonthSpent[t.category] ?? 0) + t.amount;
        }
      }
    } else {
      const [txThisMonth, txLastMonth] = await Promise.all([
        getTransactionsDB(session.userId, "bulan ini"),
        getTransactionsDB(session.userId, "bulan lalu"),
      ]);

      for (const t of txThisMonth) {
        if (t.type === "income") {
          totalIncome += t.amount;
        } else {
          totalExpense += t.amount;
          spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
        }
      }
      for (const t of txLastMonth) {
        if (t.type !== "income") {
          lastMonthSpent[t.category] = (lastMonthSpent[t.category] ?? 0) + t.amount;
        }
      }
    }
  } catch {
    // Gagal ambil transaksi — return budgets tanpa spent/rollover
  }

  // Index last month budgets by categoryId
  const lastMonthBudgetByCategoryId = Object.fromEntries(
    lastMonthBudgets.map((b) => [b.categoryId, b.amount])
  );

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
    budgets: budgets.map((b) => {
      const rolloverEnabled = b.category.rolloverEnabled;
      let rollover = 0;
      if (rolloverEnabled) {
        const lastBudget = lastMonthBudgetByCategoryId[b.categoryId] ?? 0;
        const lastSpent = lastMonthSpent[b.category.name] ?? 0;
        rollover = Math.max(0, lastBudget - lastSpent);
      }
      return {
        id: b.id,
        categoryId: b.categoryId,
        category: b.category.name,
        budget: b.amount,
        spent: spentByCategory[b.category.name] ?? 0,
        rollover,
        rolloverEnabled,
      };
    }),
    unbudgeted,
  }, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" } });
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
