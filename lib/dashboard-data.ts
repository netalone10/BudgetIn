/**
 * Server-side data fetching for Dashboard
 * Used by Server Components to fetch initial data
 */
import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTransactionsDB } from "@/utils/db-transactions";
import { getValidToken } from "@/utils/token";
import { getTransactions, getAccountsWithBalance } from "@/utils/sheets";
import { getAccountBalances } from "@/utils/account-balance";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

export interface DashboardInitialData {
  transactions: Transaction[];
  budgetData: BudgetData | null;
  accounts: Account[];
  categories: Category[];
  savingsCategoryNames: string[];
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
  accountId: string | null;
  created_at: string;
}

interface BudgetData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  budgets: BudgetItem[];
  unbudgeted: UnbudgetedItem[];
}

interface BudgetItem {
  id: string;
  categoryId: string;
  category: string;
  budget: number;
  spent: number;
  rollover: number;
  rolloverEnabled: boolean;
}

interface UnbudgetedItem {
  category: string;
  spent: number;
}

interface Account {
  id: string;
  name: string;
  currency: string;
  accountType: {
    name: string;
    classification: string;
  };
  currentBalance?: string;
  color?: string | null;
  note?: string | null;
}

interface Category {
  id: string;
  name: string;
  type: string;
  isSavings: boolean;
}

/**
 * Fetch all dashboard data server-side
 * This is called from the Server Component page.tsx
 */
export async function fetchDashboardData(): Promise<DashboardInitialData> {
  const session = await getServerSession(authOptions);
  
  if (!session?.userId) {
    return {
      transactions: [],
      budgetData: null,
      accounts: [],
      categories: [],
      savingsCategoryNames: [],
      user: null,
    };
  }

  const userId = session.userId;
  const now = toZonedTime(new Date(), TIMEZONE);
  const currentMonth = format(now, "yyyy-MM");
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = format(lastMonthDate, "yyyy-MM");

  // Get user info first (needed to know sheetsId for downstream fetches)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sheetsId: true, name: true, email: true, image: true },
  });
  const sheetsId = user?.sheetsId ?? null;

  // Fetch raw transactions ONCE for both list display and budget calculation.
  // Run all independent fetches in parallel.
  const [
    txThisMonthRaw,
    txLastMonthRaw,
    accounts,
    categories,
    budgets,
    lastMonthBudgets,
  ] = await Promise.all([
    fetchRawTransactions(userId, sheetsId, "bulan ini"),
    fetchRawTransactions(userId, sheetsId, "bulan lalu"),
    fetchAccounts(userId, sheetsId),
    fetchCategories(userId),
    prisma.budget.findMany({
      where: { userId, month: currentMonth },
      include: { category: true },
      orderBy: { category: { name: "asc" } },
    }).catch(() => []),
    prisma.budget.findMany({
      where: { userId, month: lastMonth },
      include: { category: true },
    }).catch(() => []),
  ]);

  const transactions = mapTxnsForDisplay(txThisMonthRaw);
  const budgetData = computeBudgetData(
    txThisMonthRaw,
    txLastMonthRaw,
    budgets,
    lastMonthBudgets,
    currentMonth
  );

  // Build savings category names set
  const savingsCategoryNames = categories
    .filter((c) => c.isSavings)
    .map((c) => c.name.toLowerCase());

  return {
    transactions,
    budgetData,
    accounts,
    categories,
    savingsCategoryNames,
    user: {
      name: user?.name ?? null,
      email: user?.email ?? null,
      image: user?.image ?? null,
    },
  };
}

// Common shape after normalization (works for both Sheets and DB sources).
interface RawTxn {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
  accountId: string | null;
  created_at: string;
}

async function fetchRawTransactions(
  userId: string,
  sheetsId: string | null,
  period: "bulan ini" | "bulan lalu"
): Promise<RawTxn[]> {
  try {
    if (sheetsId) {
      const accessToken = await getValidToken(userId);
      const txs = await getTransactions(sheetsId, accessToken, period);
      return txs.map((t) => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        category: t.category,
        note: t.note,
        type: (t.type === "income" ? "income" : "expense") as RawTxn["type"],
        accountId: t.fromAccountId ?? t.toAccountId ?? null,
        created_at: t.created_at ?? new Date().toISOString(),
      }));
    }
    const txs = await getTransactionsDB(userId, period);
    return txs.map((t) => ({
      id: t.id,
      date: t.date,
      amount: t.amount,
      category: t.category,
      note: t.note,
      type: t.type,
      accountId: t.accountId,
      created_at: t.created_at ?? new Date().toISOString(),
    }));
  } catch (error) {
    console.error(`Failed to fetch transactions (${period}):`, error);
    return [];
  }
}

function mapTxnsForDisplay(raw: RawTxn[]): Transaction[] {
  const sorted = [...raw].sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted.slice(0, 200).map((t) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    category: t.category,
    note: t.note,
    type: t.type,
    accountId: t.accountId,
    created_at: t.created_at,
  }));
}

type BudgetWithCategory = {
  id: string;
  categoryId: string;
  amount: number;
  category: { name: string; rolloverEnabled: boolean };
};

function computeBudgetData(
  txThisMonth: RawTxn[],
  txLastMonth: RawTxn[],
  budgets: BudgetWithCategory[],
  lastMonthBudgets: BudgetWithCategory[],
  currentMonth: string
): BudgetData | null {
  try {
    const spentByCategory: Record<string, number> = {};
    const lastMonthSpent: Record<string, number> = {};
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
    for (const t of txLastMonth) {
      if (t.type !== "income") {
        lastMonthSpent[t.category] = (lastMonthSpent[t.category] ?? 0) + t.amount;
      }
    }

    const lastMonthBudgetByCategoryId = Object.fromEntries(
      lastMonthBudgets.map((b) => [b.categoryId, b.amount])
    );

    const budgetedCategories = new Set(budgets.map((b) => b.category.name));
    const unbudgeted = Object.entries(spentByCategory)
      .filter(([cat]) => !budgetedCategories.has(cat))
      .map(([category, spent]) => ({ category, spent }))
      .sort((a, b) => a.category.localeCompare(b.category));

    return {
      month: currentMonth,
      totalIncome,
      totalExpense,
      netCashflow: totalIncome - totalExpense,
      budgets: budgets.map((b) => {
        const rolloverEnabled = b.category.rolloverEnabled;
        let rollover = 0;
        if (rolloverEnabled) {
          const lastBudget = lastMonthBudgetByCategoryId[b.categoryId] ?? 0;
          const lastSpent = lastMonthSpent[b.category.name] ?? 0;
          rollover = Math.max(0, lastBudget - lastSpent);
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
  } catch (error) {
    console.error("Failed to compute budget data:", error);
    return null;
  }
}

async function fetchAccounts(
  userId: string,
  sheetsId: string | null
): Promise<Account[]> {
  try {
    if (sheetsId) {
      // Google Sheets user
      const accessToken = await getValidToken(userId);
      const sheetsAccounts = await getAccountsWithBalance(sheetsId, accessToken);
      return sheetsAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        accountType: { name: a.type, classification: a.classification },
        currentBalance: a.balance.toString(),
        color: a.color,
        note: a.note,
      }));
    } else {
      // DB user
      await ensureDefaultAccountTypes(userId);
      const dbAccounts = await getAccountBalances(userId);
      return dbAccounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        currency: acc.currency,
        accountType: {
          name: acc.accountType.name,
          classification: acc.accountType.classification,
        },
        currentBalance: acc.currentBalance.toString(),
        color: acc.color,
        note: acc.note,
      }));
    }
  } catch (error) {
    console.error("Failed to fetch accounts:", error);
    return [];
  }
}

async function fetchCategories(userId: string): Promise<Category[]> {
  try {
    const cats = await prisma.category.findMany({
      where: { userId },
      select: { id: true, name: true, type: true, isSavings: true },
      orderBy: { name: "asc" },
    });
    return cats;
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return [];
  }
}
