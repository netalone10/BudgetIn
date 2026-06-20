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
import { isExpenseTransaction, isEquityTransaction } from "@/lib/transaction-classification";
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
    if (isEquityTransaction(tx)) continue;
    // Nilai bertanda (net): transaksi expense ber-nominal negatif (refund/koreksi)
    // mengurangi total kategorinya, konsisten dgn cara saldo akun menghitung.
    const amt = Number(tx.amount) || 0;
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
    if (isEquityTransaction(tx)) continue;
    if (!tx.date || tx.date.slice(0, 4) !== yearStr) continue;
    const month = parseInt(tx.date.slice(5, 7), 10) - 1;
    if (month < 0 || month > 11) continue;
    const amt = Number(tx.amount) || 0;
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

// ── Statement of Owner's Equity ───────────────────────────────────────────────

export interface OwnerEquityMovements {
  /** Laba bersih operasional = totalIncome − totalExpense (exclude savings & equity). */
  netIncome: number;
  /** Penarikan ke tabungan/investasi (withdrawal yang mengurangi ekuitas). */
  withdrawals: number;
  /** Penyesuaian ekuitas (Saldo Awal, Penyesuaian Saldo): income → +, expense → −. */
  adjustments: number;
}

/**
 * Hitung mutasi ekuitas dari aktivitas periode (asset-centric).
 * `beginningEquity`/`endingEquity` dihitung otoritatif dari saldo as-of di caller;
 * helper ini hanya memecah perubahan jadi komponen bernama.
 */
export function aggregateOwnerEquity(
  transactions: ReportTransactionLike[],
  savingsCategoryNames: Set<string>,
): OwnerEquityMovements {
  const { income, expense } = aggregatePeriodReport(transactions, savingsCategoryNames);
  const netIncome = income.reduce((s, r) => s + r.amount, 0) - expense.reduce((s, r) => s + r.amount, 0);

  let withdrawals = 0;
  let adjustments = 0;
  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    if (amt === 0) continue;

    if (isEquityTransaction(tx)) {
      adjustments += tx.type === "income" ? amt : -amt;
      continue;
    }
    if (tx.type === "income") continue;
    if (!isExpenseTransaction(tx)) continue;
    if (isSavingsTransaction(tx.category, savingsCategoryNames)) {
      withdrawals += amt;
    }
  }

  return { netIncome, withdrawals, adjustments };
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export interface BalanceSheetAccount {
  name: string;
  classification: string; // "asset" | "liability"
  balance: number;
  /** Nama tipe akun (Kas, Bank, Investasi, Kartu Kredit, …) untuk pengelompokan. */
  typeName?: string;
  /** Urutan likuiditas tipe (kecil = paling likuid). Default: end of list. */
  typeOrder?: number;
}

/** Satu kelompok akun sejenis dalam neraca (mis. semua rekening Bank). */
export interface BalanceSheetGroup {
  typeName: string;
  rows: CategoryRow[];
  subtotal: number;
}

export interface BalanceSheetData {
  /** Daftar datar (flat) — dipertahankan untuk konsumen lama. */
  assets: CategoryRow[];
  liabilities: CategoryRow[];
  /** Dikelompokkan per tipe akun, diurutkan dari yang paling likuid. */
  assetGroups: BalanceSheetGroup[];
  liabilityGroups: BalanceSheetGroup[];
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
}

/** Urut abjad nama akun (locale id, case-insensitive). */
const nameAsc = (a: CategoryRow, b: CategoryRow) =>
  a.category.localeCompare(b.category, "id", { sensitivity: "base" });

/**
 * Kelompokkan akun per `typeName`, urutkan grup berdasarkan likuiditas
 * (`typeOrder` terkecil dulu), dan urutkan akun di dalam grup secara abjad.
 */
function groupByType(accounts: BalanceSheetAccount[]): BalanceSheetGroup[] {
  const map = new Map<string, { order: number; rows: CategoryRow[] }>();

  accounts.forEach((acc, idx) => {
    const typeName = acc.typeName?.trim() || "Lainnya";
    const order = acc.typeOrder ?? Number.MAX_SAFE_INTEGER - 1000 + idx;
    let g = map.get(typeName);
    if (!g) {
      g = { order, rows: [] };
      map.set(typeName, g);
    }
    g.order = Math.min(g.order, order);
    g.rows.push({ category: acc.name, amount: Number(acc.balance) || 0 });
  });

  return Array.from(map.entries())
    .map(([typeName, g]) => ({
      typeName,
      order: g.order,
      rows: g.rows.sort(nameAsc),
      subtotal: g.rows.reduce((s, r) => s + r.amount, 0),
    }))
    .sort((a, b) => a.order - b.order || a.typeName.localeCompare(b.typeName, "id"))
    .map(({ order: _order, ...group }) => group);
}

/**
 * Susun neraca dari saldo per akun. Ekuitas = total aset − total liabilitas,
 * konsisten dengan `calculateNetWorth` & ringkasan /api/accounts (kekayaan
 * bersih): liabilitas dijumlah BERTANDA (bukan absolut) agar angka ekuitas
 * cocok persis dengan "Kekayaan Bersih" di dashboard, dan identitas
 * Aset = Liabilitas + Ekuitas selalu terpenuhi.
 *
 * Baris dikelompokkan per tipe akun (Kas, Bank, Investasi, …): grup diurut
 * dari yang paling likuid (`typeOrder` terkecil dulu), akun di dalam grup
 * diurut abjad.
 */
export function buildBalanceSheet(accounts: BalanceSheetAccount[]): BalanceSheetData {
  const assetAccounts: BalanceSheetAccount[] = [];
  const liabilityAccounts: BalanceSheetAccount[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;

  for (const acc of accounts) {
    const bal = Number(acc.balance) || 0;
    if (acc.classification === "liability") {
      liabilityAccounts.push(acc);
      totalLiabilities += bal;
    } else {
      assetAccounts.push(acc);
      totalAssets += bal;
    }
  }

  const assetGroups = groupByType(assetAccounts);
  const liabilityGroups = groupByType(liabilityAccounts);

  return {
    assets: assetGroups.flatMap((g) => g.rows),
    liabilities: liabilityGroups.flatMap((g) => g.rows),
    assetGroups,
    liabilityGroups,
    totalAssets,
    totalLiabilities,
    equity: totalAssets - totalLiabilities,
  };
}
