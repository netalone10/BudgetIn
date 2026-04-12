import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/is-admin";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    googleUsers,
    emailUsers,
    newThisMonth,
    newLast7Days,
    recentUsers,
    totalTransactions,
    totalBudgets,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { googleId: { not: null } } }),
    prisma.user.count({ where: { googleId: null } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOf7Days } } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        googleId: true,
        sheetsId: true,
        emailVerified: true,
        createdAt: true,
        _count: { select: { budgets: true, categories: true } },
      },
    }),
    prisma.transaction.count(),
    prisma.budget.count(),
  ]);

  return NextResponse.json({
    stats: {
      totalUsers,
      googleUsers,
      emailUsers,
      newThisMonth,
      newLast7Days,
      totalTransactions,
      totalBudgets,
    },
    recentUsers: recentUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      type: u.googleId ? "google" : "email",
      hasSheets: !!u.sheetsId,
      emailVerified: !!u.emailVerified,
      budgetCount: u._count.budgets,
      categoryCount: u._count.categories,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
