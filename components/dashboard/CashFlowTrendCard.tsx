"use client";

import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import type { Transaction } from "@/components/TransactionCard";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { formatCompactIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Cash Flow Trend Card — 6-month bar chart showing income vs expense per month.
 * Uses pure CSS bars (no recharts dependency) for minimal bundle size.
 */

interface Props {
  transactions: Transaction[];
  className?: string;
}

const ID_MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function getLast6Months(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return ID_MONTH_SHORT[m - 1];
}

interface MonthData {
  income: number;
  expense: number;
}

export default function CashFlowTrendCard({ transactions, className }: Props) {
  const months = useMemo(() => getLast6Months(), []);
  const currentMonth = useMemo(() => getMonthKey(new Date().toISOString()), []);

  const monthData = useMemo(() => {
    const data: Record<string, MonthData> = {};
    for (const m of months) {
      data[m] = { income: 0, expense: 0 };
    }
    for (const tx of transactions) {
      const mk = getMonthKey(tx.date);
      if (!data[mk]) continue;
      if (tx.type === "income") {
        data[mk].income += Math.abs(tx.amount);
      } else if (isExpenseTransaction(tx)) {
        data[mk].expense += Math.abs(tx.amount);
      }
    }
    return data;
  }, [transactions, months]);

  const maxValue = Math.max(
    1,
    ...months.flatMap((m) => [monthData[m].income, monthData[m].expense])
  );

  return (
    <div
      className={cn(
        "rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-sm sm:rounded-[30px] md:p-5",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="size-4 text-blue-500" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Tren 6 Bulan
        </p>
      </div>

      {/* Bar chart */}
      <div className="mb-3 flex h-[100px] items-end gap-1.5 px-0.5">
        {months.map((m) => {
          const d = monthData[m];
          const isCurrent = m === currentMonth;
          return (
            <div key={m} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-[86px] w-full items-end justify-center gap-[2px]">
                <Bar
                  value={d.income}
                  max={maxValue}
                  tone="income"
                  dim={!isCurrent}
                />
                <Bar
                  value={d.expense}
                  max={maxValue}
                  tone="expense"
                  dim={!isCurrent}
                />
              </div>
              <span
                className={cn(
                  "text-[9.5px] font-medium",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {formatMonthLabel(m)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10.5px]">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-emerald-500" />
          <span className="text-muted-foreground">Pemasukan</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-sm bg-destructive opacity-70" />
          <span className="text-muted-foreground">Pengeluaran</span>
        </span>
      </div>

      {/* Summary */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SummaryItem
          label="Rata-rata income"
          value={months.reduce((s, m) => s + monthData[m].income, 0) / months.length}
        />
        <SummaryItem
          label="Rata-rata expense"
          value={months.reduce((s, m) => s + monthData[m].expense, 0) / months.length}
          red
        />
      </div>
    </div>
  );
}

function Bar({
  value,
  max,
  tone,
  dim,
}: {
  value: number;
  max: number;
  tone: "income" | "expense";
  dim: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const minPx = value > 0 ? 2 : 0;
  return (
    <div
      className={cn(
        "w-[44%] rounded-t-sm transition-[height] duration-500",
        tone === "income" ? "bg-emerald-500" : "bg-destructive opacity-70",
        dim && "opacity-50"
      )}
      style={{ height: `max(${minPx}px, ${pct}%)` }}
    />
  );
}

function SummaryItem({
  label,
  value,
  red,
}: {
  label: string;
  value: number;
  red?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10.5px] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-sm font-semibold tabular-nums",
          red ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
        )}
      >
        {formatCompactIDR(value)}
      </p>
    </div>
  );
}
