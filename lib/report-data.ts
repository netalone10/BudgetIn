/**
 * Pure helpers untuk Income Statement-style report.
 *
 * Konsep akuntansi yang dipakai (sejajar dengan analyst-metrics):
 *   - Tabungan / Investasi BUKAN expense — itu withdrawal ke equity
 *     (mirip prive di perusahaan). Wajib di-skip dari kolom PENGELUARAN.
 *   - Saldo Awal juga di-skip (transaksi seeding, bukan aktivitas periode).
 *   - Transfer principal di-skip via isExpenseTransaction.
 *
 * Net surplus = totalIncome - totalExpense (tanpa tabungan), yang merupakan
 * sisa cash yang bisa dialokasikan ke tabungan / investasi / surplus bebas.
 */
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { isSavingsTransaction } from "@/lib/savings-utils";

export interface ReportTransactionLike {
  date: string;
  category: string;
  amount: number;
  type?: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
}

export type CategoryRow = { category: string; amount: number };
export type YearlyCategoryRow = { category: string; monthly: number[] };

export interface PeriodReportData {
  income: CategoryRow[];
  expense: CategoryRow[];
}

export interface YearlyReportData {
  income: YearlyCategoryRow[];
  expense: YearlyCategoryRow[];
}

const sumDesc = (a: CategoryRow, b: CategoryRow) => b.amount - a.amount;
const yearlyTotalDesc = (a: YearlyCategoryRow, b: YearlyCategoryRow) =>
  b.monthly.reduce((s, v) => s + v, 0) - a.monthly.reduce((s, v) => s + v, 0);

/**
 * Agregat transaksi periode tunggal jadi income/expense per kategori.
 * Transfer principal, Saldo Awal, dan tabungan/investasi di-skip dari expense.
 */
export function aggregatePeriodReport(
  transactions: ReportTransactionLike[],
  savingsCategoryNames: Set<string>,
): PeriodReportData {
  const income = new Map<string, number>();
  const expense = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.category === "Saldo Awal") continue;
    const amt = Math.abs(Number(tx.amount) || 0);
    if (amt === 0) continue;

    if (tx.type === "income") {
      income.set(tx.category, (income.get(tx.category) ?? 0) + amt);
      continue;
    }
    if (!isExpenseTransaction(tx)) continue;
    if (isSavingsTransaction(tx.category, savingsCategoryNames)) continue;
    expense.set(tx.category, (expense.get(tx.category) ?? 0) + amt);
  }

  return {
    income: Array.from(income, ([category, amount]) => ({ category, amount })).sort(sumDesc),
    expense: Array.from(expense, ([category, amount]) => ({ category, amount })).sort(sumDesc),
  };
}

/**
 * Agregat transaksi setahun penuh jadi matrix per kategori × 12 bulan.
 * Transaksi di luar `year` di-skip otomatis lewat parse bulan.
 */
export function aggregateYearlyReport(
  transactions: ReportTransactionLike[],
  year: number,
  savingsCategoryNames: Set<string>,
): YearlyReportData {
  const income = new Map<string, number[]>();
  const expense = new Map<string, number[]>();
  const ensure = (m: Map<string, number[]>, cat: string) => {
    let arr = m.get(cat);
    if (!arr) {
      arr = new Array(12).fill(0);
      m.set(cat, arr);
    }
    return arr;
  };

  const yearStr = String(year);

  for (const tx of transactions) {
    if (tx.category === "Saldo Awal") continue;
    if (!tx.date || tx.date.slice(0, 4) !== yearStr) continue;
    const month = parseInt(tx.date.slice(5, 7), 10) - 1;
    if (month < 0 || month > 11) continue;
    const amt = Math.abs(Number(tx.amount) || 0);
    if (amt === 0) continue;

    if (tx.type === "income") {
      ensure(income, tx.category)[month] += amt;
      continue;
    }
    if (!isExpenseTransaction(tx)) continue;
    if (isSavingsTransaction(tx.category, savingsCategoryNames)) continue;
    ensure(expense, tx.category)[month] += amt;
  }

  const toRows = (m: Map<string, number[]>): YearlyCategoryRow[] =>
    Array.from(m, ([category, monthly]) => ({ category, monthly })).sort(yearlyTotalDesc);

  return { income: toRows(income), expense: toRows(expense) };
}

/** Parse "YYYY-MM-DD" ke label "12 Mei 2026". */
export function formatDateLabelId(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

/** Parse "YYYY-MM" ke label bulan Indonesia: "April 2026". */
export function formatMonthLabelId(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/** Inclusive day count antara dua tanggal "YYYY-MM-DD". */
export function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + "T00:00:00");
  const to = new Date(toIso + "T00:00:00");
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
}
