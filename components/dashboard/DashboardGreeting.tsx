"use client";

import { ArrowDown, ArrowUp, ArrowLeftRight, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSignedIDR } from "@/lib/format";

type TodayStats = {
  expense: number;
  income: number;
  count: number;
  incomeCount: number;
};

export interface DashboardGreetingProps {
  todayStats: TodayStats;
  onQuickAction: (kind: "expense" | "income" | "transfer") => void;
  onRefresh: () => void;
  refreshing?: boolean;
  /** When true, shows a subtle background-sync indicator (SWR revalidation in progress) */
  isRevalidating?: boolean;
}

/**
 * Action bar di bawah greeting header. Greeting heading + tanggal kini dirender
 * server-side di app/dashboard/page.tsx (di luar Suspense) sebagai elemen LCP
 * yang tercat instan; komponen ini hanya memuat ringkasan "hari ini" + tombol
 * aksi cepat yang butuh data/interaktivitas client.
 */
export default function DashboardGreeting({
  todayStats,
  onQuickAction,
  onRefresh,
  refreshing = false,
  isRevalidating = false,
}: DashboardGreetingProps) {
  const todayPill = (() => {
    const parts: string[] = [];
    if (todayStats.expense > 0) {
      parts.push(`${formatSignedIDR(todayStats.expense)} keluar`);
    } else {
      parts.push("belum ada pengeluaran");
    }
    if (todayStats.income > 0) {
      parts.push(`${formatSignedIDR(todayStats.income, "+")} masuk`);
    } else {
      parts.push("belum ada pemasukan");
    }
    return parts.join(" · ");
  })();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[12px] font-medium text-foreground/80">
        <BarChart3 className="size-3.5 text-muted-foreground" />
        <span>Hari ini: {todayPill}</span>
        {isRevalidating && (
          <span
            className="relative ml-1 flex size-2 items-center justify-center opacity-50"
            title="Memperbarui data di background"
            aria-label="Memperbarui data"
            aria-live="polite"
          >
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <QuickAction
          label="Pengeluaran"
          tone="expense"
          icon={<ArrowDown className="size-3.5" />}
          onClick={() => onQuickAction("expense")}
        />
        <QuickAction
          label="Pemasukan"
          tone="income"
          icon={<ArrowUp className="size-3.5" />}
          onClick={() => onQuickAction("income")}
        />
        <QuickAction
          label="Transfer"
          tone="transfer"
          icon={<ArrowLeftRight className="size-3.5" />}
          onClick={() => onQuickAction("transfer")}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  icon,
  onClick,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone: "expense" | "income" | "transfer";
}) {
  const toneClass = {
    expense:
      "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15",
    income:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400",
    transfer:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 dark:text-blue-400",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-all hover:-translate-y-px sm:px-3.5 sm:py-1.5 sm:text-[12.5px]",
        toneClass
      )}
    >
      {icon}
      {label}
    </button>
  );
}
