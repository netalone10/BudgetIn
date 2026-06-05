/**
 * Budget limit alerts — perhitungan murni (tanpa dependency server/Next) agar
 * mudah di-unit-test dan bisa dipakai di client maupun server.
 *
 * Memakai "effective budget" = budget + rollover, konsisten dengan halaman
 * Budget (DashboardTabs) dan dashboard. `spent` diasumsikan sudah menyaring
 * transfer/equity (dihitung via isExpenseTransaction di hulu).
 */

export type BudgetAlertLevel = "warn" | "over";

export interface BudgetAlertInput {
  category: string;
  budget: number;
  spent: number;
  rollover?: number;
}

export interface BudgetAlert {
  category: string;
  spent: number;
  /** budget + rollover */
  effectiveBudget: number;
  /** spent / effectiveBudget (0..n) */
  ratio: number;
  level: BudgetAlertLevel;
}

/** Ambang default: kategori dianggap "mendekati limit" pada 80% pemakaian. */
export const BUDGET_WARN_THRESHOLD = 0.8;

/**
 * Hitung daftar kategori yang mendekati atau melewati budget.
 * - `over`  : pemakaian > 100% dari effective budget (benar-benar melewati)
 * - `warn`  : pemakaian >= warnThreshold (default 80%) dan <= 100%
 *
 * Catatan: pemakaian tepat 100% (spent == effective budget) dianggap `warn`,
 * bukan `over` — budget terpakai penuh tapi belum dilewati.
 *
 * Kategori tanpa effective budget (<= 0) di-skip. Hasil diurutkan rasio
 * tertinggi lebih dulu (yang paling kritis di atas).
 */
export function computeBudgetAlerts(
  budgets: BudgetAlertInput[],
  warnThreshold: number = BUDGET_WARN_THRESHOLD
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  for (const b of budgets) {
    const effectiveBudget = b.budget + (b.rollover ?? 0);
    if (effectiveBudget <= 0) continue;

    const ratio = b.spent / effectiveBudget;
    if (ratio > 1) {
      alerts.push({ category: b.category, spent: b.spent, effectiveBudget, ratio, level: "over" });
    } else if (ratio >= warnThreshold) {
      alerts.push({ category: b.category, spent: b.spent, effectiveBudget, ratio, level: "warn" });
    }
  }

  return alerts.sort((a, b) => b.ratio - a.ratio);
}
