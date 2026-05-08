import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDefaultCategories, ALL_DEFAULT_CATEGORIES } from "@/utils/seed-categories";
import { blockDemoResponse } from "@/lib/demo-account";
import { resolveBudgetType } from "@/utils/budget-type";

type CategoryResponseRow = {
  id: string;
  name: string;
  type: string;
  isSavings: boolean;
  budgetType?: string | null;
};

function isMissingBudgetTypeColumnError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const maybeError = error as { code?: string; message?: string; meta?: { column?: string } };
  return (
    maybeError.code === "P2022" &&
    (maybeError.meta?.column === "budget_type" ||
      maybeError.message?.includes("budget_type") ||
      maybeError.message?.includes("Category.budgetType"))
  );
}

async function findCategories(userId: string, includeBudgetType = true): Promise<CategoryResponseRow[]> {
  if (!includeBudgetType) {
    return prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, isSavings: true },
      orderBy: { name: "asc" },
    });
  }

  try {
    return await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, isSavings: true, budgetType: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    if (isMissingBudgetTypeColumnError(error)) {
      return findCategories(userId, false);
    }
    throw error;
  }
}

// GET /api/categories — semua kategori milik user + default jika belum ada
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let categories = await findCategories(session.userId);

    // Kalau user lama belum punya default categories — seed sekarang
    const names = new Set(categories.map((c) => c.name));
    const missingDefaults = ALL_DEFAULT_CATEGORIES.filter((n) => !names.has(n));
    if (missingDefaults.length > 0) {
      await seedDefaultCategories(session.userId);
      // Refetch setelah seed
      categories = await findCategories(session.userId);
    }

    return NextResponse.json({
      categories: categories.map((category) => ({
        ...category,
        budgetType: resolveBudgetType(category.name, category.budgetType),
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}

// POST /api/categories — create new category
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const demoBlock = await blockDemoResponse(session);
    if (demoBlock) return demoBlock;
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, type } = await req.json();

    if (!name || (type !== "expense" && type !== "income")) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Check existing
    const existing = await prisma.category.findUnique({
      where: {
        userId_name: {
          userId: session.userId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Kategori sudah ada" }, { status: 400 });
    }

    const data = {
        userId: session.userId,
        name: name.trim(),
        type,
        budgetType: type === "expense" ? resolveBudgetType(name.trim()) : "variable",
    };

    let category;
    try {
      category = await prisma.category.create({ data });
    } catch (error) {
      if (!isMissingBudgetTypeColumnError(error)) throw error;
      category = await prisma.category.create({
        data: {
          userId: session.userId,
          name: name.trim(),
          type,
        },
      });
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Terjadi kesalahan" }, { status: 500 });
  }
}
