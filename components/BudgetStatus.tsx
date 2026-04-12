"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface BudgetItem {
  id: string;
  category: string;
  budget: number;
  spent: number;
}

interface BudgetData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  budgets: BudgetItem[];
}

function formatRupiah(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(".0", "")}jt`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}rb`;
  return amount.toString();
}

function formatRupiahFull(amount: number) {
  return new Intl.NumberFormat("id-ID").format(amount);
}

export default function BudgetStatus({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/budget")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  const budgets = data?.budgets ?? [];

  if (loading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Status Budget</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
              <div className="h-3 w-16 rounded bg-muted" />
              <div className="h-5 w-12 rounded bg-muted" />
              <div className="h-1.5 w-full rounded-full bg-muted" />
              <div className="h-3 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Status Budget Bulan Ini</h3>

      {/* Cashflow Summary — only show if there's data */}
      {data && (data.totalIncome > 0 || data.totalExpense > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-muted-foreground">Pemasukan</span>
            </div>
            <p className="text-base font-bold text-green-600 dark:text-green-400 tabular-nums">
              +{formatRupiahFull(data.totalIncome)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs text-muted-foreground">Pengeluaran</span>
            </div>
            <p className="text-base font-bold text-destructive tabular-nums">
              -{formatRupiahFull(data.totalExpense)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Net</span>
            </div>
            <p className={cn(
              "text-base font-bold tabular-nums",
              data.netCashflow >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
            )}>
              {data.netCashflow >= 0 ? "+" : "-"}{formatRupiahFull(Math.abs(data.netCashflow))}
            </p>
          </div>
        </div>
      )}

      {/* Budget Cards Grid */}
      {budgets.length === 0 ? (
        <Card>
          <CardContent className="pt-4 text-sm text-muted-foreground">
            Belum ada budget. Ketik{" "}
            <span className="font-medium text-foreground">
              &quot;Budget makan 500rb&quot;
            </span>{" "}
            untuk mulai.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {budgets.map((item) => {
            const pct = item.budget > 0 ? (item.spent / item.budget) * 100 : 0;
            const isOver = pct >= 100;
            const isNear = pct >= 80 && !isOver;
            const displayPct = Math.min(Math.round(pct), 999);

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border bg-card p-4 space-y-3 transition-colors",
                  isOver && "border-destructive/40 bg-destructive/5",
                  isNear && "border-yellow-500/40 bg-yellow-500/5"
                )}
              >
                {/* Category + % */}
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-medium leading-tight">{item.category}</span>
                  <span className={cn(
                    "text-xs font-bold tabular-nums shrink-0",
                    isOver ? "text-destructive" : isNear ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"
                  )}>
                    {displayPct}%
                  </span>
                </div>

                {/* Spent amount */}
                <p className={cn(
                  "text-lg font-bold tabular-nums leading-none",
                  isOver ? "text-destructive" : isNear ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"
                )}>
                  {formatRupiah(item.spent)}
                </p>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isOver ? "bg-destructive" : isNear ? "bg-yellow-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>

                {/* Budget label */}
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  dari {formatRupiah(item.budget)}
                  {isOver && <span className="text-destructive font-semibold"> · Lewat!</span>}
                  {isNear && <span className="text-yellow-600 dark:text-yellow-400 font-semibold"> · Hampir</span>}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
