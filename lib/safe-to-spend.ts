/**
 * "Safe to spend" harian — perhitungan murni (tanpa dependency server/Next)
 * agar mudah di-unit-test dan bisa dipakai di client maupun server.
 *
 * Ide: dari budget bulan ini, berapa rupiah yang masih "aman" dipakai per hari
 * sampai akhir bulan tanpa membobol budget. Hanya kategori VARIABLE yang
 * dihitung — biaya FIXED (kos, cicilan, langganan) adalah komitmen lump-sum,
 * jadi membagi-rata per hari justru menyesatkan. Pemisahan fixed/variable
 * konsisten dengan halaman Budget (lihat `resolveBudgetType`).
 *
 * Memakai "effective budget" = budget + rollover, sama seperti halaman Budget
 * dan kartu peringatan budget. `spent` diasumsikan sudah menyaring
 * transfer/equity (dihitung via isExpenseTransaction di hulu).
 */

import { resolveBudgetType } from "@/utils/budget-type";

export interface SafeToSpendInput {
  category: string;
  budget: number;
  spent: number;
  rollover?: number;
  budgetType?: string | null;
}

export interface SafeToSpendResult {
  /** Ada minimal satu kategori variable dengan effective budget > 0. */
  hasBudget: boolean;
  /** Total effective budget (budget + rollover) kategori variable. */
  variableBudget: number;
  /** Total spent kategori variable. */
  variableSpent: number;
  /** Sisa = variableBudget - variableSpent (boleh negatif). */
  remaining: number;
  /** Hari tersisa di bulan, termasuk hari ini (minimal 1). */
  daysLeft: number;
  /** Jumlah hari dalam bulan tsb. */
  totalDays: number;
  /** Nomor hari saat ini dalam bulan berjalan (1..totalDays); 0 jika bukan bulan berjalan. */
  dayOfMonth: number;
  /** Alokasi aman per hari = max(0, remaining) / daysLeft. */
  perDay: number;
  /** True jika sisa <= 0 (budget variable habis / over). */
  depleted: boolean;
  /** True jika `month` adalah bulan yang sama dengan `now`. */
  isCurrentMonth: boolean;
}

function getDaysInMonth(year: number, monthNum: number): number {
  // monthNum 1-based; new Date(year, monthNum, 0) = hari terakhir bulan tsb.
  return new Date(year, monthNum, 0).getDate();
}

/**
 * Hitung alokasi aman per hari dari daftar budget.
 *
 * @param budgets daftar item budget bulan tsb (effective = budget + rollover)
 * @param month   bulan target format `YYYY-MM`
 * @param now     waktu acuan (idealnya sudah di-zona Asia/Jakarta oleh pemanggil)
 *
 * Untuk bulan berjalan, `daysLeft` dihitung dari hari ini sampai akhir bulan
 * (inklusif). Untuk bulan lain (lampau/depan) `isCurrentMonth=false` dan
 * `daysLeft` jatuh ke `totalDays` — kartu sebaiknya tidak ditampilkan untuk
 * bulan non-berjalan karena "safe to spend" hanya bermakna untuk hari ini.
 */
export function computeSafeToSpend(
  budgets: SafeToSpendInput[],
  month: string,
  now: Date = new Date()
): SafeToSpendResult {
  const [year, monthNum] = month.split("-").map(Number);
  const totalDays = getDaysInMonth(year, monthNum);

  const nowMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = nowMonth === month;
  const dayOfMonth = isCurrentMonth ? Math.min(now.getDate(), totalDays) : 0;
  const daysLeft = isCurrentMonth ? Math.max(1, totalDays - dayOfMonth + 1) : totalDays;

  let variableBudget = 0;
  let variableSpent = 0;

  for (const b of budgets) {
    if (resolveBudgetType(b.category, b.budgetType) !== "variable") continue;
    const effectiveBudget = b.budget + (b.rollover ?? 0);
    if (effectiveBudget <= 0) continue;
    variableBudget += effectiveBudget;
    variableSpent += b.spent;
  }

  const remaining = variableBudget - variableSpent;
  const perDay = Math.max(0, remaining) / daysLeft;

  return {
    hasBudget: variableBudget > 0,
    variableBudget,
    variableSpent,
    remaining,
    daysLeft,
    totalDays,
    dayOfMonth,
    perDay,
    depleted: remaining <= 0,
    isCurrentMonth,
  };
}
