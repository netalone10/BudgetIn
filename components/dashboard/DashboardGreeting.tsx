"use client";

import { useEffect, useState } from "react";
import { toZonedTime } from "date-fns-tz";
import { ArrowDown, ArrowUp, ArrowLeftRight, RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSignedIDR, formatTanggalLengkapID } from "@/lib/format";

const TIMEZONE = "Asia/Jakarta";

type TodayStats = {
  expense: number;
  income: number;
  count: number;
  incomeCount: number;
};

export interface DashboardGreetingProps {
  userName?: string | null;
  todayStats: TodayStats;
  onQuickAction: (kind: "expense" | "income" | "transfer") => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

function pickGreeting(hour: number): string {
  if (hour < 5) return "Selamat malam";
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export default function DashboardGreeting({
  userName,
  todayStats,
  onQuickAction,
  onRefresh,
  refreshing = false,
}: DashboardGreetingProps) {
  const [greeting, setGreeting] = useState("Halo");
  const [dateLabel, setDateLabel] = useState("");

  useEffect(() => {
    const now = toZonedTime(new Date(), TIMEZONE);
    setGreeting(pickGreeting(now.getHours()));
    setDateLabel(formatTanggalLengkapID(now));
  }, []);

  const firstName = userName?.split(" ")[0]?.trim();
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
    <header className="rounded-[24px] border border-border/70 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            {greeting}
            {firstName ? `, ${firstName}` : ""}! <span aria-hidden>👋</span>
          </h1>
          <p className="text-[13px] font-medium text-muted-foreground">
            {dateLabel || " "}
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[12px] font-medium text-foreground/80">
            <BarChart3 className="size-3.5 text-muted-foreground" />
            <span>Hari ini: {todayPill}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
    </header>
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
