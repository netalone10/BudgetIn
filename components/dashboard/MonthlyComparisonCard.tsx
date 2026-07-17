"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactIDR } from "@/lib/format";
import { isExpenseTransaction } from "@/lib/transaction-classification";

/**
 * Monthly Comparison Card — compares current month vs previous month
 * for income, expense, and savings. Shows delta arrows and percentages.
 */

interface Transaction {
  date: string;
  amount: number;
  type?: string;
}

interface Props {
  transactions: Transaction[];
  className?: string;
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentMonthKey(): string {
  return getMonthKey(new Date().toISOString());
}

function getPreviousMonthKey(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return getMonthKey(d.toISOString());
}

interface MonthStats {
  income: number;
  expense: number;
  savings: number;
}

function aggregateMonth(transactions: Transaction[], monthKey: string): MonthStats {
  let income = 0;
  let expense = 0;

  for (const tx of transactions) {
    if (getMonthKey(tx.date) !== monthKey) continue;
    const amount = Math.abs(tx.amount);
    if (tx.type === "income") income += amount;
    else if (isExpenseTransaction(tx)) expense += amount;
  }

  return { income, expense, savings: income - expense };
}

function DeltaBadge({ current, previous, inverse }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0) return null;

  const delta = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(delta) < 0.5) return null;

  const isPositive = delta > 0;
  const isGood = inverse ? !isPositive : isPositive;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-medium",
        isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
      )}
    >
      {isPositive ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
      {Math.abs(delta).toFixed(0)}%
    </span>
  );
}

function StatRow({
  label,
  current,
  previous,
  inverse,
}: {
  label: string;
  current: number;
  previous: number;
  inverse?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatCompactIDR(current)}
        </span>
        <DeltaBadge current={current} previous={previous} inverse={inverse} />
      </div>
    </div>
  );
}

export default function MonthlyComparisonCard({ transactions, className }: Props) {
  const currentMonth = getCurrentMonthKey();
  const previousMonth = getPreviousMonthKey();

  const current = aggregateMonth(transactions, currentMonth);
  const previous = aggregateMonth(transactions, previousMonth);

  // Don't show if no data at all
  if (current.income === 0 && current.expense === 0 && previous.income === 0 && previous.expense === 0) {
    return null;
  }

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const now = new Date();
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevLabel = monthNames[prevDate.getMonth()];
  const currLabel = monthNames[now.getMonth()];

  return (
    <div
      className={cn(
        "rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-sm sm:rounded-[30px] md:p-5",
        className
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Bulanan
        </p>
        <div className="flex gap-3 text-[11px] text-muted-foreground">
          <span>{currLabel} vs {prevLabel}</span>
        </div>
      </div>

      <div className="divide-y divide-border/50">
        <StatRow label="Pemasukan" current={current.income} previous={previous.income} />
        <StatRow label="Pengeluaran" current={current.expense} previous={previous.expense} inverse />
        <StatRow label="Tabungan" current={current.savings} previous={previous.savings} />
      </div>
    </div>
  );
}
