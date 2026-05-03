import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/is-admin";

const PAGE_SIZE_OPTIONS = new Set([10, 20, 50]);
const MAX_PAGE_SIZE = 50;

function clampPage(value: string | null) {
  const page = Number(value ?? "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function getPageSize(value: string | null) {
  const pageSize = Number(value ?? "10");
  if (!Number.isFinite(pageSize)) return 10;
  if (PAGE_SIZE_OPTIONS.has(pageSize)) return pageSize;
  return Math.min(Math.max(Math.floor(pageSize), 1), MAX_PAGE_SIZE);
}

function getOrderBy(sort: string | null): Prisma.UserOrderByWithRelationInput {
  if (sort === "name") return { name: "asc" };
  if (sort === "oldest") return { createdAt: "asc" };
  return { createdAt: "desc" };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const provider = searchParams.get("provider");
  const verified = searchParams.get("verified");
  const dataMode = searchParams.get("dataMode");
  const sort = searchParams.get("sort");
  const page = clampPage(searchParams.get("page"));
  const pageSize = getPageSize(searchParams.get("pageSize"));

  const where: Prisma.UserWhereInput = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (provider === "google") where.googleId = { not: null };
  if (provider === "email") where.googleId = null;
  if (verified === "verified") where.emailVerified = { not: null };
  if (verified === "unverified") where.AND = [{ googleId: null }, { emailVerified: null }];
  if (dataMode === "sheets") where.sheetsId = { not: null };
  if (dataMode === "db") where.sheetsId = null;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: getOrderBy(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        googleId: true,
        sheetsId: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: {
            budgets: true,
            categories: true,
            accounts: true,
            transactions: true,
            savingsGoals: true,
            recurringBills: true,
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      type: u.googleId ? "google" : "email",
      hasSheets: !!u.sheetsId,
      emailVerified: !!u.emailVerified,
      budgetCount: u._count.budgets,
      categoryCount: u._count.categories,
      accountCount: u._count.accounts,
      transactionCount: u._count.transactions,
      savingsGoalCount: u._count.savingsGoals,
      recurringBillCount: u._count.recurringBills,
      createdAt: u.createdAt.toISOString(),
      lastActivityAt: (u.transactions[0]?.createdAt ?? u.createdAt).toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
