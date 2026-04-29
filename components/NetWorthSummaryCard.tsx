"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Wallet, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataEvent } from "@/lib/data-events";

const NetWorthSparkline = dynamic(() => import("./NetWorthSparkline"), {
  ssr: false,
  loading: () => <div className="h-[60px] animate-pulse rounded bg-muted mt-2" />,
});

interface NetWorthData {
  summary: {
    assets: string;
    liabilities: string;
    netWorth: string;
  };
}

interface HistoryPoint {
  month: string;
  netWorth: number;
  assets: number;
  liabilities: number;
}

function formatMonthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "short" });
}

const MONTH_OPTIONS = [3, 6, 12] as const;

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
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const loadHistory = useCallback((m: number) => {
    setHistoryLoading(true);
    fetch(`/api/accounts/networth-history?months=${m}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setHistory(d?.history ?? null))
      .catch(() => setHistory(null))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    loadHistory(months);
  }, [months, loadHistory]);

  useDataEvent(["transactions", "accounts"], () => {
    load(true);
    loadHistory(months);
  });

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
  const sparkColor = isPositive ? "#10b981" : "#ef4444";
  const sparkData = history
    ? history.map((h) => ({ value: h.netWorth, label: formatMonthShort(h.month) }))
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          <span>Kekayaan Bersih</span>
        </div>
        <Link
          href="/dashboard/accounts"
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Lihat akun →
        </Link>
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

      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
        <span>
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Aset</span>{" "}
          {formatIDR(assets)}
        </span>
        <span>|</span>
        <span>
          <span className="text-red-500 font-medium">Liabilitas</span>{" "}
          {formatIDR(liabilities)}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-2">
        {MONTH_OPTIONS.map((m) => (
          <button
            key={m}
            onClick={() => setMonths(m)}
            className={cn(
              "px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors",
              months === m
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {m} Bln
          </button>
        ))}
      </div>

      {historyLoading ? (
        <div className="h-[60px] animate-pulse rounded bg-muted" />
      ) : sparkData && sparkData.length >= 2 ? (
        <div>
          <NetWorthSparkline data={sparkData} color={sparkColor} />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5 px-0.5">
            {sparkData.map((d, i) => {
              const show =
                sparkData.length <= 6 ||
                i === 0 ||
                i === sparkData.length - 1 ||
                i === Math.floor(sparkData.length / 2);
              return show ? (
                <span key={i}>{d.label}</span>
              ) : (
                <span key={i} />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="h-[60px] flex items-center justify-center text-xs text-muted-foreground">
          Data histori belum cukup
        </div>
      )}
    </div>
  );
}
