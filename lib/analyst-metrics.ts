/**
 * Pure helpers untuk AI Analyst metrics.
 *
 * Pemisahan tabungan dari expense mengikuti konsep akuntansi: tabungan/investasi
 * adalah pengurang kas yang menambah aset (mirip withdrawal/prive di equity),
 * BUKAN pengeluaran. Karena itu di analyst:
 *   - totalSpent hanya berisi true expense (bukan tabungan)
 *   - totalSavings dilacak terpisah, kenaikannya = sinyal positif
 *   - spentByCategory tidak menyertakan kategori tabungan (agar tidak muncul
 *     di topExpenses / categoryPercentages / over-budget anomalies)
 */
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { isSavingsTransaction } from "@/lib/savings-utils";

export interface AnalystTransactionLike {
  date: string;
  category: string;
  amount: number;
  type?: string | null;
  note?: string;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
}

export interface AnalystMetrics {
  totalIncome: number;
  totalSpent: number;            // true expense, EXCLUDES savings
  totalSavings: number;          // explicit savings allocations
  spentByCategory: Record<string, number>; // EXCLUDES savings categories
  savingsByCategory: Record<string, number>;
  expenseTxs: AnalystTransactionLike[];     // for top expenses (excludes savings)
  expenseTxCount: number;        // count of non-savings expense txs (for "no data" check)
  uniqueExpenseDays: number;     // distinct days with non-savings expense
}

/**
 * Computes deterministic metrics from a list of transactions.
 * Caller must supply lowercased savings category names (from categories where isSavings=true).
 * Saldo Awal transactions are skipped entirely.
 */
export function computeAnalystMetrics(
  transactions: AnalystTransactionLike[],
  savingsCategoryNames: Set<string>
): AnalystMetrics {
  let totalIncome = 0;
  let totalSpent = 0;
  let totalSavings = 0;
  const spentByCategory: Record<string, number> = {};
  const savingsByCategory: Record<string, number> = {};
  const expenseTxs: AnalystTransactionLike[] = [];
  const expenseDates = new Set<string>();

  for (const t of transactions) {
    if (t.category === "Saldo Awal") continue;
    if (t.type === "income") {
      totalIncome += t.amount;
      continue;
    }
    if (!isExpenseTransaction(t)) continue;

    if (isSavingsTransaction(t.category, savingsCategoryNames)) {
      totalSavings += t.amount;
      savingsByCategory[t.category] = (savingsByCategory[t.category] ?? 0) + t.amount;
      continue;
    }

    totalSpent += t.amount;
    spentByCategory[t.category] = (spentByCategory[t.category] ?? 0) + t.amount;
    expenseTxs.push(t);
    expenseDates.add(t.date.slice(0, 10));
  }

  return {
    totalIncome,
    totalSpent,
    totalSavings,
    spentByCategory,
    savingsByCategory,
    expenseTxs,
    expenseTxCount: expenseTxs.length,
    uniqueExpenseDays: expenseDates.size,
  };
}

export interface CashflowScoreInput {
  totalIncome: number;
  totalSpent: number;
  totalSavings: number;
}

/**
 * Cashflow Score (0–50). Base dari rasio expense/income; bonus +5 bila
 * allocated savings rate ≥ 10% (dorongan eksplisit untuk menabung).
 * Cap di 50.
 */
export function computeCashflowScore({ totalIncome, totalSpent, totalSavings }: CashflowScoreInput): number {
  if (totalIncome <= 0) return 25; // netral
  const ratio = totalSpent / totalIncome;
  let base: number;
  if (ratio <= 0.7) base = 50;
  else if (ratio <= 0.8) base = 40;
  else if (ratio <= 0.9) base = 30;
  else if (ratio <= 1.0) base = 20;
  else if (ratio <= 1.2) base = 10;
  else base = 0;

  const allocatedRate = totalSavings / totalIncome;
  const bonus = allocatedRate >= 0.1 ? 5 : 0;
  return Math.min(50, base + bonus);
}

export interface SavingsRates {
  /** Rate of explicit savings contributions (totalSavings / totalIncome × 100). */
  allocatedSavingsRate: number;
  /** Net surplus rate: ((totalIncome − totalSpent) / totalIncome × 100). Includes savings AND unallocated leftover. */
  netSurplusRate: number;
}

export function computeSavingsRates({
  totalIncome,
  totalSpent,
  totalSavings,
}: CashflowScoreInput): SavingsRates {
  if (totalIncome <= 0) {
    return { allocatedSavingsRate: 0, netSurplusRate: 0 };
  }
  return {
    allocatedSavingsRate: (totalSavings / totalIncome) * 100,
    netSurplusRate: ((totalIncome - totalSpent) / totalIncome) * 100,
  };
}
