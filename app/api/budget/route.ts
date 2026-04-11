import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
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

  // Hitung spent per kategori dari Sheets
  let spentByCategory: Record<string, number> = {};
  if (user?.sheetsId) {
    try {
      const accessToken = await getValidToken(session.userId);
      const transactions = await getTransactions(
        user.sheetsId,
        accessToken,
        "bulan ini"
      );
      for (const t of transactions) {
        spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
      }
    } catch {
      // Sheets gagal — tetap return budgets tanpa spent
    }
  }

  return NextResponse.json({
    month: currentMonth,
    budgets: budgets.map((b) => ({
      id: b.id,
      category: b.category.name,
      budget: b.amount,
      spent: spentByCategory[b.category.name] ?? 0,
    })),
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
