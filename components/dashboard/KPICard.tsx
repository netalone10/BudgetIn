"use client";

import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactIDR, formatSignedIDR } from "@/lib/format";

export type KPIType = "net" | "income" | "expense" | "savings";

export interface KPICardProps {
  type: KPIType;
  label: string;
  value: number;
  /** Suffix appended to value (e.g. "%"). When set, value is rendered with toFixed(1). */
  suffix?: string;
  /** Delta vs last month for trend display. Sign convention: positive = increase. */
  delta?: number;
  /** Custom trend label override (rendered as-is). */
  trendLabel?: string;
  /** For expense cards: when true, a *negative* delta is considered "good" (more savings). */
  expenseSemantics?: boolean;
  /** Compact monetary value (use jt/M). */
  compact?: boolean;
  className?: string;
}

const ACCENT_CLASS: Record<KPIType, string> = {
  net: "before:bg-primary",
  income: "before:bg-emerald-500",
  expense: "before:bg-destructive",
  savings: "before:bg-amber-500",
};

const VALUE_TONE: Record<KPIType, string> = {
  net: "text-foreground",
  income: "text-emerald-600 dark:text-emerald-400",
  expense: "text-destructive",
  savings: "text-amber-600 dark:text-amber-400",
};

export default function KPICard({
  type,
  label,
  value,
  suffix,
  delta,
  trendLabel,
  expenseSemantics = false,
  compact = true,
  className,
}: KPICardProps) {
  const displayValue = suffix
    ? `${value.toFixed(1)}${suffix}`
    : compact
      ? formatCompactIDR(value)
      : `Rp ${value.toLocaleString("id-ID")}`;

  const trend = computeTrend(delta, expenseSemantics);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] border border-border/70 bg-card p-4 shadow-sm",
        "before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[20px] before:content-['']",
        ACCENT_CLASS[type],
        className
      )}
    >
      <p className="label-mono text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 truncate text-[18px] font-bold tracking-tight md:text-[22px]",
          VALUE_TONE[type]
        )}
      >
        {displayValue}
      </p>
      {(trendLabel || trend) && (
        <div
          className={cn(
            "mt-1.5 flex min-w-0 items-center gap-1 text-[11.5px] font-medium",
            trend?.tone === "up" && "text-emerald-600 dark:text-emerald-400",
            trend?.tone === "down" && "text-destructive",
            trend?.tone === "neutral" && "text-muted-foreground"
          )}
        >
          {trend?.icon}
          <span className="line-clamp-2">{trendLabel ?? trend?.label}</span>
        </div>
      )}
    </div>
  );
}

function computeTrend(
  delta: number | undefined,
  expenseSemantics: boolean
): { label: string; tone: "up" | "down" | "neutral"; icon: React.ReactNode } | null {
  if (delta === undefined || Number.isNaN(delta)) return null;

  if (Math.abs(delta) < 1) {
    return {
      label: "Sama dengan bulan lalu",
      tone: "neutral",
      icon: <Minus className="size-3" />,
    };
  }

  const isPositive = delta > 0;
  const tone: "up" | "down" = expenseSemantics
    ? isPositive
      ? "down"
      : "up"
    : isPositive
      ? "up"
      : "down";

  const icon =
    tone === "up" ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />;

  const formatted = formatSignedIDR(delta, "+");
  const suffix = expenseSemantics
    ? tone === "up"
      ? " · lebih hemat"
      : " · lebih boros"
    : "";

  return {
    label: `${formatted} vs bulan lalu${suffix}`,
    tone,
    icon,
  };
}
