"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Transaction } from "@/components/TransactionCard";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { formatCompactIDR, formatSignedIDR } from "@/lib/format";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { cn } from "@/lib/utils";

const ID_MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type WeekBucket = {
  label: string;
  startDay: number;
  endDay: number;
  income: number;
  expense: number;
  isFuture: boolean;
  isCurrent: boolean;
};

export interface MiniCashflowCardProps {
  transactions: Transaction[];
  monthlyIncome: number;
  monthlyExpense: number;
  surplus: number;
  /** YYYY-MM string for current month. If omitted, derived from new Date(). */
  month?: string;
  /** "Today" anchor in YYYY-MM-DD. If omitted, derived from new Date(). */
  today?: string;
}

function parseYearMonth(yyyyMM: string): { year: number; month0: number } {
  const [y, m] = yyyyMM.split("-").map((s) => parseInt(s, 10));
  return { year: y, month0: m - 1 };
}

export default function MiniCashflowCard({
  transactions,
  monthlyIncome,
  monthlyExpense,
  surplus,
  month,
  today,
}: MiniCashflowCardProps) {
  const ym = month ?? new Date().toISOString().slice(0, 7);
  const todayStr = today ?? new Date().toISOString().slice(0, 10);
  const { year, month0 } = parseYearMonth(ym);
  const todayDay = todayStr.startsWith(ym) ? parseInt(todayStr.slice(8, 10), 10) : 31;
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const monthLabel = `${ID_MONTH_NAMES[month0]} ${year}`;

  const buckets = useMemo<WeekBucket[]>(() => {
    const ranges = buildWeekRanges(daysInMonth);
    const rows: WeekBucket[] = ranges.map((r, i) => ({
      label: `M${i + 1}`,
      startDay: r.start,
      endDay: r.end,
      income: 0,
      expense: 0,
      isFuture: r.start > todayDay,
      isCurrent: todayDay >= r.start && todayDay <= r.end,
    }));

    for (const t of transactions) {
      if (!t.date.startsWith(ym)) continue;
      const day = parseInt(t.date.slice(8, 10), 10);
      if (Number.isNaN(day)) continue;
      const bucket = rows.find((r) => day >= r.startDay && day <= r.endDay);
      if (!bucket) continue;
      if (t.type === "income") bucket.income += t.amount;
      else if (isExpenseTransaction(t)) bucket.expense += t.amount;
    }
    return rows;
  }, [transactions, ym, daysInMonth, todayDay]);

  const maxValue = Math.max(
    1,
    ...buckets.flatMap((b) => [b.income, b.expense])
  );

  return (
    <SectionCard eyebrow="Analytics" title={`Cashflow ${monthLabel}`} dense>
      <div className="mb-3.5 grid grid-cols-2 gap-2">
        <CFStat tone="income" label="Pemasukan" value={monthlyIncome} />
        <CFStat tone="expense" label="Pengeluaran" value={monthlyExpense} />
      </div>

      <div className="flex h-[72px] items-end gap-2 px-0.5">
        {buckets.map((b) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={cn(
                "flex w-full items-end justify-center gap-1",
                "h-[58px]"
              )}
            >
              {b.isFuture ? (
                <div className="h-3 w-[80%] rounded-md border border-dashed border-border/70 bg-muted/40" />
              ) : (
                <>
                  <Bar
                    value={b.income}
                    max={maxValue}
                    tone="income"
                    dim={b.isCurrent}
                  />
                  <Bar
                    value={b.expense}
                    max={maxValue}
                    tone="expense"
                    dim={b.isCurrent}
                  />
                </>
              )}
            </div>
            <span className="text-[9.5px] font-medium tracking-[0.04em] text-muted-foreground">
              {b.label}
            </span>
          </div>
        ))}
      </div>

      <div
        className={cn(
          "mt-3 flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
          surplus >= 0
            ? "border-emerald-500/25 bg-emerald-500/8"
            : "border-destructive/25 bg-destructive/8"
        )}
      >
        <span
          className={cn(
            "text-[11.5px] font-medium",
            surplus >= 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-destructive"
          )}
        >
          {surplus >= 0 ? "✅ Surplus bulan ini" : "⚠️ Defisit bulan ini"}
        </span>
        <span
          className={cn(
            "text-[13px] font-bold tracking-tight",
            surplus >= 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-destructive"
          )}
        >
          {formatSignedIDR(surplus, "+")}
        </span>
      </div>
    </SectionCard>
  );
}

function CFStat({
  tone,
  label,
  value,
}: {
  tone: "income" | "expense";
  label: string;
  value: number;
}) {
  const isIncome = tone === "income";
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        isIncome
          ? "border-emerald-500/25 bg-emerald-500/8"
          : "border-destructive/25 bg-destructive/8"
      )}
    >
      <div
        className={cn(
          "mb-0.5 flex items-center gap-1 text-[10.5px] font-medium",
          isIncome
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-destructive"
        )}
      >
        {isIncome ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
        {label}
      </div>
      <p
        className={cn(
          "text-[15px] font-bold tracking-tight",
          isIncome
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-destructive"
        )}
      >
        {formatCompactIDR(value)}
      </p>
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
  const minPx = value > 0 ? 3 : 0;
  return (
    <div
      className={cn(
        "w-[44%] rounded-t-md transition-[height] duration-500",
        tone === "income" ? "bg-emerald-500" : "bg-destructive opacity-70",
        dim && "opacity-60"
      )}
      style={{
        height: `max(${minPx}px, ${pct}%)`,
      }}
    />
  );
}

function buildWeekRanges(daysInMonth: number): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let start = 1;
  while (start <= daysInMonth) {
    const end = Math.min(daysInMonth, start + 6);
    ranges.push({ start, end });
    start = end + 1;
  }
  while (ranges.length < 4) {
    ranges.push({ start: daysInMonth + 1, end: daysInMonth + 1 });
  }
  return ranges.slice(0, 5);
}
