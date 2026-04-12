"use client";

import { useState, useMemo } from "react";
import { Transaction } from "@/components/TransactionCard";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDaysInMonth, getDate } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "Asia/Jakarta";

// Keyword fixed expense — tidak diprorate
const FIXED_KEYWORDS = [
  "kos", "sewa", "arisan", "cicilan", "kredit", "kontrak",
  "asuransi", "bpjs", "langganan", "mortgage", "rent",
];

function isFixed(category: string): boolean {
  const lower = category.toLowerCase();
  return FIXED_KEYWORDS.some((kw) => lower.includes(kw));
}

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(Math.abs(n));
}

function fmtCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace(".0", "")}jt`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(0)}rb`;
  return abs.toString();
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface BudgetItem {
  id: string;
  category: string;
  budget: number;
  spent: number;
}

export interface BudgetData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  budgets: BudgetItem[];
}

interface Props {
  transactions: Transaction[];
  budgetData: BudgetData | null;
  loading: boolean;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardTabs({ transactions, budgetData, loading }: Props) {
  const [activeTab, setActiveTab] = useState<"cashflow" | "budget">("cashflow");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Prorated date info
  const now = toZonedTime(new Date(), TIMEZONE);
  const dayOfMonth = getDate(now);
  const totalDays = getDaysInMonth(now);
  const prorationPct = Math.round((dayOfMonth / totalDays) * 100);

  // Split transactions
  const incomeTxs = useMemo(() => transactions.filter((t) => t.type === "income"), [transactions]);
  const expenseTxs = useMemo(() => transactions.filter((t) => t.type !== "income"), [transactions]);

  // Aggregate by category
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of incomeTxs) map[t.category] = (map[t.category] ?? 0) + t.amount;
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [incomeTxs]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of expenseTxs) map[t.category] = (map[t.category] ?? 0) + t.amount;
    return Object.entries(map).sort(([, a], [, b]) => b - a);
  }, [expenseTxs]);

  const totalIncome = useMemo(() => incomeTxs.reduce((s, t) => s + t.amount, 0), [incomeTxs]);
  const totalExpense = useMemo(() => expenseTxs.reduce((s, t) => s + t.amount, 0), [expenseTxs]);
  const net = totalIncome - totalExpense;

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-1 border-b">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-t bg-muted" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Tab Headers ─────────────────────────────────────────────────────── */}
      <div className="flex border-b mb-4">
        {(["cashflow", "budget"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "cashflow" ? "Arus Kas" : "vs Budget"}
          </button>
        ))}
      </div>

      {/* ── TAB 1: ARUS KAS ─────────────────────────────────────────────────── */}
      {activeTab === "cashflow" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              icon={<TrendingUp className="h-3.5 w-3.5 text-green-500" />}
              label="Pemasukan"
              value={`+${fmt(totalIncome)}`}
              valueClass="text-green-600 dark:text-green-400"
            />
            <MetricCard
              icon={<TrendingDown className="h-3.5 w-3.5 text-destructive" />}
              label="Pengeluaran"
              value={`-${fmt(totalExpense)}`}
              valueClass="text-destructive"
            />
            <MetricCard
              icon={<Minus className="h-3.5 w-3.5 text-muted-foreground" />}
              label="Net"
              value={`${net >= 0 ? "+" : "-"}${fmt(net)}`}
              valueClass={net >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}
            />
          </div>

          {transactions.length === 0 ? (
            <EmptyState text="Belum ada transaksi bulan ini." />
          ) : (
            <>
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
                  transactions={expenseTxs}
                  expanded={expanded}
                  onToggle={toggle}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: VS BUDGET ────────────────────────────────────────────────── */}
      {activeTab === "budget" && (
        <div className="space-y-4">
          {/* Prorated info pill */}
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              Hari ini{" "}
              <span className="font-semibold text-foreground">{dayOfMonth}/{totalDays} hari</span>
              {" "}= <span className="font-semibold text-foreground">{prorationPct}% bulan berjalan</span>.{" "}
              Budget <span className="font-medium text-foreground">variable</span> diproporsikan.{" "}
              <span className="font-medium text-foreground">Fixed</span> (kos, arisan, cicilan, dll) tetap 100%.
            </span>
          </div>

          {/* Income summary (jika ada) */}
          {totalIncome > 0 && (
            <div className="rounded-xl border bg-card px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Total Pemasukan Bulan Ini</span>
              </div>
              <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
                +{fmt(totalIncome)}
              </span>
            </div>
          )}

          {/* Budget table */}
          {!budgetData || budgetData.budgets.length === 0 ? (
            <EmptyState text='Belum ada budget. Ketik "Budget makan 500rb" untuk mulai.' />
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-2.5 pl-4 pr-2 text-left text-[11px] font-medium text-muted-foreground">
                      Kategori
                    </th>
                    <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">
                      Budget
                    </th>
                    <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">
                      Prorated
                    </th>
                    <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">
                      Realisasi
                    </th>
                    <th className="py-2.5 pr-4 text-right text-[11px] font-medium text-muted-foreground">
                      Sisa
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {budgetData.budgets.map((item) => {
                    const fixed = isFixed(item.category);
                    const prorated = fixed
                      ? item.budget
                      : Math.round((item.budget * dayOfMonth) / totalDays);
                    const remaining = prorated - item.spent;
                    const pct = prorated > 0 ? (item.spent / prorated) * 100 : 0;
                    const isOver = pct >= 100;
                    const isNear = pct >= 80 && !isOver;

                    return (
                      <tr
                        key={item.id}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        {/* Kategori + badge + bar */}
                        <td className="py-3 pl-4 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium">{item.category}</span>
                            <span
                              className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none",
                                fixed
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              {fixed ? "Fixed" : "Variable"}
                            </span>
                          </div>
                          {/* Mini progress */}
                          <div className="mt-1.5 h-1 w-full max-w-[120px] rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isOver
                                  ? "bg-destructive"
                                  : isNear
                                  ? "bg-yellow-500"
                                  : "bg-primary"
                              )}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </td>

                        {/* Budget */}
                        <td className="py-3 pr-3 text-right text-xs text-muted-foreground tabular-nums">
                          {fmtCompact(item.budget)}
                        </td>

                        {/* Prorated */}
                        <td className="py-3 pr-3 text-right tabular-nums">
                          <span className={cn("text-xs", fixed ? "text-muted-foreground" : "font-medium text-foreground")}>
                            {fmtCompact(prorated)}
                          </span>
                          {!fixed && (
                            <span className="block text-[10px] text-muted-foreground">
                              {prorationPct}%
                            </span>
                          )}
                        </td>

                        {/* Realisasi */}
                        <td
                          className={cn(
                            "py-3 pr-3 text-right text-sm font-medium tabular-nums",
                            isOver
                              ? "text-destructive"
                              : isNear
                              ? "text-yellow-600 dark:text-yellow-400"
                              : ""
                          )}
                        >
                          {fmt(item.spent)}
                        </td>

                        {/* Sisa */}
                        <td
                          className={cn(
                            "py-3 pr-4 text-right text-sm font-semibold tabular-nums",
                            remaining < 0
                              ? "text-destructive"
                              : "text-green-600 dark:text-green-400"
                          )}
                        >
                          {remaining >= 0 ? "+" : "-"}{fmtCompact(Math.abs(remaining))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Footer: total expense */}
                <tfoot>
                  <tr className="border-t bg-muted/20">
                    <td className="py-2.5 pl-4 text-xs font-semibold text-muted-foreground" colSpan={3}>
                      Total Pengeluaran
                    </td>
                    <td className="py-2.5 pr-3 text-right text-sm font-bold tabular-nums text-destructive">
                      {fmt(budgetData.totalExpense)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-sm font-bold tabular-nums">
                      {(() => {
                        const totalProrated = budgetData.budgets.reduce((s, b) => {
                          const fixed = isFixed(b.category);
                          return s + (fixed ? b.budget : Math.round((b.budget * dayOfMonth) / totalDays));
                        }, 0);
                        const totalRemaining = totalProrated - budgetData.totalExpense;
                        return (
                          <span className={totalRemaining >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                            {totalRemaining >= 0 ? "+" : "-"}{fmtCompact(Math.abs(totalRemaining))}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function MetricCard({
  icon, label, value, valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-base font-bold tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
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
  title, type, categories, total, transactions, expanded, onToggle,
}: CategorySectionProps) {
  const signPrefix = type === "income" ? "+" : "-";
  const valueClass =
    type === "income" ? "text-green-600 dark:text-green-400" : "text-destructive";
  const barClass = type === "income" ? "bg-green-500" : "bg-primary";

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </span>
        <span className={cn("text-sm font-bold tabular-nums", valueClass)}>
          {signPrefix}{fmt(total)}
        </span>
      </div>

      {/* Rows */}
      {categories.map(([cat, amount]) => {
        const key = `${type}-${cat}`;
        const pct = total > 0 ? (amount / total) * 100 : 0;
        const isOpen = expanded.has(key);
        const catTxs = transactions.filter((t) => t.category === cat);

        return (
          <div key={cat} className="border-b last:border-0">
            <button
              onClick={() => onToggle(key)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
            >
              {isOpen
                ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{cat}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {pct.toFixed(0)}%
                    </span>
                    <span className={cn("text-sm font-semibold tabular-nums", valueClass)}>
                      {signPrefix}{fmt(amount)}
                    </span>
                  </div>
                </div>
                <div className="h-1 w-full rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", barClass)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </button>

            {/* Expanded transaction list */}
            {isOpen && (
              <div className="border-t bg-muted/20">
                {catTxs.length === 0 ? (
                  <p className="px-12 py-3 text-xs text-muted-foreground">
                    Tidak ada transaksi.
                  </p>
                ) : (
                  catTxs.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-12 py-2.5 border-b last:border-0 text-xs hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 text-muted-foreground w-12">
                          {formatDate(t.date)}
                        </span>
                        <span className="truncate">{t.note || "—"}</span>
                      </div>
                      <span className={cn("shrink-0 font-semibold tabular-nums ml-4", valueClass)}>
                        {signPrefix}{fmt(t.amount)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
