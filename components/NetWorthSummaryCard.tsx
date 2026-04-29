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

function formatIDR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

interface Props {
  refreshTrigger?: number;
}

export default function NetWorthSummaryCard({ refreshTrigger = 0 }: Props) {
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

  // Match the rendered card height (~108px) to keep layout stable & avoid CLS.
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 animate-pulse" style={{ minHeight: 108 }}>
        <div className="h-3.5 w-32 bg-muted rounded mb-2" />
        <div className="h-7 w-48 bg-muted rounded mb-3" />
        <div className="h-3 w-3/4 bg-muted rounded" />
      </div>
    );
  }

  // On error, render a placeholder card instead of null so height stays consistent.
  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4" style={{ minHeight: 108 }}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Wallet className="h-3.5 w-3.5" />
          <span>Kekayaan Bersih</span>
        </div>
        <div className="text-2xl font-bold tracking-tight text-muted-foreground">—</div>
        <div className="text-xs text-muted-foreground mt-2">Data belum tersedia</div>
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
      <div className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-card/80 transition-all duration-200">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span>Kekayaan Bersih</span>
          </div>
          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
            Lihat akun →
          </span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <TrendIcon
            className={cn(
              "h-5 w-5 shrink-0",
              isPositive ? "text-emerald-500" : "text-red-500"
            )}
          />
          <span
            className={cn(
              "text-2xl font-bold tracking-tight",
              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {formatIDR(netWorth)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Aset</span>{" "}
            {formatIDR(assets)}
          </span>
          <span>|</span>
          <span>
            <span className="text-red-500 font-medium">Liabilitas</span>{" "}
            {formatIDR(liabilities)}
          </span>
          <span>|</span>
          <span>
            <span className="text-foreground font-medium">Net Asset</span>{" "}
            {formatIDR(netWorth)}
          </span>
        </div>
      </div>
    </Link>
  );
}
