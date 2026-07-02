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

  const [userStats, totalTransactions, totalBudgets, totalAccounts, totalSavingsGoals, totalRecurringBills] =
    await Promise.all([
      prisma.$queryRaw<
        {
          totalUsers: bigint;
          googleUsers: bigint;
          emailUsers: bigint;
          verifiedEmailUsers: bigint;
          unverifiedEmailUsers: bigint;
          sheetsUsers: bigint;
          dbOnlyUsers: bigint;
          googleSetupIssueUsers: bigint;
          newThisMonth: bigint;
          newLast7Days: bigint;
          activeLast7Days: bigint;
          activeLast30Days: bigint;
        }[]
      >`
        SELECT
          COUNT(*) as "totalUsers",
          COUNT(*) FILTER (WHERE "googleId" IS NOT NULL) as "googleUsers",
          COUNT(*) FILTER (WHERE "googleId" IS NULL) as "emailUsers",
          COUNT(*) FILTER (WHERE "googleId" IS NULL AND "emailVerified" IS NOT NULL) as "verifiedEmailUsers",
          COUNT(*) FILTER (WHERE "googleId" IS NULL AND "emailVerified" IS NULL) as "unverifiedEmailUsers",
          COUNT(*) FILTER (WHERE "sheetsId" IS NOT NULL) as "sheetsUsers",
          COUNT(*) FILTER (WHERE "googleId" IS NULL AND "sheetsId" IS NULL) as "dbOnlyUsers",
          COUNT(*) FILTER (WHERE "googleId" IS NOT NULL AND "sheetsId" IS NULL) as "googleSetupIssueUsers",
          COUNT(*) FILTER (WHERE "createdAt" >= ${startOfMonth}) as "newThisMonth",
          COUNT(*) FILTER (WHERE "createdAt" >= ${startOf7Days}) as "newLast7Days",
          COUNT(*) FILTER (WHERE "lastActivityAt" >= ${startOf7Days}) as "activeLast7Days",
          COUNT(*) FILTER (WHERE "lastActivityAt" >= ${startOf30Days}) as "activeLast30Days"
        FROM "User"
      `,
      prisma.transaction.count(),
      prisma.budget.count(),
      prisma.account.count(),
      prisma.savingsGoal.count(),
      prisma.recurringTransaction.count(),
    ]);

  const row = userStats[0];
  const totalUsers = Number(row.totalUsers);
  const googleUsers = Number(row.googleUsers);
  const emailUsers = Number(row.emailUsers);
  const verifiedEmailUsers = Number(row.verifiedEmailUsers);
  const unverifiedEmailUsers = Number(row.unverifiedEmailUsers);
  const sheetsUsers = Number(row.sheetsUsers);
  const dbOnlyUsers = Number(row.dbOnlyUsers);
  const googleSetupIssueUsers = Number(row.googleSetupIssueUsers);
  const newThisMonth = Number(row.newThisMonth);
  const newLast7Days = Number(row.newLast7Days);
  const activeLast7Days = Number(row.activeLast7Days);
  const activeLast30Days = Number(row.activeLast30Days);

  return NextResponse.json({
    stats: {
      totalUsers,
      googleUsers,
      emailUsers,
      verifiedEmailUsers,
      unverifiedEmailUsers,
      sheetsUsers,
      dbOnlyUsers,
      googleSetupIssueUsers,
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
