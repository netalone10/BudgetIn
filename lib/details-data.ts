/**
 * Pure helpers untuk halaman `/dashboard/details` (Rincian Pemasukan & Pengeluaran).
 *
 * `aggregateDetails` mengelompokkan transaksi per kategori menjadi `incomeGroups`
 * dan `expenseGroups` dengan rule eksklusi yang sama dengan `aggregatePeriodReport`
 * di `lib/report-data.ts` (Saldo Awal, transfer principal, savings categories
 * di-skip), tetapi juga menyimpan list transaksi mentah per kategori sehingga
 * UI dapat melakukan drill-down ke level transaksi.
 */
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { isSavingsTransaction } from "@/lib/savings-utils";
import { compareTransactionDateTimeDesc } from "@/lib/transaction-time";
import type { ReportTransactionLike } from "@/lib/report-data";

export type DetailType = "income" | "expense";

export type Period = "today" | "week" | "month" | "lastMonth" | "custom";

export interface CategoryGroup {
  /** Nama kategori, e.g. "Makan", "Gaji". */
  category: string;
  /** Total nominal IDR (selalu non-negatif). */
  amount: number;
  /** Jumlah transaksi di group. Invariant: `count === transactions.length`. */
  count: number;
  /** Share kontribusi terhadap grand total tab aktif, di range [0, 1]. */
  share: number;
  /** Transaksi anggota, sorted desc by date+time (terbaru dulu). */
  transactions: ReportTransactionLike[];
}

export interface DetailsAggregation {
  incomeGroups: CategoryGroup[];
  expenseGroups: CategoryGroup[];
  incomeTotal: number;
  expenseTotal: number;
}

export interface DetailsFilters {
  period: Period;
  /** ISO date `YYYY-MM-DD`, hanya dipakai saat `period === "custom"`. */
  customFrom: string;
  customTo: string;
  /** Match terhadap `note + " " + category` (case-insensitive, trimmed). */
  searchQuery: string;
  /** `accountId` untuk filter, atau `""` untuk no-op. */
  accountFilter: string;
  /** Nama kategori untuk narrow ke 1 kategori, atau `""` untuk no-op. */
  categoryFilter: string;
}

type Bucket = { amount: number; txs: ReportTransactionLike[] };

/**
 * Aggregate transaksi periode menjadi groups per kategori untuk income & expense.
 *
 * Aturan eksklusi (sama dengan `aggregatePeriodReport`):
 * - `tx.category === "Saldo Awal"` di-skip.
 * - `Math.abs(Number(tx.amount) || 0) === 0` di-skip.
 * - Transaksi non-income yang gagal `isExpenseTransaction` (transfer principal) di-skip.
 * - Transaksi non-income di kategori savings di-skip.
 *
 * Postconditions:
 * - `Math.abs(incomeTotal - sum(incomeGroups[i].amount)) < 0.01`.
 * - `Math.abs(expenseTotal - sum(expenseGroups[i].amount)) < 0.01`.
 * - Setiap group: `count === transactions.length`, `0 <= share <= 1`, `amount >= 0`.
 * - Groups sorted by `amount DESC`, tie-break `category ASC` (`localeCompare`).
 * - Setiap `transactions[]` di group sorted desc by date+time.
 * - Tidak memutasi input array maupun elemennya.
 */
export function aggregateDetails(
  transactions: ReportTransactionLike[],
  savingsCategoryNames: Set<string>,
): DetailsAggregation {
  const incomeMap = new Map<string, Bucket>();
  const expenseMap = new Map<string, Bucket>();
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const tx of transactions) {
    if (tx.category === "Saldo Awal") continue;
    const amt = Math.abs(Number(tx.amount) || 0);
    if (amt === 0) continue;

    if (tx.type === "income") {
      const bucket = getOrCreate(incomeMap, tx.category);
      bucket.amount += amt;
      bucket.txs.push(tx);
      incomeTotal += amt;
      continue;
    }

    if (!isExpenseTransaction(tx)) continue;
    if (isSavingsTransaction(tx.category, savingsCategoryNames)) continue;

    const bucket = getOrCreate(expenseMap, tx.category);
    bucket.amount += amt;
    bucket.txs.push(tx);
    expenseTotal += amt;
  }

  return {
    incomeGroups: buildGroups(incomeMap, incomeTotal),
    expenseGroups: buildGroups(expenseMap, expenseTotal),
    incomeTotal,
    expenseTotal,
  };
}

function getOrCreate(map: Map<string, Bucket>, key: string): Bucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { amount: 0, txs: [] };
    map.set(key, bucket);
  }
  return bucket;
}

function buildGroups(map: Map<string, Bucket>, grandTotal: number): CategoryGroup[] {
  const groups: CategoryGroup[] = [];
  for (const [category, bucket] of map) {
    // Salin sebelum sort untuk menghindari mutasi list internal yang nanti
    // bisa di-share lewat referensi via input transactions.
    const sortedTxs = [...bucket.txs].sort(compareTransactionDateTimeDesc);
    groups.push({
      category,
      amount: bucket.amount,
      count: bucket.txs.length,
      share: grandTotal > 0 ? bucket.amount / grandTotal : 0,
      transactions: sortedTxs,
    });
  }
  return groups.sort(
    (a, b) => b.amount - a.amount || a.category.localeCompare(b.category),
  );
}

/**
 * Saring transaksi sesuai `DetailsFilters` dengan semantik AND di antara
 * `accountFilter`, `categoryFilter`, dan `searchQuery`.
 *
 * Aturan match:
 * - `accountFilter` non-kosong: `tx.accountId === accountFilter` ATAU
 *   `tx.fromAccountId === accountFilter` ATAU `tx.toAccountId === accountFilter`.
 * - `categoryFilter` non-kosong: `tx.category === categoryFilter`.
 * - `searchQuery` setelah `trim()` non-kosong: lowercase haystack
 *   `(tx.note ?? "") + " " + (tx.category ?? "")` mengandung lowercase query.
 *
 * Postconditions:
 * - Output ⊆ input (subset, urutan relatif dipertahankan).
 * - Idempoten: `apply(apply(txs, f), f)` deeply equal `apply(txs, f)`.
 * - Tidak memutasi input array maupun elemennya.
 */
export function applyDetailsFilters<T extends ReportTransactionLike>(
  transactions: readonly T[],
  filters: DetailsFilters,
): T[] {
  const accountFilter = filters.accountFilter;
  const categoryFilter = filters.categoryFilter;
  const query = filters.searchQuery.trim().toLowerCase();

  const result: T[] = [];
  for (const tx of transactions) {
    if (accountFilter !== "") {
      const txAccountId = (tx as { accountId?: string | null }).accountId ?? null;
      const matchesAccount =
        txAccountId === accountFilter ||
        tx.fromAccountId === accountFilter ||
        tx.toAccountId === accountFilter;
      if (!matchesAccount) continue;
    }

    if (categoryFilter !== "" && tx.category !== categoryFilter) continue;

    if (query !== "") {
      const note = (tx as { note?: string | null }).note ?? "";
      const category = tx.category ?? "";
      const haystack = (note + " " + category).toLowerCase();
      if (!haystack.includes(query)) continue;
    }

    result.push(tx);
  }

  return result;
}

/**
 * Default factory untuk `Expanded_Keys` set saat Details_Client pertama mount
 * atau saat Active_Tab/Period berubah dan harus me-reset state expansion.
 *
 * Selalu mengembalikan instance `Set<string>` baru sehingga caller bebas
 * memutasinya tanpa risiko shared-state lintas render.
 */
export function EMPTY_EXPANDED_KEYS(): Set<string> {
  return new Set<string>();
}

/**
 * Toggle keanggotaan `category` di dalam `set` secara immutable.
 *
 * Postconditions:
 * - Mengembalikan `Set<string>` baru; input `set` tidak dimutasi.
 * - Jika `set.has(category)` maka output tidak mengandung `category`,
 *   selain `category` semua entri input dipertahankan.
 * - Jika `!set.has(category)` maka output adalah union dari `set` dan
 *   `{ category }`.
 * - Involusi: untuk semua `set` dan `category`,
 *   `toggleExpand(toggleExpand(set, category), category)` menghasilkan
 *   `Set<string>` yang berisi entri yang sama persis dengan `set`.
 */
export function toggleExpand(
  set: ReadonlySet<string>,
  category: string,
): Set<string> {
  const next = new Set<string>(set);
  if (next.has(category)) {
    next.delete(category);
  } else {
    next.add(category);
  }
  return next;
}
