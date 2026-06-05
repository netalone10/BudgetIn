"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { computeBudgetAlerts, type BudgetAlertInput } from "@/lib/budget-alerts";
import { formatCompactIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Kartu peringatan budget di dashboard. Hanya muncul jika ada kategori yang
 * mendekati (>=80%) atau melewati (>=100%) budget efektif. Angka memakai data
 * budget yang sama dengan halaman Budget (budget + rollover, spent sudah
 * mengecualikan transfer/equity).
 */
export default function BudgetAlertCard({ budgets }: { budgets?: BudgetAlertInput[] }) {
  const alerts = computeBudgetAlerts(budgets ?? []);
  if (alerts.length === 0) return null;

  const overCount = alerts.filter((a) => a.level === "over").length;

  return (
    <div className="rounded-[22px] border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="mb-2.5 flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Peringatan Budget
        </p>
        <span className="ml-auto rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          {overCount > 0 ? `${overCount} over` : `${alerts.length} dekat limit`}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {alerts.slice(0, 5).map((a) => {
          const isOver = a.level === "over";
          // Over selalu tampil > 100% (ceil); warn selalu <= 100% (floor) supaya
          // 99,x% tidak terlihat seperti "100%" yang membingungkan.
          const pct = isOver ? Math.ceil(a.ratio * 100) : Math.floor(a.ratio * 100);
          return (
            <li key={a.category} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-foreground">
                  {a.category}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[12px] font-bold tabular-nums",
                    isOver ? "text-destructive" : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {pct}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="tabular-nums">
                  {formatCompactIDR(a.spent)} / {formatCompactIDR(a.effectiveBudget)}
                </span>
                {isOver && (
                  <span className="font-medium text-destructive">Over budget</span>
                )}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", isOver ? "bg-destructive" : "bg-amber-500")}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        href="/dashboard/budget"
        className="mt-3 inline-block text-[12px] font-medium text-amber-700 hover:underline dark:text-amber-400"
      >
        Kelola budget &rarr;
      </Link>
    </div>
  );
}
