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
  const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    googleUsers,
    emailUsers,
    verifiedEmailUsers,
    unverifiedEmailUsers,
    sheetsUsers,
    dbOnlyUsers,
    newThisMonth,
    newLast7Days,
    activeLast7Days,
    activeLast30Days,
    totalTransactions,
    totalBudgets,
    totalAccounts,
    totalSavingsGoals,
    totalRecurringBills,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { googleId: { not: null } } }),
    prisma.user.count({ where: { googleId: null } }),
    prisma.user.count({ where: { googleId: null, emailVerified: { not: null } } }),
    prisma.user.count({ where: { googleId: null, emailVerified: null } }),
    prisma.user.count({ where: { sheetsId: { not: null } } }),
    prisma.user.count({ where: { sheetsId: null } }),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.user.count({ where: { createdAt: { gte: startOf7Days } } }),
    prisma.user.count({
      where: { transactions: { some: { createdAt: { gte: startOf7Days } } } },
    }),
    prisma.user.count({
      where: { transactions: { some: { createdAt: { gte: startOf30Days } } } },
    }),
    prisma.transaction.count(),
    prisma.budget.count(),
    prisma.account.count(),
    prisma.savingsGoal.count(),
    prisma.recurringBill.count(),
  ]);

  return NextResponse.json({
    stats: {
      totalUsers,
      googleUsers,
      emailUsers,
      verifiedEmailUsers,
      unverifiedEmailUsers,
      sheetsUsers,
      dbOnlyUsers,
      newThisMonth,
      newLast7Days,
      activeLast7Days,
      activeLast30Days,
      totalTransactions,
      totalBudgets,
      totalAccounts,
      totalSavingsGoals,
      totalRecurringBills,
    },
  });
}
