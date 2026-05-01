import "server-only";

import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import { getTransactions } from "@/utils/sheets";
import { getTransactionsDB } from "@/utils/db-transactions";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";
const MONTH_RE = /^\d{4}-\d{2}$/;

export interface BudgetMonthData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  budgets: BudgetItem[];
  unbudgeted: UnbudgetedItem[];
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  category: string;
  budget: number;
  spent: number;
  rollover: number;
  rolloverEnabled: boolean;
}

export interface UnbudgetedItem {
  category: string;
  spent: number;
}

export interface BudgetCategoryOption {
  id: string;
  name: string;
  type: string;
  isSavings: boolean;
}

type RawTxn = {
  amount: number;
  category: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
};

type BudgetWithCategory = {
  id: string;
  categoryId: string;
  amount: number;
  category: { name: string; rolloverEnabled: boolean };
};

export function getCurrentMonth() {
  return format(toZonedTime(new Date(), TIMEZONE), "yyyy-MM");
}

export function isValidMonth(month: string | null | undefined): month is string {
  return typeof month === "string" && MONTH_RE.test(month);
}

export function getPreviousMonth(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return format(new Date(year, monthNum - 2, 1), "yyyy-MM");
}

export async function fetchBudgetMonthData(
  userId: string,
  month: string
): Promise<BudgetMonthData> {
  try {
    const previousMonth = getPreviousMonth(month);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sheetsId: true },
    });

    const [txThisMonth, txPreviousMonth, budgets, previousMonthBudgets] = await Promise.all([
      fetchRawTransactions(userId, user?.sheetsId ?? null, month),
      fetchRawTransactions(userId, user?.sheetsId ?? null, previousMonth),
      prisma.budget.findMany({
        where: { userId, month },
        include: { category: true },
        orderBy: { category: { name: "asc" } },
      }),
      prisma.budget.findMany({
        where: { userId, month: previousMonth },
        include: { category: true },
      }),
    ]);

    return computeBudgetData(txThisMonth, txPreviousMonth, budgets, previousMonthBudgets, month);
  } catch (error) {
    console.error(`Failed to fetch budget month data (${month}):`, error);
    return emptyBudgetMonthData(month);
  }
}

export async function fetchBudgetCategories(userId: string): Promise<BudgetCategoryOption[]> {
  try {
    return await prisma.category.findMany({
      where: { userId, type: "expense" },
      select: { id: true, name: true, type: true, isSavings: true },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Failed to fetch budget categories:", error);
    return [];
  }
}

export function emptyBudgetMonthData(month: string): BudgetMonthData {
  return {
    month,
    totalIncome: 0,
    totalExpense: 0,
    netCashflow: 0,
    budgets: [],
    unbudgeted: [],
  };
}

async function fetchRawTransactions(
  userId: string,
  sheetsId: string | null,
  month: string
): Promise<RawTxn[]> {
  try {
    if (sheetsId) {
      const accessToken = await getValidToken(userId);
      const txs = await getTransactions(sheetsId, accessToken, month);
      return txs.map((t) => ({
        amount: t.amount,
        category: t.category,
        type: t.type,
      }));
    }

    const txs = await getTransactionsDB(userId, month);
    return txs.map((t) => ({
      amount: t.amount,
      category: t.category,
      type: t.type,
    }));
  } catch (error) {
    console.error(`Failed to fetch budget transactions (${month}):`, error);
    return [];
  }
}

function computeBudgetData(
  txThisMonth: RawTxn[],
  txPreviousMonth: RawTxn[],
  budgets: BudgetWithCategory[],
  previousMonthBudgets: BudgetWithCategory[],
  month: string
): BudgetMonthData {
  const spentByCategory: Record<string, number> = {};
  const previousMonthSpent: Record<string, number> = {};
  let totalIncome = 0;
  let totalExpense = 0;

  for (const t of txThisMonth) {
    if (t.type === "income") {
      totalIncome += t.amount;
    } else {
      totalExpense += t.amount;
      spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
    }
  }

  for (const t of txPreviousMonth) {
    if (t.type !== "income") {
      previousMonthSpent[t.category] = (previousMonthSpent[t.category] ?? 0) + t.amount;
    }
  }

  const previousBudgetByCategoryId = Object.fromEntries(
    previousMonthBudgets.map((b) => [b.categoryId, b.amount])
  );

  const budgetedCategories = new Set(budgets.map((b) => b.category.name));
  const unbudgeted = Object.entries(spentByCategory)
    .filter(([cat]) => !budgetedCategories.has(cat))
    .map(([category, spent]) => ({ category, spent }))
    .sort((a, b) => a.category.localeCompare(b.category));

  return {
    month,
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    budgets: budgets.map((b) => {
      const rolloverEnabled = b.category.rolloverEnabled;
      let rollover = 0;
      if (rolloverEnabled) {
        const previousBudget = previousBudgetByCategoryId[b.categoryId] ?? 0;
        const previousSpent = previousMonthSpent[b.category.name] ?? 0;
        rollover = Math.max(0, previousBudget - previousSpent);
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
  };
}
