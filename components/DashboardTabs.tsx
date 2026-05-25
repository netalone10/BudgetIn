"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Transaction } from "@/components/TransactionCard";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Calendar,
  AlertCircle,
  PiggyBank,
  Pencil,
  Trash2,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getDaysInMonth } from "date-fns/getDaysInMonth";
import { getDate } from "date-fns/getDate";
import { startOfWeek } from "date-fns/startOfWeek";
import { endOfWeek } from "date-fns/endOfWeek";
import { format } from "date-fns/format";
import { isSavingsTransaction } from "@/lib/savings-utils";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { toZonedTime } from "date-fns-tz";
import { BudgetProgressBar } from "@/components/BudgetProgressBar";
import { resolveBudgetType, type BudgetType } from "@/utils/budget-type";

const TIMEZONE = "Asia/Jakarta";

const ID_NUMBER_FORMAT = new Intl.NumberFormat("id-ID");

function fmt(n: number) {
  return ID_NUMBER_FORMAT.format(Math.abs(n));
}

function fmtSigned(n: number, positivePrefix = "+") {
  const sign = n < 0 ? "-" : positivePrefix;
  return `${sign}${fmt(n)}`;
}

function fmtEffect(type: "income" | "expense", amount: number) {
  const effective = type === "income" ? amount : -amount;
  return fmtSigned(effective);
}

function fmtCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace(".0", "")}jt`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(0)}rb`;
  return abs.toString();
}

function displayPct(pct: number) {
  return Math.min(Math.round(pct), 999);
}

function getBudgetProgress(spent: number, total: number, prorated: number) {
  const totalPct = total > 0 ? (spent / total) * 100 : 0;
  const prorataPctOfTotal = total > 0 ? (prorated / total) * 100 : 0;
  const allowancePct = prorated > 0 ? (spent / prorated) * 100 : 0;

  return {
    totalPct,
    prorataPctOfTotal,
    allowancePct,
    totalDisplayPct: displayPct(totalPct),
    prorataDisplayPct: displayPct(prorataPctOfTotal),
  };
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

interface BudgetItem {
  id: string;
  categoryId: string;
  category: string;
  budget: number;
  spent: number;
  rollover: number;
  rolloverEnabled: boolean;
  budgetType: BudgetType;
}

export interface BudgetData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  budgets: BudgetItem[];
  unbudgeted?: { category: string; spent: number }[];
}

function isFixed(item: BudgetItem): boolean {
  return resolveBudgetType(item.category, item.budgetType) === "fixed";
}

type Period = "today" | "week" | "month" | "custom";

interface Props {
  transactions: Transaction[];
  budgetData: BudgetData | null;
  loading: boolean;
  onFetchPeriod?: (from: string, to: string) => void;
  customTransactions?: Transaction[];
  customLoading?: boolean;
  savingsCategoryNames?: Set<string>;
  onBudgetChange?: () => void;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hari Ini",
  week: "Minggu Ini",
  month: "Bulan Ini",
  custom: "Custom",
};

export default function DashboardTabs({
  transactions,
  budgetData,
  loading,
  onFetchPeriod,
  customTransactions,
  customLoading = false,
  savingsCategoryNames = new Set(),
  onBudgetChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<"cashflow" | "budget">("cashflow");
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleEditSave(item: BudgetItem) {
    const parsed = parseFloat(editAmount.replace(/\./g, "").replace(",", "."));
    if (!parsed || parsed <= 0) return;

    // Optimistic: close inline editor immediately, fire in background.
    setEditingId(null);
    fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: item.category, amount: parsed }),
    }).then(res => {
      if (res.ok) onBudgetChange?.();
    });
  }

  function handleDelete(id: string) {
    // Optimistic: close confirm immediately, fire in background.
    setDeletingId(null);
    fetch(`/api/budget/${id}`, { method: "DELETE" }).then(res => {
      if (res.ok) onBudgetChange?.();
    });
  }

  function handleToggleRollover(item: BudgetItem) {
    fetch(`/api/categories/${item.categoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rolloverEnabled: !item.rolloverEnabled }),
    }).then(res => {
      if (res.ok) onBudgetChange?.();
    });
  }

  const now = toZonedTime(new Date(), TIMEZONE);
  const todayStr = format(now, "yyyy-MM-dd");
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const dayOfMonth = getDate(now);
  const totalDays = getDaysInMonth(now);
  const prorationPct = Math.round((dayOfMonth / totalDays) * 100);

  const filteredTransactions = useMemo(() => {
    if (period === "custom") return customTransactions ?? [];
    return transactions.filter((t) => {
      if (period === "today") return t.date === todayStr;
      if (period === "week") return t.date >= weekStart && t.date <= weekEnd;
      return true;
    });
  }, [period, transactions, customTransactions, todayStr, weekStart, weekEnd]);

  const incomeTxs = useMemo(
    () => filteredTransactions.filter((t) => t.type === "income"),
    [filteredTransactions]
  );
  const expenseTxs = useMemo(
    () => filteredTransactions.filter(isExpenseTransaction),
    [filteredTransactions]
  );

  const savingsTxs = useMemo(
    () => expenseTxs.filter((t) => isSavingsTransaction(t.category, savingsCategoryNames)),
    [expenseTxs, savingsCategoryNames]
  );
  const nonSavingsExpenseTxs = useMemo(
    () => expenseTxs.filter((t) => !isSavingsTransaction(t.category, savingsCategoryNames)),
    [expenseTxs, savingsCategoryNames]
  );

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of incomeTxs) map[t.category] = (map[t.category] ?? 0) + t.amount;
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [incomeTxs]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of nonSavingsExpenseTxs) map[t.category] = (map[t.category] ?? 0) + t.amount;
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [nonSavingsExpenseTxs]);

  const savingsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of savingsTxs) map[t.category] = (map[t.category] ?? 0) + t.amount;
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [savingsTxs]);

  const totalIncome = useMemo(() => incomeTxs.reduce((s, t) => s + t.amount, 0), [incomeTxs]);
  const totalExpense = useMemo(() => nonSavingsExpenseTxs.reduce((s, t) => s + t.amount, 0), [nonSavingsExpenseTxs]);
  const totalSavings = useMemo(() => savingsTxs.reduce((s, t) => s + t.amount, 0), [savingsTxs]);
  const sisa = totalIncome - totalExpense - totalSavings;
  const cashflowSectionCount = [
    incomeByCategory.length > 0,
    expenseByCategory.length > 0,
    savingsByCategory.length > 0,
  ].filter(Boolean).length;

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    setExpanded(new Set());
  }

  function handleCustomSubmit() {
    if (!customFrom || !customTo) return;
    onFetchPeriod?.(customFrom, customTo);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 animate-pulse rounded-[24px] bg-muted" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-[24px] bg-muted" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-[28px] bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[18px] border border-border/70 bg-background/80 p-3 md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1 sm:flex sm:flex-wrap">
          {(["cashflow", "budget"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                activeTab === tab
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              )}
            >
              {tab === "cashflow" ? "Arus Kas" : "Vs Budget"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {(["today", "week", "month", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                period === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/70 text-muted-foreground hover:bg-background hover:text-foreground"
              )}
            >
              {p === "custom" && <Calendar className="size-3" />}
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {period === "custom" && (
        <div className="grid gap-2 rounded-[18px] border border-border/70 bg-background/80 p-3 sm:flex sm:flex-wrap sm:items-center">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 sm:w-auto"
          />
          <span className="hidden text-sm text-muted-foreground sm:inline">s/d</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 sm:w-auto"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customFrom || !customTo}
            className={cn(
              "h-10 rounded-lg px-4 text-sm font-medium transition-colors",
              customFrom && customTo
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground"
            )}
          >
            Tampilkan
          </button>
        </div>
      )}

      {activeTab === "cashflow" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={<TrendingUp className="size-4 text-emerald-500" />}
              label="Pemasukan"
              value={fmtEffect("income", totalIncome)}
              valueClass={totalIncome >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}
            />
            <MetricCard
              icon={<TrendingDown className="size-4 text-destructive" />}
              label="Pengeluaran"
              value={fmtEffect("expense", totalExpense)}
              valueClass="text-destructive"
            />
            <MetricCard
              icon={<PiggyBank className="size-4 text-blue-500" />}
              label="Tabungan"
              value={fmtEffect("expense", totalSavings)}
              valueClass="text-blue-600 dark:text-blue-400"
            />
            <MetricCard
              icon={<Minus className="size-4 text-muted-foreground" />}
              label="Sisa"
              value={fmtSigned(sisa)}
              valueClass={sisa >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}
            />
          </div>

          {transactions.length === 0 ? (
            <EmptyState text="Belum ada transaksi bulan ini." />
          ) : (
            <div className="pb-2">
              <div
                className={cn(
                  "grid gap-4",
                  "xl:w-full xl:grid-flow-row xl:auto-cols-fr",
                  cashflowSectionCount >= 3
                    ? "xl:grid-cols-3"
                    : cashflowSectionCount === 2
                    ? "xl:grid-cols-2"
                    : "xl:grid-cols-1"
                )}
              >
                {incomeByCategory.length > 0 && (
                  <CategorySection
                    title="Pemasukan"
                    type="income"
                    categories={incomeByCategory}
                    total={totalIncome}
                    transactions={incomeTxs}
                    expanded={expanded}
                    onToggle={toggle}
                  />
                )}
                {expenseByCategory.length > 0 && (
                  <CategorySection
                    title="Pengeluaran"
                    type="expense"
                    categories={expenseByCategory}
                    total={totalExpense}
                    transactions={nonSavingsExpenseTxs}
                    expanded={expanded}
                    onToggle={toggle}
                  />
                )}
                {savingsByCategory.length > 0 && (
                  <CategorySection
                    title="Tabungan"
                    type="expense"
                    categories={savingsByCategory}
                    total={totalSavings}
                    transactions={savingsTxs}
                    expanded={expanded}
                    onToggle={toggle}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "budget" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-[24px] border border-border/70 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Hari ini <span className="font-semibold text-foreground">{dayOfMonth}/{totalDays}</span>, setara{" "}
                <span className="font-semibold text-foreground">{prorationPct}% bulan berjalan</span>.
                Budget variable diproporsikan, budget fixed tetap penuh.
              </span>
            </div>
            <Link href="/dashboard/budget" className="shrink-0 text-sm font-medium text-primary hover:underline">
              Kelola Budget
            </Link>
          </div>

          {totalIncome > 0 && (
            <div className="rounded-[24px] border border-border/70 bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" />
                  <span className="text-sm font-medium text-foreground">Total pemasukan bulan ini</span>
                </div>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {fmtEffect("income", totalIncome)}
                </span>
              </div>
            </div>
          )}

          {!budgetData || budgetData.budgets.length === 0 ? (
            <EmptyState text='Belum ada budget. Ketik "Budget makan 500rb" untuk mulai.' />
          ) : (
            <>
              <div className="space-y-3 sm:hidden">
                {budgetData.budgets.map((item) => {
                  const fixed = isFixed(item);
                  const effectiveBudget = item.budget + (item.rollover ?? 0);
                  const prorated = fixed
                    ? effectiveBudget
                    : Math.round((effectiveBudget * dayOfMonth) / totalDays);
                  const remaining = prorated - item.spent;
                  const progress = getBudgetProgress(item.spent, effectiveBudget, prorated);
                  const isNear = progress.allowancePct >= 80 && progress.allowancePct < 100;
                  const isOver = progress.allowancePct >= 100;
                  const isEditing = editingId === item.id;
                  const isConfirmDelete = deletingId === item.id;
                  const hasRollover = (item.rollover ?? 0) > 0;

                  return (
                    <div key={item.id} className="rounded-[22px] border border-border/70 bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="break-words text-sm font-semibold text-foreground">{item.category}</p>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                fixed ? "bg-muted text-muted-foreground" : "bg-primary/12 text-primary"
                              )}
                            >
                              {fixed ? "Fixed" : "Variable"}
                            </span>
                            {item.rolloverEnabled && (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                Rollover
                              </span>
                            )}
                          </div>
                          {hasRollover && (
                            <p className="mt-1 text-[11px] text-violet-600 dark:text-violet-400">
                              +{fmtCompact(item.rollover)} sisa dari bulan lalu
                            </p>
                          )}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            remaining < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                          )}
                        >
                          {remaining >= 0 ? "+" : "-"}{fmtCompact(Math.abs(remaining))}
                        </span>
                      </div>
                      <BudgetProgressBar
                        fillPct={progress.totalPct}
                        markerPct={fixed ? undefined : progress.prorataPctOfTotal}
                        isOver={isOver}
                        isNear={isNear}
                        className="mt-3"
                      />
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-muted-foreground">Budget</p>
                          {isEditing ? (
                            <input
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleEditSave(item);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="mt-1 w-full rounded-xl border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          ) : (
                            <p className="font-medium text-foreground">{fmt(item.budget)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-muted-foreground">Realisasi</p>
                          <p className={cn("font-medium", isOver ? "text-destructive" : isNear ? "text-yellow-600 dark:text-yellow-400" : "text-foreground")}>
                            {fmt(item.spent)}
                            <span className="block text-[10px] text-muted-foreground">{progress.totalDisplayPct}% total</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Prorata</p>
                          <p className="font-medium text-foreground">
                            {fmtCompact(prorated)}
                            {!fixed && <span className="block text-[10px] text-muted-foreground">{progress.prorataDisplayPct}% total</span>}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleEditSave(item)}
                              className="flex size-8 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:hover:bg-emerald-900/30"
                              title="Simpan"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                              title="Batal"
                            >
                              <X className="size-3.5" />
                            </button>
                          </>
                        ) : isConfirmDelete ? (
                          <>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                            >
                              Hapus
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleRollover(item)}
                              className={cn(
                                "flex size-8 items-center justify-center rounded-lg transition-colors",
                                item.rolloverEnabled
                                  ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                                  : "text-muted-foreground hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-900/30"
                              )}
                              title={item.rolloverEnabled ? "Nonaktifkan rollover" : "Aktifkan rollover"}
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setEditAmount(item.budget.toString());
                                setDeletingId(null);
                              }}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              title="Edit budget"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingId(item.id);
                                setEditingId(null);
                              }}
                              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              title="Hapus budget"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden overflow-hidden rounded-[28px] border border-border/70 bg-background sm:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/35">
                        <th className="label-mono px-4 py-3 text-left text-muted-foreground">Kategori</th>
                        <th className="label-mono py-3 pr-3 text-right text-muted-foreground">Budget</th>
                        <th className="label-mono py-3 pr-3 text-right text-muted-foreground">Prorata</th>
                        <th className="label-mono py-3 pr-3 text-right text-muted-foreground">Realisasi</th>
                        <th className="label-mono py-3 pr-3 text-right text-muted-foreground">Sisa</th>
                        <th className="py-3 pr-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {budgetData.budgets.map((item) => {
                        const fixed = isFixed(item);
                        const effectiveBudget = item.budget + (item.rollover ?? 0);
                        const prorated = fixed
                          ? effectiveBudget
                          : Math.round((effectiveBudget * dayOfMonth) / totalDays);
                        const remaining = prorated - item.spent;
                        const progress = getBudgetProgress(item.spent, effectiveBudget, prorated);
                        const isNear = progress.allowancePct >= 80 && progress.allowancePct < 100;
                        const isOver = progress.allowancePct >= 100;
                        const isEditing = editingId === item.id;
                        const isConfirmDelete = deletingId === item.id;
                        const hasRollover = (item.rollover ?? 0) > 0;

                        return (
                          <tr key={item.id} className="group border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="p-4">
                              <div className="max-w-[280px]">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground">{item.category}</p>
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                      fixed
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-primary/12 text-primary"
                                    )}
                                  >
                                    {fixed ? "Fixed" : "Variable"}
                                  </span>
                                  {item.rolloverEnabled && (
                                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                      Rollover
                                    </span>
                                  )}
                                </div>
                                {hasRollover && (
                                  <p className="mt-1 text-[11px] text-violet-600 dark:text-violet-400">
                                    +{fmtCompact(item.rollover)} sisa dari bulan lalu
                                  </p>
                                )}
                                <BudgetProgressBar
                                  fillPct={progress.totalPct}
                                  markerPct={fixed ? undefined : progress.prorataPctOfTotal}
                                  isOver={isOver}
                                  isNear={isNear}
                                  className="mt-2 max-w-[140px]"
                                />
                              </div>
                            </td>

                            <td className="py-4 pr-3 text-right tabular-nums">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editAmount}
                                  onChange={(e) => setEditAmount(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleEditSave(item);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  className="w-28 rounded-xl border border-border bg-card px-2 py-1 text-right text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                              ) : (
                                <div>
                                  <span className="text-sm text-foreground">{fmt(item.budget)}</span>
                                  {hasRollover && (
                                    <span className="block text-[11px] text-violet-500">+{fmtCompact(item.rollover)}</span>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-4 pr-3 text-right tabular-nums">
                              <span className={cn("text-sm", fixed ? "text-muted-foreground" : "font-medium text-foreground")}>
                                {fmtCompact(prorated)}
                              </span>
                              {!fixed && (
                                <span className="block text-[11px] text-muted-foreground">{progress.prorataDisplayPct}% total</span>
                              )}
                            </td>

                            <td
                              className={cn(
                                "py-4 pr-3 text-right text-sm font-medium tabular-nums",
                                isOver
                                  ? "text-destructive"
                                  : isNear
                                  ? "text-yellow-600 dark:text-yellow-400"
                                  : "text-foreground"
                              )}
                            >
                              {fmt(item.spent)}
                              <span className="block text-[11px] font-medium text-muted-foreground">{progress.totalDisplayPct}% total</span>
                            </td>

                            <td
                              className={cn(
                                "py-4 pr-3 text-right text-sm font-semibold tabular-nums",
                                remaining < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {remaining >= 0 ? "+" : "-"}{fmtCompact(Math.abs(remaining))}
                            </td>

                            <td className="py-4 pr-3">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleEditSave(item)}
                                          className="flex size-7 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-100 disabled:opacity-50 dark:hover:bg-emerald-900/30"
                                    title="Simpan"
                                  >
                                    <Check className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
                                    title="Batal"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>
                              ) : isConfirmDelete ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleDelete(item.id)}
                                          className="rounded-lg bg-destructive px-2 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                                  >
                                    Hapus
                                  </button>
                                  <button
                                    onClick={() => setDeletingId(null)}
                                    className="rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    onClick={() => handleToggleRollover(item)}
                                    className={cn(
                                      "flex size-7 items-center justify-center rounded-lg transition-colors",
                                      item.rolloverEnabled
                                        ? "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                                        : "text-muted-foreground hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-900/30"
                                    )}
                                    title={item.rolloverEnabled ? "Nonaktifkan rollover" : "Aktifkan rollover"}
                                  >
                                    <RotateCcw className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingId(item.id);
                                      setEditAmount(item.budget.toString());
                                      setDeletingId(null);
                                    }}
                                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    title="Edit budget"
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeletingId(item.id);
                                      setEditingId(null);
                                    }}
                                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                    title="Hapus budget"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const totalBudget = budgetData.budgets.reduce((s, b) => s + b.budget + (b.rollover ?? 0), 0);
                        const totalProrated = budgetData.budgets.reduce((s, b) => {
                          const fixed = isFixed(b);
                          const eff = b.budget + (b.rollover ?? 0);
                          return s + (fixed ? eff : Math.round((eff * dayOfMonth) / totalDays));
                        }, 0);
                        const totalSpentBudgeted = budgetData.budgets.reduce((s, b) => s + b.spent, 0);
                        const totalRemaining = totalProrated - totalSpentBudgeted;
                        const totalProgress = getBudgetProgress(totalSpentBudgeted, totalBudget, totalProrated);
                        return (
                          <tr className="bg-muted/30">
                            <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">Total</td>
                            <td className="py-3 pr-3 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                              {fmt(totalBudget)}
                            </td>
                            <td className="py-3 pr-3 text-right text-xs font-semibold text-muted-foreground tabular-nums">
                              {fmtCompact(totalProrated)}
                              <span className="block text-[11px]">{totalProgress.prorataDisplayPct}% total</span>
                            </td>
                            <td className="py-3 pr-3 text-right text-sm font-bold tabular-nums text-destructive">
                              {fmt(totalSpentBudgeted)}
                              <span className="block text-[11px] font-semibold text-muted-foreground">{totalProgress.totalDisplayPct}% total</span>
                            </td>
                            <td className="py-3 pr-3 text-right text-sm font-bold tabular-nums">
                              <span className={totalRemaining >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                                {totalRemaining >= 0 ? "+" : "-"}{fmtCompact(Math.abs(totalRemaining))}
                              </span>
                            </td>
                            <td />
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              </div>

              {budgetData.unbudgeted && budgetData.unbudgeted.length > 0 && (
                <div className="rounded-[28px] border border-border/70 bg-background overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-border bg-muted/35 px-4 py-3">
                    <AlertCircle className="size-4 text-muted-foreground" />
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Pengeluaran tanpa budget
                    </span>
                  </div>
                  <table className="w-full">
                    <tbody>
                      {budgetData.unbudgeted.map((item) => (
                        <tr key={item.category} className="border-b border-border last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <span className="text-sm font-medium text-foreground">{item.category}</span>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-muted-foreground">
                            {fmt(item.spent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      {(() => {
                        const totalSpentBudgeted = budgetData.budgets.reduce((s, b) => s + b.spent, 0);
                        const totalUnbudgeted = budgetData.unbudgeted!.reduce((s, u) => s + u.spent, 0);
                        const totalAll = totalSpentBudgeted + totalUnbudgeted;
                        return (
                          <tr className="bg-muted/30">
                            <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                              Total Realisasi
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-destructive">
                              {fmt(totalAll)}
                            </td>
                          </tr>
                        );
                      })()}
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-[18px] border border-border/70 bg-background p-4 shadow-[var(--shadow-offset-x)_var(--shadow-offset-y)_var(--shadow-blur)_var(--shadow-spread)_color-mix(in_srgb,var(--shadow-color)_42%,transparent)]">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-xl font-semibold tracking-tight tabular-nums", valueClass)}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-border/70 bg-background/80 px-4 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

interface CategorySectionProps {
  title: string;
  type: "income" | "expense";
  categories: [string, number][];
  total: number;
  transactions: Transaction[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}

function CategorySection({
  title,
  type,
  categories,
  total,
  transactions,
  expanded,
  onToggle,
}: CategorySectionProps) {
  const barClass = type === "income" ? "bg-emerald-500" : "bg-destructive";
  const sectionEffect = type === "income" ? total : -total;
  const valueClass = sectionEffect >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";

  return (
    <div className="overflow-hidden rounded-[20px] border border-border/70 bg-background">
      <div className="flex items-center justify-between border-b border-border bg-muted/35 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </span>
        <span className={cn("text-sm font-bold tabular-nums", valueClass)}>
          {fmtEffect(type, total)}
        </span>
      </div>

      {categories.map(([cat, amount]) => {
        const key = `${type}-${cat}`;
        const pct = Math.abs(total) > 0 ? (Math.abs(amount) / Math.abs(total)) * 100 : 0;
        const isOpen = expanded.has(key);
        const catTxs = transactions.filter((t) => t.category === cat);
        const amountEffect = type === "income" ? amount : -amount;
        const amountClass = amountEffect >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";

        return (
          <div key={cat} className="border-b border-border/70 last:border-0">
            <button
              onClick={() => onToggle(key)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                {isOpen ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-foreground">{cat}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                      <span className={cn("text-sm font-semibold tabular-nums", amountClass)}>
                        {fmtEffect(type, amount)}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", barClass)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border/70 bg-muted/15">
                {catTxs.length === 0 ? (
                  <p className="px-12 py-3 text-xs text-muted-foreground">Tidak ada transaksi.</p>
                ) : (
                  <div className="w-full min-w-0">
                    {catTxs.map((t) => {
                      const txEffect = type === "income" ? t.amount : -t.amount;
                      return (
                        <div
                          key={t.id}
                          className="flex min-w-0 items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5 text-xs last:border-0 hover:bg-muted/25 sm:gap-3"
                        >
                          <span className="w-10 shrink-0 text-muted-foreground sm:w-12">{formatDate(t.date)}</span>
                          <span className="min-w-0 flex-1 break-words">{t.note || "-"}</span>
                          <span
                            className={cn(
                              "ml-auto shrink-0 text-right font-semibold tabular-nums",
                              txEffect >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                            )}
                          >
                            {fmtEffect(type, t.amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
