"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataEvent } from "@/lib/data-events";
import { useApi } from "@/lib/hooks/use-api";

interface NetWorthData {
  summary: {
    assets: string;
    liabilities: string;
    netWorth: string;
  };
}

const IDR_FORMAT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatIDR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return IDR_FORMAT.format(num);
}

interface Props {
  refreshTrigger?: number;
  compact?: boolean;
}

export default function NetWorthSummaryCard({ refreshTrigger = 0, compact = false }: Props) {
  const { data: raw, isLoading: loading, mutate } = useApi<NetWorthData>("/api/accounts");

  // Only treat a well-formed payload as data; anything else renders the empty state.
  const data =
    raw && raw.summary && typeof raw.summary.netWorth === "string" ? raw : null;

  // Parent bumps refreshTrigger to force a refetch after an action.
  useEffect(() => {
    if (refreshTrigger) void mutate();
  }, [refreshTrigger, mutate]);

  useDataEvent(["transactions", "accounts"], () => {
    void mutate();
  });

  if (loading) {
    return (
      <div
        className={cn(
          "relative animate-pulse overflow-hidden rounded-[20px] border border-border/70 bg-card p-4 shadow-sm",
          "before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[20px] before:bg-primary before:content-['']",
          !compact && "p-6"
        )}
      >
        <div className="mb-2 h-3 w-28 rounded bg-muted" />
        <div className={cn("rounded bg-muted", compact ? "h-6 w-36" : "h-10 w-64")} />
        <div className="mt-1.5 h-3 w-24 rounded bg-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-[20px] border border-border/70 bg-card p-4 shadow-sm",
          "before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[20px] before:bg-primary before:content-['']",
          !compact && "p-6"
        )}
      >
        <p className="label-mono text-muted-foreground">Kekayaan Bersih</p>
        <p className="mt-1.5 text-[18px] font-bold tracking-tight text-muted-foreground md:text-[22px]">-</p>
        <p className="mt-1.5 text-[11.5px] font-medium text-muted-foreground">Data belum tersedia</p>
      </div>
    );
  }

  const netWorth = parseFloat(data.summary.netWorth);
  const isPositive = netWorth >= 0;

  const TrendIcon = netWorth > 0 ? TrendingUp : netWorth < 0 ? TrendingDown : Minus;

  return (
    <Link href="/dashboard/accounts" className="group block min-w-0 h-full">
      <div
        className={cn(
          "relative h-full overflow-hidden rounded-[20px] border border-border/70 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35",
          "before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[20px] before:bg-primary before:content-['']",
          !compact && "p-6"
        )}
      >
        <div className="flex items-center justify-between">
          <p className="label-mono text-muted-foreground">Kekayaan Bersih</p>
          <span className="text-[10px] font-medium text-muted-foreground transition-colors group-hover:text-primary">
            Lihat akun →
          </span>
        </div>

        <p
          className={cn(
            "mt-1.5 truncate text-[18px] font-bold tracking-tight md:text-[22px]",
            isPositive ? "text-foreground" : "text-destructive"
          )}
        >
          {formatIDR(netWorth)}
        </p>

        <div
          className={cn(
            "mt-1.5 flex min-w-0 items-center gap-1 text-[11.5px] font-medium",
            isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          )}
        >
          <TrendIcon className="size-3 shrink-0" />
          <span className="truncate">{isPositive ? "Aset bersih positif" : "Aset bersih negatif"}</span>
        </div>

        {!compact && (
          <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <span className="font-medium text-emerald-600 dark:text-emerald-400">Aset</span>
              <p className="mt-1 text-base font-semibold text-foreground">{formatIDR(data.summary.assets)}</p>
            </div>
            <div className="rounded-2xl bg-muted/50 px-4 py-3">
              <span className="font-medium text-red-500">Liabilitas</span>
              <p className="mt-1 text-base font-semibold text-foreground">{formatIDR(data.summary.liabilities)}</p>
            </div>
            <div className="rounded-2xl bg-primary/10 px-4 py-3">
              <span className="font-medium text-foreground">Net asset</span>
              <p className="mt-1 text-base font-semibold text-foreground">{formatIDR(netWorth)}</p>
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
