"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataEvent } from "@/lib/data-events";

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
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((noStore = false) => {
    setLoading(true);
    fetch("/api/accounts", noStore ? { cache: "no-store" } : undefined)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.summary && typeof d.summary.netWorth === "string") {
          setData(d);
        } else {
          setData(null);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [refreshTrigger, load]);

  useDataEvent(["transactions", "accounts"], () => load(true));

  if (loading) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-[26px] border border-border/70 bg-background",
          compact ? "p-4" : "p-6"
        )}
        style={{ minHeight: compact ? 128 : 192 }}
      >
        <div className="mb-2 h-3.5 w-32 rounded bg-muted" />
        <div className={cn("mb-4 rounded bg-muted", compact ? "h-7 w-44" : "h-10 w-64")} />
        <div className={cn("rounded-[20px] bg-muted", compact ? "h-12" : "h-20")} />
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={cn("rounded-[26px] border border-border/70 bg-background", compact ? "p-4" : "p-6")}
        style={{ minHeight: compact ? 128 : 192 }}
      >
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="size-3.5" />
          <span>Kekayaan Bersih</span>
        </div>
        <div className={cn("font-bold tracking-tight text-muted-foreground", compact ? "text-2xl" : "text-4xl")}>-</div>
        <div className="mt-3 text-xs text-muted-foreground">Data belum tersedia</div>
      </div>
    );
  }

  const netWorth = parseFloat(data.summary.netWorth);
  const assets = parseFloat(data.summary.assets);
  const liabilities = parseFloat(data.summary.liabilities);
  const isPositive = netWorth >= 0;

  const TrendIcon = netWorth > 0 ? TrendingUp : netWorth < 0 ? TrendingDown : Minus;

  return (
    <Link href="/dashboard/accounts" className="block group">
      <div
        className={cn(
          "flex h-full flex-col rounded-[26px] border border-border/70 bg-background transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35",
          compact ? "p-4" : "p-6"
        )}
      >
        <div className={cn("flex items-center justify-between", compact ? "mb-2" : "mb-3")}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="size-3.5" />
            <span>Kekayaan Bersih</span>
          </div>
          <span className="text-xs text-muted-foreground transition-colors group-hover:text-primary">
            Lihat akun {"->"}
          </span>
        </div>

        <div className={cn("flex items-center gap-2", compact ? "mb-3" : "mb-5")}>
          <TrendIcon
            className={cn(
              "shrink-0",
              compact ? "size-4" : "size-6",
              isPositive ? "text-emerald-500" : "text-red-500"
            )}
          />
          <span
            className={cn(
              "break-words font-bold leading-none tracking-tight",
              compact ? "text-2xl md:text-[28px]" : "text-[40px] md:text-[46px]",
              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {formatIDR(netWorth)}
          </span>
        </div>

        <div className={cn("mt-auto grid text-xs text-muted-foreground sm:grid-cols-3", compact ? "gap-2" : "gap-3")}>
          <div className={cn("rounded-2xl bg-muted/50", compact ? "px-3 py-2" : "px-4 py-3")}>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Aset</span>
            <p className={cn("mt-1 font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{formatIDR(assets)}</p>
          </div>
          <div className={cn("rounded-2xl bg-muted/50", compact ? "px-3 py-2" : "px-4 py-3")}>
            <span className="font-medium text-red-500">Liabilitas</span>
            <p className={cn("mt-1 font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{formatIDR(liabilities)}</p>
          </div>
          <div className={cn("rounded-2xl bg-primary/10", compact ? "px-3 py-2" : "px-4 py-3")}>
            <span className="font-medium text-foreground">Net asset</span>
            <p className={cn("mt-1 font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{formatIDR(netWorth)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
