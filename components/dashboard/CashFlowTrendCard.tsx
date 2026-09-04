"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { Transaction } from "@/components/TransactionCard";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { formatCompactIDR, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
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

function getDateRange6Months(): { from: string; to: string } {
  const now = new Date();
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: firstMonth.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10),
  };
}

function formatMonthLabel(ym: string): string {
  const [, m] = ym.split("-").map(Number);
  return ID_MONTH_SHORT[m - 1];
}

interface MonthData {
  income: number;
  expense: number;
}

export default function CashFlowTrendCard({ className }: Props) {
  const months = useMemo(() => getLast6Months(), []);
  const currentMonth = useMemo(() => getMonthKey(new Date().toISOString()), []);
  const [allTx, setAllTx] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useEffect(() => {
    const { from, to } = getDateRange6Months();
    fetch(`/api/record?period=custom:${from}:${to}`, {
      headers: { "Cache-Control": "no-cache" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.transactions) setAllTx(data.transactions);
      })
      .catch(() => {});
  }, []);

  const monthData = useMemo(() => {
    const data: Record<string, MonthData> = {};
    for (const m of months) data[m] = { income: 0, expense: 0 };
    for (const tx of allTx) {
      const mk = getMonthKey(tx.date);
      if (!data[mk]) continue;
      if (tx.type === "income") data[mk].income += Math.abs(tx.amount);
      else if (isExpenseTransaction(tx)) data[mk].expense += Math.abs(tx.amount);
    }
    return data;
  }, [allTx, months]);

  const maxValue = Math.max(
    1,
    ...months.flatMap((m) => [monthData[m].income, monthData[m].expense])
  );
  const selected = monthData[selectedMonth] ?? { income: 0, expense: 0 };
  const net = selected.income - selected.expense;

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

      <div className="mb-3 flex h-[126px] items-end gap-1 px-0.5">
        {months.map((m) => {
          const d = monthData[m];
          const isCurrent = m === currentMonth;
          const isSelected = m === selectedMonth;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMonth(m)}
              aria-label={`${formatMonthLabel(m)}: pemasukan ${formatIDR(d.income)}, pengeluaran ${formatIDR(d.expense)}`}
              aria-pressed={isSelected}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-0.5 pt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected && "bg-muted/50"
              )}
            >
              <div className="grid w-full grid-cols-2 gap-px text-center text-[8px] font-medium tabular-nums sm:text-[9px]">
                <span className="truncate text-emerald-600 dark:text-emerald-400">
                  {formatCompactIDR(d.income).replace("Rp ", "")}
                </span>
                <span className="truncate text-destructive">
                  {formatCompactIDR(d.expense).replace("Rp ", "")}
                </span>
              </div>
              <div className="flex h-[86px] w-full items-end justify-center gap-[2px]">
                <Bar value={d.income} max={maxValue} tone="income" dim={!isCurrent && !isSelected} />
                <Bar value={d.expense} max={maxValue} tone="expense" dim={!isCurrent && !isSelected} />
              </div>
              <span className={cn("text-[9.5px] font-medium", isCurrent || isSelected ? "text-foreground" : "text-muted-foreground")}>
                {formatMonthLabel(m)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 rounded-xl border border-border/60 bg-muted/25 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">{formatMonthLabel(selectedMonth)} {selectedMonth.slice(0, 4)}</p>
          <span className={cn("text-xs font-semibold tabular-nums", net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            Selisih {net >= 0 ? "+" : "−"}{formatIDR(Math.abs(net))}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <DetailValue label="Pemasukan" value={selected.income} />
          <DetailValue label="Pengeluaran" value={selected.expense} red />
        </div>
      </div>

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

      <div className="mt-3 grid grid-cols-2 gap-2">
        <SummaryItem
          label="Rata-rata income"
          value={months.reduce((sum, m) => sum + monthData[m].income, 0) / months.length}
        />
        <SummaryItem
          label="Rata-rata expense"
          value={months.reduce((sum, m) => sum + monthData[m].expense, 0) / months.length}
          red
        />
      </div>
    </div>
  );
}

function DetailValue({ label, value, red = false }: { label: string; value: number; red?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={cn("font-semibold tabular-nums", red ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
        {formatIDR(value)}
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
