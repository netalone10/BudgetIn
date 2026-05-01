import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchBudgetMonthData, getCurrentMonth, isValidMonth } from "@/lib/budget-data";

// GET /api/budget — ambil semua budget bulan ini + spent + rollover per kategori
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedMonth = req.nextUrl.searchParams.get("month");
  if (requestedMonth && !isValidMonth(requestedMonth)) {
    return NextResponse.json({ error: "month harus format YYYY-MM" }, { status: 400 });
  }

  const budgetData = await fetchBudgetMonthData(session.userId, requestedMonth ?? getCurrentMonth());
  return NextResponse.json(budgetData, { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" } });
}

// POST /api/budget — set/update budget kategori
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category, amount, month } = await req.json();
  const parsedAmount = Number(amount);
  if (typeof category !== "string" || !category.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: "category dan amount wajib diisi" }, { status: 400 });
  }

  if (month && !isValidMonth(month)) {
    return NextResponse.json({ error: "month harus format YYYY-MM" }, { status: 400 });
  }

  const targetMonth = month ?? getCurrentMonth();

  try {
    const cat = await prisma.category.upsert({
      where: { userId_name: { userId: session.userId, name: category.trim() } },
      update: {},
      create: { userId: session.userId, name: category.trim() },
    });

    const budget = await prisma.budget.upsert({
      where: {
        userId_categoryId_month: {
          userId: session.userId,
          categoryId: cat.id,
          month: targetMonth,
        },
      },
      update: { amount: parsedAmount },
      create: {
        userId: session.userId,
        categoryId: cat.id,
        amount: parsedAmount,
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
