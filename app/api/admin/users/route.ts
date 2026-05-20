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
  const andConditions: Prisma.UserWhereInput[] = [];

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (provider === "google") where.googleId = { not: null };
  if (provider === "email") where.googleId = null;
  if (verified === "verified") where.emailVerified = { not: null };
  if (verified === "unverified") andConditions.push({ googleId: null }, { emailVerified: null });
  if (dataMode === "sheets") where.sheetsId = { not: null };
  if (dataMode === "database" || dataMode === "db") andConditions.push({ googleId: null }, { sheetsId: null });
  if (dataMode === "google_setup_required") andConditions.push({ googleId: { not: null } }, { sheetsId: null });
  if (andConditions.length) where.AND = andConditions;

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
        lastActivityAt: true,
        sheetsTxCount: true,
        sheetsAccountCount: true,
        sheetsCountSyncedAt: true,
        _count: {
          select: {
            budgets: true,
            categories: true,
            accounts: true,
            transactions: true,
            savingsGoals: true,
            recurringTransactions: true,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    users: users.map((u) => {
      const isGoogleSheetsUser = !!u.sheetsId;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        type: u.googleId ? "google" : "email",
        dataMode: u.sheetsId ? "sheets" : u.googleId ? "google_setup_required" : "database",
        emailVerified: !!u.emailVerified,
        budgetCount: u._count.budgets,
        categoryCount: u._count.categories,
        // Sheets users: pakai cached count dari cron sync. DB users: pakai Prisma _count.
        accountCount: isGoogleSheetsUser ? u.sheetsAccountCount : u._count.accounts,
        transactionCount: isGoogleSheetsUser ? u.sheetsTxCount : u._count.transactions,
        savingsGoalCount: u._count.savingsGoals,
        recurringBillCount: u._count.recurringTransactions,
        createdAt: u.createdAt.toISOString(),
        lastActivityAt: u.lastActivityAt.toISOString(),
        sheetsCountSyncedAt: u.sheetsCountSyncedAt?.toISOString() ?? null,
      };
    }),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}
