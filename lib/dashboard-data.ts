/**
 * Server-side data fetching for Dashboard
 * Used by Server Components to fetch initial data
 */
import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCachedCategories } from "@/lib/cache";
import { getTransactionsDB } from "@/utils/db-transactions";
import { type Transaction as SheetsTransaction } from "@/utils/sheets";
import { getFullSheetsLedger, getAccountsWithComputedBalance } from "@/lib/sheets-data";
import { computeAccountBalancesFromTx } from "@/utils/sheets-ledger";
import { getAccountBalances } from "@/utils/account-balance";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { compareTransactionDateTimeDesc, normalizeTransactionTime } from "@/lib/transaction-time";
import { resolveBudgetType, type BudgetType } from "@/utils/budget-type";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";
const BUDGET_CATEGORY_SELECT_WITH_BUDGET_TYPE = { name: true, rolloverEnabled: true, budgetType: true } as const;
const BUDGET_CATEGORY_SELECT_FALLBACK = { name: true, rolloverEnabled: true } as const;

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

async function findBudgetsWithCategory(
  where: { userId: string; month: string },
  orderBy?: { category: { name: "asc" | "desc" } }
) {
  try {
    return await prisma.budget.findMany({
      where,
      select: {
        id: true,
        categoryId: true,
        amount: true,
        category: { select: BUDGET_CATEGORY_SELECT_WITH_BUDGET_TYPE },
      },
      ...(orderBy ? { orderBy } : {}),
    });
  } catch (error) {
    if (!isMissingBudgetTypeColumnError(error)) throw error;
    return prisma.budget.findMany({
      where,
      select: {
        id: true,
        categoryId: true,
        amount: true,
        category: { select: BUDGET_CATEGORY_SELECT_FALLBACK },
      },
      ...(orderBy ? { orderBy } : {}),
    });
  }
}

export interface MonthlyTotals {
  income: number;
  expense: number;
}

export interface ActiveSavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  totalContributed: number;
  deadline: string | null;
}

export interface DashboardInitialData {
  transactions: Transaction[];
  budgetData: BudgetData | null;
  accounts: Account[];
  categories: Category[];
  savingsCategoryNames: string[];
  lastMonthTotals: MonthlyTotals;
  activeSavingsGoal: ActiveSavingsGoal | null;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface Transaction {
  id: string;
  date: string;
  time: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
  accountId: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
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
  budgetType: BudgetType;
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
  rolloverEnabled?: boolean;
  budgetType?: string | null;
}

/**
 * Fetch all dashboard data server-side
 * This is called from the Server Component page.tsx
 *
 * Pass `userId` to avoid re-running `getServerSession` when the caller
 * (page.tsx) already has a session in hand.
 */
export async function fetchDashboardData(
  userId?: string
): Promise<DashboardInitialData> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const session = await getServerSession(authOptions);
    resolvedUserId = session?.userId;
  }

  if (!resolvedUserId) {
    return {
      transactions: [],
      budgetData: null,
      accounts: [],
      categories: [],
      savingsCategoryNames: [],
      lastMonthTotals: { income: 0, expense: 0 },
      activeSavingsGoal: null,
      user: null,
    };
  }

  const now = toZonedTime(new Date(), TIMEZONE);
  const currentMonth = format(now, "yyyy-MM");
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = format(lastMonthDate, "yyyy-MM");

  // Get user info first (needed to know sheetsId for downstream fetches)
  const user = await prisma.user.findUnique({
    where: { id: resolvedUserId },
    select: { sheetsId: true, name: true, email: true, image: true },
  });
  const sheetsId = user?.sheetsId ?? null;

  let txThisMonthRaw: RawTxn[];
  let txLastMonthRaw: RawTxn[];
  let accounts: Account[];
  let categories: Category[];
  let budgets: BudgetWithCategory[];
  let lastMonthBudgets: BudgetWithCategory[];
  let activeSavingsGoal: ActiveSavingsGoal | null;

  if (sheetsId) {
    // For Sheets users, fetch the full ledger ONCE via the cached single-call
    // layer and derive both month slices + account balances in memory.
    // getFullSheetsLedger is wrapped with React cache() so duplicate calls
    // within the same server request are deduplicated automatically.
    try {
      const [ledgerData, cats, b1, b2, savings] = await Promise.all([
        getFullSheetsLedger(resolvedUserId, sheetsId),
        getCachedCategories(resolvedUserId),
        findBudgetsWithCategory({ userId: resolvedUserId, month: currentMonth }, { category: { name: "asc" } }).catch(() => []),
        findBudgetsWithCategory({ userId: resolvedUserId, month: lastMonth }).catch(() => []),
        fetchActiveSavingsGoal(resolvedUserId),
      ]);

      const { transactions: allTransactions, accounts: sheetsAccountsRaw } = ledgerData;

      // Derive month slices in memory (Requirement 8.1)
      txThisMonthRaw = filterAndMapSheetsTxns(allTransactions, currentMonth);
      txLastMonthRaw = filterAndMapSheetsTxns(allTransactions, lastMonth);

      // Compute balances from preloaded data — no separate API call (Requirement 8.2)
      const balances = computeAccountBalancesFromTx(sheetsAccountsRaw, allTransactions);
      accounts = sheetsAccountsRaw.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        accountType: { name: a.type, classification: a.classification },
        currentBalance: (balances.get(a.id) ?? 0).toString(),
        color: a.color,
        note: a.note,
      }));

      categories = cats;
      budgets = b1;
      lastMonthBudgets = b2;
      activeSavingsGoal = savings;
    } catch (error) {
      console.error("Failed to load Sheets dashboard data:", error);
      txThisMonthRaw = [];
      txLastMonthRaw = [];
      accounts = [];
      categories = [];
      budgets = [];
      lastMonthBudgets = [];
      activeSavingsGoal = null;
    }
  } else {
    const [
      txThis,
      txLast,
      accts,
      cats,
      b1,
      b2,
      savings,
    ] = await Promise.all([
      fetchRawTransactions(resolvedUserId, null, "bulan ini"),
      fetchRawTransactions(resolvedUserId, null, lastMonth),
      fetchAccounts(resolvedUserId, null),
      getCachedCategories(resolvedUserId),
      findBudgetsWithCategory({ userId: resolvedUserId, month: currentMonth }, { category: { name: "asc" } }).catch(() => []),
      findBudgetsWithCategory({ userId: resolvedUserId, month: lastMonth }).catch(() => []),
      fetchActiveSavingsGoal(resolvedUserId),
    ]);
    txThisMonthRaw = txThis;
    txLastMonthRaw = txLast;
    accounts = accts;
    categories = cats;
    budgets = b1;
    lastMonthBudgets = b2;
    activeSavingsGoal = savings;
  }

  const transactions = mapTxnsForDisplay(txThisMonthRaw);
  const budgetData = computeBudgetData(
    txThisMonthRaw,
    txLastMonthRaw,
    budgets,
    lastMonthBudgets,
    currentMonth
  );

  const savingsCategoryNames = categories
    .filter((c) => c.isSavings)
    .map((c) => c.name.toLowerCase());

  const lastMonthTotals = computeMonthlyTotals(txLastMonthRaw);

  return {
    transactions,
    budgetData,
    accounts,
    categories,
    savingsCategoryNames,
    lastMonthTotals,
    activeSavingsGoal,
    user: {
      name: user?.name ?? null,
      email: user?.email ?? null,
      image: user?.image ?? null,
    },
  };
}

function computeMonthlyTotals(raw: RawTxn[]): MonthlyTotals {
  let income = 0;
  let expense = 0;
  for (const t of raw) {
    if (t.type === "income") {
      income += t.amount;
    } else if (isExpenseTransaction(t)) {
      expense += t.amount;
    }
  }
  return { income, expense };
}

async function fetchActiveSavingsGoal(
  userId: string
): Promise<ActiveSavingsGoal | null> {
  try {
    const [goals, contributionAgg] = await Promise.all([
      prisma.savingsGoal.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          targetAmount: true,
          deadline: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.savingsContribution.groupBy({
        by: ["goalId"],
        where: { userId },
        _sum: { amount: true },
      }),
    ]);

    if (goals.length === 0) return null;

    const totalsByGoalId = new Map<string, number>();
    for (const c of contributionAgg) {
      if (!c.goalId) continue;
      totalsByGoalId.set(c.goalId, Number(c._sum.amount ?? 0));
    }

    const incomplete = goals
      .map((g) => {
        const target = Number(g.targetAmount);
        const contributed = totalsByGoalId.get(g.id) ?? 0;
        return { goal: g, target, contributed };
      })
      .filter((g) => g.target > 0 && g.contributed < g.target);

    const pick = incomplete[0] ?? null;
    if (!pick) return null;

    return {
      id: pick.goal.id,
      name: pick.goal.name,
      targetAmount: pick.target,
      totalContributed: pick.contributed,
      deadline: pick.goal.deadline ? pick.goal.deadline.toISOString() : null,
    };
  } catch (error) {
    console.error("Failed to fetch active savings goal:", error);
    return null;
  }
}

function filterAndMapSheetsTxns(
  all: SheetsTransaction[],
  yearMonth: string
): RawTxn[] {
  return all
    .filter((t) => t.date.startsWith(yearMonth))
    .map((t) => ({
      id: t.id,
      date: t.date,
      time: normalizeTransactionTime(t.time),
      amount: t.amount,
      category: t.category,
      note: t.note,
      type: (t.type === "income" ? "income" : "expense") as RawTxn["type"],
      accountId: t.fromAccountId ?? t.toAccountId ?? null,
      fromAccountId: t.fromAccountId ?? null,
      fromAccountName: t.fromAccountName ?? null,
      toAccountId: t.toAccountId ?? null,
      toAccountName: t.toAccountName ?? null,
      created_at: t.created_at ?? new Date().toISOString(),
    }));
}

// getAccountsWithBalanceFromLedger is no longer needed — replaced by
// getAccountsWithComputedBalance from lib/sheets-data.ts which reuses
// the React cache()-wrapped single-call ledger fetch.

// Common shape after normalization (works for both Sheets and DB sources).
interface RawTxn {
  id: string;
  date: string;
  time: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
  accountId: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
  created_at: string;
}

async function fetchRawTransactions(
  userId: string,
  sheetsId: string | null,
  period: string
): Promise<RawTxn[]> {
  try {
    if (sheetsId) {
      // Use the cached single-call ledger — getFullSheetsLedger is React cache()-wrapped
      // so this reuses the same data already fetched in the current request.
      const { transactions: allTxs } = await getFullSheetsLedger(userId, sheetsId);

      // Filter by period in memory
      let filtered: SheetsTransaction[];
      if (/^\d{4}-\d{2}$/.test(period)) {
        filtered = allTxs.filter((t) => t.date.startsWith(period));
      } else if (period === "bulan ini") {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        filtered = allTxs.filter((t) => t.date.startsWith(currentMonth));
      } else {
        filtered = allTxs;
      }

      return filtered.map((t) => ({
        id: t.id,
        date: t.date,
        time: normalizeTransactionTime(t.time),
        amount: t.amount,
        category: t.category,
        note: t.note,
        type: (t.type === "income" ? "income" : "expense") as RawTxn["type"],
        accountId: t.fromAccountId ?? t.toAccountId ?? null,
        fromAccountId: t.fromAccountId ?? null,
        fromAccountName: t.fromAccountName ?? null,
        toAccountId: t.toAccountId ?? null,
        toAccountName: t.toAccountName ?? null,
        created_at: t.created_at ?? new Date().toISOString(),
      }));
    }
    const txs = await getTransactionsDB(userId, period);
    return txs.map((t) => ({
      id: t.id,
      date: t.date,
      time: normalizeTransactionTime(t.time),
      amount: t.amount,
      category: t.category,
      note: t.note,
      type: t.type,
      accountId: t.accountId,
      fromAccountId: null,
      fromAccountName: null,
      toAccountId: null,
      toAccountName: null,
      created_at: t.created_at ?? new Date().toISOString(),
    }));
  } catch (error) {
    console.error(`Failed to fetch transactions (${period}):`, error);
    return [];
  }
}

function mapTxnsForDisplay(raw: RawTxn[]): Transaction[] {
  const sorted = [...raw].sort(compareTransactionDateTimeDesc);
  return sorted.slice(0, 200).map((t) => ({
    id: t.id,
    date: t.date,
    time: normalizeTransactionTime(t.time),
    amount: t.amount,
    category: t.category,
    note: t.note,
    type: t.type,
    accountId: t.accountId,
    fromAccountId: t.fromAccountId ?? null,
    fromAccountName: t.fromAccountName ?? null,
    toAccountId: t.toAccountId ?? null,
    toAccountName: t.toAccountName ?? null,
    created_at: t.created_at,
  }));
}

type BudgetWithCategory = {
  id: string;
  categoryId: string;
  amount: number | { toNumber(): number };
  category: { name: string; rolloverEnabled: boolean; budgetType?: string | null };
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
      } else if (isExpenseTransaction(t)) {
        totalExpense += t.amount;
        spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
      }
    }
    for (const t of txLastMonth) {
      if (isExpenseTransaction(t)) {
        lastMonthSpent[t.category] = (lastMonthSpent[t.category] ?? 0) + t.amount;
      }
    }

    const lastMonthBudgetByCategoryId = Object.fromEntries(
      lastMonthBudgets.map((b) => [b.categoryId, Number(b.amount)])
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
          budget: Number(b.amount),
          spent: spentByCategory[b.category.name] ?? 0,
          rollover,
          rolloverEnabled,
          budgetType: resolveBudgetType(b.category.name, b.category.budgetType),
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
      // Google Sheets user — reuses cached ledger data (no extra API call)
      const sheetsAccounts = await getAccountsWithComputedBalance(userId, sheetsId);
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

// fetchCategories replaced by getCachedCategories from lib/cache.ts
// which provides per-request deduplication via React cache() and uses
// Prisma select-only fields (Requirement 6.2).

// ---------------------------------------------------------------------------
// Split Data Fetching for Granular Suspense Boundaries (Requirement 2.4)
// ---------------------------------------------------------------------------

/**
 * KPI/Summary data — lightweight fetch for above-the-fold KPI cards.
 * Includes: user info, accounts (for net worth), categories, savings goal,
 * and last month totals (for delta comparison).
 * This resolves quickly and streams first via its own Suspense boundary.
 */
export interface DashboardKPIData {
  accounts: Account[];
  categories: Category[];
  savingsCategoryNames: string[];
  lastMonthTotals: MonthlyTotals;
  activeSavingsGoal: ActiveSavingsGoal | null;
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

/**
 * Secondary data — heavier fetch for transaction history and budget details.
 * Includes: transactions (sorted, limited to 200), budget data with rollover calculations.
 * This streams progressively after KPI data has rendered.
 */
export interface DashboardSecondaryData {
  transactions: Transaction[];
  budgetData: BudgetData | null;
}

/**
 * Fetch KPI/summary data for the dashboard.
 * This is the lightweight portion that should resolve quickly for streaming.
 */
export async function fetchDashboardKPIData(
  userId: string
): Promise<DashboardKPIData> {
  const now = toZonedTime(new Date(), TIMEZONE);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = format(lastMonthDate, "yyyy-MM");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sheetsId: true, name: true, email: true, image: true },
  });
  const sheetsId = user?.sheetsId ?? null;

  let accounts: Account[];
  let categories: Category[];
  let txLastMonthRaw: RawTxn[];
  let activeSavingsGoal: ActiveSavingsGoal | null;

  if (sheetsId) {
    try {
      const [ledgerData, cats, savings] = await Promise.all([
        getFullSheetsLedger(userId, sheetsId),
        getCachedCategories(userId),
        fetchActiveSavingsGoal(userId),
      ]);

      const { transactions: allTransactions, accounts: sheetsAccountsRaw } = ledgerData;
      txLastMonthRaw = filterAndMapSheetsTxns(allTransactions, lastMonth);

      const balances = computeAccountBalancesFromTx(sheetsAccountsRaw, allTransactions);
      accounts = sheetsAccountsRaw.map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        accountType: { name: a.type, classification: a.classification },
        currentBalance: (balances.get(a.id) ?? 0).toString(),
        color: a.color,
        note: a.note,
      }));

      categories = cats;
      activeSavingsGoal = savings;
    } catch (error) {
      console.error("Failed to load Sheets KPI data:", error);
      accounts = [];
      categories = [];
      txLastMonthRaw = [];
      activeSavingsGoal = null;
    }
  } else {
    const [accts, cats, txLast, savings] = await Promise.all([
      fetchAccounts(userId, null),
      getCachedCategories(userId),
      fetchRawTransactions(userId, null, lastMonth),
      fetchActiveSavingsGoal(userId),
    ]);
    accounts = accts;
    categories = cats;
    txLastMonthRaw = txLast;
    activeSavingsGoal = savings;
  }

  const savingsCategoryNames = categories
    .filter((c) => c.isSavings)
    .map((c) => c.name.toLowerCase());

  const lastMonthTotals = computeMonthlyTotals(txLastMonthRaw);

  return {
    accounts,
    categories,
    savingsCategoryNames,
    lastMonthTotals,
    activeSavingsGoal,
    user: {
      name: user?.name ?? null,
      email: user?.email ?? null,
      image: user?.image ?? null,
    },
  };
}

/**
 * Fetch secondary/heavy data for the dashboard (transactions + budget).
 * This is the heavier portion that streams progressively after KPI data.
 */
export async function fetchDashboardSecondaryData(
  userId: string
): Promise<DashboardSecondaryData> {
  const now = toZonedTime(new Date(), TIMEZONE);
  const currentMonth = format(now, "yyyy-MM");
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = format(lastMonthDate, "yyyy-MM");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sheetsId: true },
  });
  const sheetsId = user?.sheetsId ?? null;

  let txThisMonthRaw: RawTxn[];
  let txLastMonthRaw: RawTxn[];
  let budgets: BudgetWithCategory[];
  let lastMonthBudgets: BudgetWithCategory[];

  if (sheetsId) {
    try {
      const [ledgerData, b1, b2] = await Promise.all([
        getFullSheetsLedger(userId, sheetsId),
        findBudgetsWithCategory({ userId, month: currentMonth }, { category: { name: "asc" } }).catch(() => []),
        findBudgetsWithCategory({ userId, month: lastMonth }).catch(() => []),
      ]);

      const { transactions: allTransactions } = ledgerData;
      txThisMonthRaw = filterAndMapSheetsTxns(allTransactions, currentMonth);
      txLastMonthRaw = filterAndMapSheetsTxns(allTransactions, lastMonth);
      budgets = b1;
      lastMonthBudgets = b2;
    } catch (error) {
      console.error("Failed to load Sheets secondary data:", error);
      txThisMonthRaw = [];
      txLastMonthRaw = [];
      budgets = [];
      lastMonthBudgets = [];
    }
  } else {
    const [txThis, txLast, b1, b2] = await Promise.all([
      fetchRawTransactions(userId, null, "bulan ini"),
      fetchRawTransactions(userId, null, lastMonth),
      findBudgetsWithCategory({ userId, month: currentMonth }, { category: { name: "asc" } }).catch(() => []),
      findBudgetsWithCategory({ userId, month: lastMonth }).catch(() => []),
    ]);
    txThisMonthRaw = txThis;
    txLastMonthRaw = txLast;
    budgets = b1;
    lastMonthBudgets = b2;
  }

  const transactions = mapTxnsForDisplay(txThisMonthRaw);
  const budgetData = computeBudgetData(
    txThisMonthRaw,
    txLastMonthRaw,
    budgets,
    lastMonthBudgets,
    currentMonth
  );

  return {
    transactions,
    budgetData,
  };
}
