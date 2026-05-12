"use client";

import { useMemo, useState } from "react";
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

export type CategoryBreakdownEntry = { category: string; amount: number };

export interface CategoryBreakdown {
  expense: CategoryBreakdownEntry[];
  income: CategoryBreakdownEntry[];
  totalExpense: number;
  totalIncome: number;
}

export interface BudgetMiniListCardProps {
  budgets: BudgetItem[] | undefined;
  loading?: boolean;
  /** YYYY-MM */
  month?: string;
  /** Max rows to show. Default 5. */
  limit?: number;
  /** Fallback breakdown shown when there is no budget but there are transactions. */
  categoryBreakdown?: CategoryBreakdown;
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
  categoryBreakdown,
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

  const hasBreakdown =
    !!categoryBreakdown &&
    (categoryBreakdown.expense.length > 0 || categoryBreakdown.income.length > 0);

  const showBreakdownFallback = sorted.length === 0 && hasBreakdown;

  return (
    <SectionCard
      eyebrow="Budget"
      title={showBreakdownFallback ? "Rincian bulan ini" : "Anggaran bulan ini"}
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
      ) : showBreakdownFallback ? (
        <NoBudgetBreakdown breakdown={categoryBreakdown!} limit={limit} />
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

function NoBudgetBreakdown({
  breakdown,
  limit,
}: {
  breakdown: CategoryBreakdown;
  limit: number;
}) {
  const initialTab: "expense" | "income" =
    breakdown.expense.length > 0 ? "expense" : "income";
  const [tab, setTab] = useState<"expense" | "income">(initialTab);

  const entries = tab === "expense" ? breakdown.expense : breakdown.income;
  const total = tab === "expense" ? breakdown.totalExpense : breakdown.totalIncome;
  const rows = entries.slice(0, limit);
  const expenseDisabled = breakdown.expense.length === 0;
  const incomeDisabled = breakdown.income.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-muted-foreground">
          Belum ada budget — ini rincian dari transaksi
        </p>
        <div className="inline-flex rounded-full border border-border/70 bg-background/60 p-0.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setTab("expense")}
            disabled={expenseDisabled}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              tab === "expense"
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:text-foreground",
              expenseDisabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground"
            )}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setTab("income")}
            disabled={incomeDisabled}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              tab === "income"
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:text-foreground",
              incomeDisabled && "cursor-not-allowed opacity-40 hover:text-muted-foreground"
            )}
          >
            Pemasukan
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-center text-[12px] text-muted-foreground">
          {tab === "expense"
            ? "Belum ada pengeluaran bulan ini."
            : "Belum ada pemasukan bulan ini."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => {
            const pct = total > 0 ? (row.amount / total) * 100 : 0;
            return (
              <div key={`${tab}-${row.category}`} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-foreground">
                    <span className="mr-1">{emojiForCategory(row.category)}</span>
                    {row.category}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {Math.round(pct)}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatCompactIDR(row.amount)}
                </p>
                <BudgetProgressBar fillPct={pct} isOver={false} isNear={false} />
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/dashboard/budget"
        className="inline-flex items-center justify-center gap-1 text-[12px] font-semibold text-primary hover:underline"
      >
        <Plus className="size-3.5" />
        Atur budget biar lebih terkontrol
      </Link>
    </div>
  );
}
