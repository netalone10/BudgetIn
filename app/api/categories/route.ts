import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDefaultCategories, ALL_DEFAULT_CATEGORIES } from "@/utils/seed-categories";
import { blockDemoResponse } from "@/lib/demo-account";
import { resolveBudgetType } from "@/utils/budget-type";
import { withCacheHeaders, withETag, handleConditionalRequest } from "@/lib/api-helpers";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { ROUTE_CACHE_PROFILES } from "@/lib/cache-headers";
import { normalizePaginationParams } from "@/lib/pagination";

type CategoryResponseRow = {
  id: string;
  name: string;
  type: string;
  icon?: string | null;
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

function isUniqueConstraintError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  return (error as { code?: string }).code === "P2002";
}

async function findCategories(userId: string, includeBudgetType = true): Promise<CategoryResponseRow[]> {
  if (!includeBudgetType) {
    return prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, icon: true, isSavings: true },
      orderBy: { name: "asc" },
    });
  }

  try {
    return await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, icon: true, isSavings: true, budgetType: true },
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
export async function GET(req: NextRequest) {
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

    const responseData = {
      categories: categories.map((category) => ({
        ...category,
        budgetType: resolveBudgetType(category.name, category.budgetType),
      })),
    };

    // Parse pagination params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const { page: normalizedPage, limit: normalizedLimit, skip } = normalizePaginationParams({ page, limit });

    const allCategories = responseData.categories;
    const total = allCategories.length;
    const totalPages = Math.ceil(total / normalizedLimit);
    const paginatedCategories = allCategories.slice(skip, skip + normalizedLimit);

    const paginatedData = {
      categories: paginatedCategories,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        total,
        totalPages,
      },
    };

    // Handle conditional request (ETag / 304)
    const conditionalResponse = handleConditionalRequest(req, paginatedData);
    if (conditionalResponse) return conditionalResponse;

    // Build response with cache headers and ETag
    const profile = ROUTE_CACHE_PROFILES["/api/categories"];
    let response = NextResponse.json(paginatedData);
    response = withCacheHeaders(response, profile);
    response = withETag(response, paginatedData);

    return response;
  } catch (error) {
    console.error(error);
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
    }
    const { name, type } = body;

    if (!name || typeof name !== "string" || (type !== "expense" && type !== "income")) {
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
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "Kategori sudah ada" }, { status: 409 });
    }

    const data = {
      userId: session.userId,
      name: name.trim(),
      type,
      budgetType: type === "expense" ? resolveBudgetType(name.trim()) : "variable",
    };

    let category;
    try {
      category = await prisma.category.create({
        data,
        select: { id: true, name: true, type: true, isSavings: true, budgetType: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return NextResponse.json({ error: "Kategori sudah ada" }, { status: 409 });
      }
      if (!isMissingBudgetTypeColumnError(error)) throw error;
      try {
        category = await prisma.category.create({
          data: {
            userId: session.userId,
            name: name.trim(),
            type,
          },
          select: { id: true, name: true, type: true, icon: true, isSavings: true },
        });
      } catch (fallbackError) {
        if (isUniqueConstraintError(fallbackError)) {
          return NextResponse.json({ error: "Kategori sudah ada" }, { status: 409 });
        }
        throw fallbackError;
      }
    }

    return NextResponse.json({ category });
  } catch (error) {
    console.error(error);
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}
