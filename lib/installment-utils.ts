/**
 * Pure computation helpers untuk installment (cicilan).
 * Tidak ada dependency server — bisa di-import client maupun server.
 *
 * Cicilan di-track via RecurringTransaction dengan installment fields.
 * Setiap kali cicilan dijalankan (recorded), installmentPaid bertambah.
 * Outstanding debt = total - (paid × monthlyAmount).
 */

import { addMonths, format } from "date-fns";

export interface InstallmentMeta {
  totalAmount: number;
  tenor: number;
  paid: number;
  remaining: number;
  monthlyAmount: number;
  outstandingDebt: number;
  progressPercent: number;
  freedomDate: Date;
  startDate: Date;
  endDate: Date;
}

export interface InstallmentListItem {
  id: string;
  name: string;
  totalAmount: number;
  tenor: number;
  paid: number;
  remaining: number;
  monthlyAmount: number;
  outstandingDebt: number;
  progressPercent: number;
  freedomDate: string;
  startDate: string;
  source: string | null;
  transactionType: "expense" | "transfer" | "recorded";
  toAccountId: string | null;
  nextDueDate: string;
  isActive: boolean;
}

export interface MonthProjection {
  month: string;
  totalPayment: number;
  activeCount: number;
  freedCount: number;
  freedAmount: number;
}

/**
 * Hitung metadata installment dari parameter dasar.
 *
 * @param total         total harga (installmentTotal)
 * @param tenor         jumlah bulan (installmentTenor)
 * @param paid          bulan sudah dibayar (installmentPaid)
 * @param monthlyAmount nominal per bulan (amount dari RecurringTransaction)
 * @param startDate     tanggal mulai cicilan
 */
export function computeInstallmentMeta(
  total: number,
  tenor: number,
  paid: number,
  monthlyAmount: number,
  startDate: Date
): InstallmentMeta {
  const remaining = Math.max(0, tenor - paid);
  const outstandingDebt = Math.max(0, total - paid * monthlyAmount);
  const progressPercent = tenor > 0 ? Math.round((paid / tenor) * 100) : 0;
  const freedomDate = addMonths(startDate, tenor);
  const endDate = freedomDate;

  return {
    totalAmount: total,
    tenor,
    paid,
    remaining,
    monthlyAmount,
    outstandingDebt,
    progressPercent,
    freedomDate,
    startDate,
    endDate,
  };
}

/**
 * Proyeksi bulanan: berapa cicilan yang harus dibayar per bulan ke depan,
 * dan kapan cicilan selesai (freed).
 *
 * @param installments daftar cicilan aktif
 * @param months       jumlah bulan ke depan (default 12)
 * @param now          waktu acuan (default sekarang)
 */
export function computeProjection(
  installments: InstallmentListItem[],
  months: number = 12,
  now: Date = new Date()
): MonthProjection[] {
  const projections: MonthProjection[] = [];
  const activeList = installments.filter((i) => i.isActive && i.remaining > 0);

  for (let m = 0; m < months; m++) {
    const targetDate = addMonths(now, m);
    const monthKey = format(targetDate, "yyyy-MM");

    let totalPayment = 0;
    let activeCount = 0;
    let freedCount = 0;
    let freedAmount = 0;

    for (const inst of activeList) {
      // Check if this installment still has payments due in this month
      // m=0 means next month payment (first remaining), m=1 means month after, etc.
      if (m >= inst.remaining) continue; // already paid off before this month

      totalPayment += inst.monthlyAmount;
      activeCount++;

      // This is the last payment month for this installment
      if (m === inst.remaining - 1) {
        freedCount++;
        freedAmount += inst.monthlyAmount;
      }
    }

    projections.push({
      month: monthKey,
      totalPayment,
      activeCount,
      freedCount,
      freedAmount,
    });
  }

  return projections;
}

/**
 * Hitung credit utilization untuk kartu kredit.
 *
 * @param creditLimit    limit kartu (null kalau tidak diketahui)
 * @param currentBalance saldo terhutang saat ini
 */
export function computeCreditUtilization(
  creditLimit: number | null,
  currentBalance: number
): {
  creditLimit: number | null;
  currentBalance: number;
  availableCredit: number | null;
  utilizationPercent: number | null;
  warning: "none" | "approaching" | "over_limit";
} {
  const availableCredit =
    creditLimit !== null ? Math.max(0, creditLimit - currentBalance) : null;

  const utilizationPercent =
    creditLimit !== null && creditLimit > 0
      ? Math.round((currentBalance / creditLimit) * 100)
      : null;

  let warning: "none" | "approaching" | "over_limit" = "none";
  if (utilizationPercent !== null) {
    if (utilizationPercent > 90) warning = "over_limit";
    else if (utilizationPercent > 75) warning = "approaching";
  }

  return {
    creditLimit,
    currentBalance,
    availableCredit,
    utilizationPercent,
    warning,
  };
}
