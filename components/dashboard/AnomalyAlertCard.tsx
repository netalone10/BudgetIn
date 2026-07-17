"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactIDR } from "@/lib/format";
import { isExpenseTransaction } from "@/lib/transaction-classification";

/**
 * Anomaly Alert Card — detects spending anomalies by comparing current month
 * spending per category against 3-month rolling average. Flags categories
 * where current spending > 1.5x the average.
 */

interface Transaction {
  date: string;
  amount: number;
  category: string;
  type?: string;
}

interface Props {
  transactions: Transaction[];
  className?: string;
}

const ANOMALY_THRESHOLD = 1.5;

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonthKey(): string {
  return getMonthKey(new Date().toISOString());
}

function getPreviousMonthKeys(count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(getMonthKey(d.toISOString()));
  }
  return keys;
}

export default function AnomalyAlertCard({ transactions, className }: Props) {
  const currentMonth = getCurrentMonthKey();
  const previousMonths = getPreviousMonthKeys(3);

  // Aggregate spending per category per month
  const spendingByMonth: Record<string, Record<string, number>> = {};

  for (const tx of transactions) {
    if (!isExpenseTransaction(tx)) continue;
    const monthKey = getMonthKey(tx.date);
    if (!spendingByMonth[monthKey]) spendingByMonth[monthKey] = {};
    const cat = tx.category || "Lainnya";
    spendingByMonth[monthKey][cat] =
      (spendingByMonth[monthKey][cat] || 0) + Math.abs(tx.amount);
  }

  // Calculate rolling average for each category
  const currentSpending = spendingByMonth[currentMonth] || {};
  const anomalies: { category: string; current: number; average: number; ratio: number }[] = [];

  for (const [cat, current] of Object.entries(currentSpending)) {
    if (current <= 0) continue;

    let totalPrevious = 0;
    let countPrevious = 0;
    for (const prevMonth of previousMonths) {
      const prev = spendingByMonth[prevMonth]?.[cat] || 0;
      if (prev > 0) {
        totalPrevious += prev;
        countPrevious++;
      }
    }

    if (countPrevious === 0) continue; // No historical data

    const average = totalPrevious / countPrevious;
    const ratio = current / average;

    if (ratio >= ANOMALY_THRESHOLD) {
      anomalies.push({ category: cat, current, average, ratio });
    }
  }

  anomalies.sort((a, b) => b.ratio - a.ratio);

  if (anomalies.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-[24px] border border-amber-500/30 bg-amber-500/5 p-4 shadow-sm sm:rounded-[30px] md:p-5",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-500" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
          Spending Anomaly
        </p>
      </div>

      <div className="space-y-2">
        {anomalies.slice(0, 3).map((a) => (
          <div
            key={a.category}
            className="flex items-center justify-between gap-3 rounded-xl bg-amber-500/8 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {a.category}
              </p>
              <p className="text-xs text-muted-foreground">
                {Math.round(a.ratio)}x lipat dari rata-rata
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {formatCompactIDR(a.current)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                avg {formatCompactIDR(a.average)}/bln
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
