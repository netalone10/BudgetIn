"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactIDR } from "@/lib/format";

/**
 * Spending Velocity Card — shows how fast the user is spending relative to
 * their monthly budget. Projects whether they'll be over or under budget
 * by end of month based on current daily burn rate.
 */

interface Props {
  totalBudget: number;
  totalSpent: number;
  className?: string;
}

function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export default function SpendingVelocityCard({
  totalBudget,
  totalSpent,
  className,
}: Props) {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = getDaysInMonth(now);
  const daysRemaining = daysInMonth - dayOfMonth;

  const dailyBurnRate = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0;
  const projectedTotal = dailyBurnRate * daysInMonth;
  const projectedOver = totalBudget > 0 ? projectedTotal - totalBudget : 0;
  const pctUsed =
    totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  const barColor =
    pctUsed < 70
      ? "bg-emerald-500"
      : pctUsed < 90
        ? "bg-amber-500"
        : "bg-red-500";

  const barBg =
    pctUsed < 70
      ? "bg-emerald-500/15"
      : pctUsed < 90
        ? "bg-amber-500/15"
        : "bg-red-500/15";

  const isOverBudget = projectedOver > 0;

  return (
    <div
      className={cn(
        "rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-sm sm:rounded-[30px] md:p-5",
        className
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        {isOverBudget ? (
          <TrendingUp className="size-4 text-red-500" />
        ) : (
          <TrendingDown className="size-4 text-emerald-500" />
        )}
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Spending Velocity
        </p>
      </div>

      <p className="mb-3 text-lg font-bold tabular-nums text-foreground">
        {formatCompactIDR(totalSpent)}
        <span className="text-sm font-medium text-muted-foreground">
          {" "}
          / {formatCompactIDR(totalBudget)}
        </span>
      </p>

      {/* Progress bar */}
      <div className={cn("mb-3 h-2 w-full rounded-full", barBg)}>
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(100, pctUsed)}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {Math.round(pctUsed)}% terpakai · {daysRemaining} hari tersisa
        </span>
      </div>

      {/* Projection */}
      {totalBudget > 0 && dayOfMonth >= 3 && (
        <div
          className={cn(
            "mt-3 rounded-xl px-3 py-2 text-xs font-medium",
            isOverBudget
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {isOverBudget
            ? `Di rate ini, lo bakal over budget ${formatCompactIDR(projectedOver)}`
            : `Sisa budget aman — masih ada ${formatCompactIDR(totalBudget - projectedTotal)} sampai akhir bulan`}
        </div>
      )}
    </div>
  );
}
