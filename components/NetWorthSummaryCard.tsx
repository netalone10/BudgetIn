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

  if (loading) {
    return (
      <div className="rounded-[26px] border border-border/70 bg-background p-6 animate-pulse" style={{ minHeight: 192 }}>
        <div className="mb-2 h-3.5 w-32 rounded bg-muted" />
        <div className="mb-4 h-10 w-64 rounded bg-muted" />
        <div className="h-20 rounded-[20px] bg-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[26px] border border-border/70 bg-background p-6" style={{ minHeight: 192 }}>
        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          <span>Kekayaan Bersih</span>
        </div>
        <div className="text-4xl font-bold tracking-tight text-muted-foreground">-</div>
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
      <div className="flex h-full flex-col rounded-[26px] border border-border/70 bg-background p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            <span>Kekayaan Bersih</span>
          </div>
          <span className="text-xs text-muted-foreground transition-colors group-hover:text-primary">
            Lihat akun {"->"}
          </span>
        </div>

        <div className="mb-5 flex items-center gap-2">
          <TrendIcon
            className={cn(
              "h-6 w-6 shrink-0",
              isPositive ? "text-emerald-500" : "text-red-500"
            )}
          />
          <span
            className={cn(
              "text-[40px] font-bold leading-none tracking-tight md:text-[46px]",
              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {formatIDR(netWorth)}
          </span>
        </div>

        <div className="mt-auto grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
          <div className="rounded-2xl bg-muted/50 px-4 py-3">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Aset</span>
            <p className="mt-1 text-base font-semibold text-foreground">{formatIDR(assets)}</p>
          </div>
          <div className="rounded-2xl bg-muted/50 px-4 py-3">
            <span className="font-medium text-red-500">Liabilitas</span>
            <p className="mt-1 text-base font-semibold text-foreground">{formatIDR(liabilities)}</p>
          </div>
          <div className="rounded-2xl bg-primary/10 px-4 py-3">
            <span className="font-medium text-foreground">Net asset</span>
            <p className="mt-1 text-base font-semibold text-foreground">{formatIDR(netWorth)}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
