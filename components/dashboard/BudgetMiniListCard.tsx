"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { BudgetProgressBar } from "@/components/BudgetProgressBar";
import { formatCompactIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type BudgetItem = {
  id: string;
  category: string;
  budget: number;
  spent: number;
  rollover: number;
};

export interface BudgetMiniListCardProps {
  budgets: BudgetItem[] | undefined;
  loading?: boolean;
  /** YYYY-MM */
  month?: string;
  /** Max rows to show. Default 5. */
  limit?: number;
}

const CATEGORY_EMOJI: Record<string, string> = {
  makan: "🍽",
  "makan & minum": "🍽",
  makanan: "🍽",
  jajan: "🍰",
  transport: "🚗",
  transportasi: "🚗",
  bensin: "⛽",
  parkir: "🅿️",
  hiburan: "🎮",
  belanja: "🛒",
  groceries: "🛒",
  tagihan: "⚡",
  "tagihan & utilitas": "⚡",
  listrik: "💡",
  internet: "📶",
  pulsa: "📱",
  rumah: "🏠",
  sewa: "🏠",
  kesehatan: "💊",
  pendidikan: "📚",
  olahraga: "🏋️",
  travel: "✈️",
  liburan: "🏖️",
  hadiah: "🎁",
  donasi: "🤝",
  investasi: "📈",
  tabungan: "💰",
};

function emojiForCategory(name: string): string {
  return CATEGORY_EMOJI[name.toLowerCase()] ?? "📂";
}

function classifyBudget(spent: number, totalBudget: number): "safe" | "warn" | "over" {
  if (totalBudget <= 0) return "safe";
  const pct = (spent / totalBudget) * 100;
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "safe";
}

const BADGE_CLASS = {
  safe: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  over: "bg-destructive/12 text-destructive",
} as const;

const BADGE_LABEL = {
  safe: "Aman",
  warn: "Hampir Limit",
  over: "Over Budget",
} as const;

export default function BudgetMiniListCard({
  budgets,
  loading = false,
  limit = 5,
}: BudgetMiniListCardProps) {
  const sorted = useMemo(() => {
    if (!budgets) return [];
    return [...budgets]
      .map((b) => {
        const totalBudget = b.budget + (b.rollover ?? 0);
        const pct = totalBudget > 0 ? b.spent / totalBudget : 0;
        return { ...b, totalBudget, pct };
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, limit);
  }, [budgets, limit]);

  return (
    <SectionCard
      eyebrow="Budget"
      title="Anggaran bulan ini"
      dense
      action={
        <Link
          href="/dashboard/budget"
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          Kelola →
        </Link>
      }
    >
      {loading && sorted.length === 0 ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyBudget />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((b) => {
            const status = classifyBudget(b.spent, b.totalBudget);
            return (
              <div key={b.id} className="flex flex-col gap-1">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <span className="truncate text-[13px] font-semibold text-foreground">
                    <span className="mr-1">{emojiForCategory(b.category)}</span>
                    {b.category}
                  </span>
                  <span
                    className={cn(
                      "w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      BADGE_CLASS[status]
                    )}
                  >
                    {BADGE_LABEL[status]}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatCompactIDR(b.spent)} / {formatCompactIDR(b.totalBudget)}
                </p>
                <BudgetProgressBar
                  fillPct={b.totalBudget > 0 ? (b.spent / b.totalBudget) * 100 : 0}
                  isOver={status === "over"}
                  isNear={status === "warn"}
                />
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function EmptyBudget() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-background/60 p-5 text-center">
      <p className="text-[13px] font-medium text-foreground">
        Belum ada anggaran bulan ini
      </p>
      <p className="text-[11.5px] text-muted-foreground">
        Atur batas pengeluaran per kategori biar pengeluaran nggak kebablasan.
      </p>
      <Link
        href="/dashboard/budget"
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/8 px-3.5 py-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-primary/12"
      >
        <Plus className="size-3.5" />
        Buat budget pertama
      </Link>
    </div>
  );
}
