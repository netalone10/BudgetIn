"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface BudgetItem {
  id: string;
  categoryId: string;
  category: string;
  budget: number;
  spent: number;
  rollover: number;
  rolloverEnabled: boolean;
}

interface BudgetData {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  budgets: BudgetItem[];
  unbudgeted: { category: string; spent: number }[];
}

interface BudgetCategoryOption {
  id: string;
  name: string;
  type: string;
  isSavings: boolean;
}

interface Props {
  initialData: BudgetData;
  categories: BudgetCategoryOption[];
}

const FIXED_KEYWORDS = [
  "kos", "sewa", "arisan", "cicilan", "kredit", "kontrak",
  "asuransi", "bpjs", "langganan", "mortgage", "rent",
];
const MONTH_RE = /^\d{4}-\d{2}$/;

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

function parseAmount(value: string) {
  return parseFloat(value.replace(/\./g, "").replace(",", "."));
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNum] = month.split("-").map(Number);
  const date = new Date(year, monthNum - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDaysInSelectedMonth(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return new Date(year, monthNum, 0).getDate();
}

function getBudgetDay(month: string) {
  const totalDays = getDaysInSelectedMonth(month);
  if (month !== getCurrentMonth()) return totalDays;
  return Math.min(new Date().getDate(), totalDays);
}

function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(year, monthNum - 1, 1)
  );
}

export default function BudgetClient({ initialData, categories }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [month, setMonth] = useState(initialData.month);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [copyConfirm, setCopyConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDays = getDaysInSelectedMonth(month);
  const dayOfMonth = getBudgetDay(month);
  const prorationPct = Math.round((dayOfMonth / totalDays) * 100);
  const hasExistingBudget = data.budgets.length > 0;

  const availableCategories = useMemo(() => {
    const budgeted = new Set(data.budgets.map((item) => item.category));
    return categories.filter((category) => !budgeted.has(category.name));
  }, [categories, data.budgets]);

  const selectedNewCategory = newCategory || availableCategories[0]?.name || "";

  async function loadMonth(targetMonth: string) {
    if (!MONTH_RE.test(targetMonth)) return;

    setLoading(true);
    setError(null);
    setCopyConfirm(false);
    try {
      const res = await fetch(`/api/budget?month=${targetMonth}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat budget");
      const nextData = await res.json();
      setData(nextData);
      setMonth(targetMonth);
      setEditingId(null);
      setDeletingId(null);
      setNewCategory("");
      setNewAmount("");
      router.replace(`/dashboard/budget?month=${targetMonth}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat budget");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    await loadMonth(month);
  }

  async function handleSave(item: BudgetItem) {
    const amount = parseAmount(editAmount);
    if (!amount || amount <= 0) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: item.category, amount, month }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan budget");
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan budget");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const amount = parseAmount(newAmount);
    if (!selectedNewCategory || !amount || amount <= 0) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: selectedNewCategory, amount, month }),
      });
      if (!res.ok) throw new Error("Gagal menambah budget");
      setNewCategory("");
      setNewAmount("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambah budget");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/budget/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal hapus budget");
      setDeletingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal hapus budget");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleRollover(item: BudgetItem) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/categories/${item.categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rolloverEnabled: !item.rolloverEnabled }),
      });
      if (!res.ok) throw new Error("Gagal mengubah rollover");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah rollover");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyPreviousMonth() {
    if (hasExistingBudget && !copyConfirm) {
      setCopyConfirm(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const sourceMonth = shiftMonth(month, -1);
      const res = await fetch("/api/budget/rollover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceMonth, targetMonth: month }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Gagal copy budget");
      setCopyConfirm(false);
      await refresh();
      if (payload.copied === 0) setError("Tidak ada budget di bulan sebelumnya untuk dicopy.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal copy budget");
    } finally {
      setSaving(false);
    }
  }

  const totals = useMemo(() => {
    return data.budgets.reduce(
      (acc, item) => {
        const fixed = isFixed(item.category);
        const effectiveBudget = item.budget + (item.rollover ?? 0);
        const prorated = fixed ? effectiveBudget : Math.round((effectiveBudget * dayOfMonth) / totalDays);
        acc.budget += effectiveBudget;
        acc.prorated += prorated;
        acc.spent += item.spent;
        return acc;
      },
      { budget: 0, prorated: 0, spent: 0 }
    );
  }, [data.budgets, dayOfMonth, totalDays]);

  const totalRemaining = totals.prorated - totals.spent;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" onClick={() => loadMonth(shiftMonth(month, -1))} disabled={loading || saving}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) loadMonth(e.target.value);
              }}
              disabled={loading || saving}
              className="w-40 text-sm font-medium"
            />
            <Button variant="outline" size="icon-sm" onClick={() => loadMonth(shiftMonth(month, 1))} disabled={loading || saving}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" size="sm" onClick={() => loadMonth(getCurrentMonth())} disabled={loading || saving || month === getCurrentMonth()}>
              Bulan Ini
            </Button>
            <Button size="sm" onClick={handleCopyPreviousMonth} disabled={loading || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {copyConfirm ? "Klik Lagi untuk Overwrite" : hasExistingBudget ? "Overwrite dari Bulan Lalu" : "Copy dari Bulan Lalu"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Bulan" value={formatMonthLabel(month)} />
          <Metric label="Budget" value={`Rp ${fmt(totals.budget)}`} />
          <Metric label="Realisasi" value={`Rp ${fmt(totals.spent)}`} valueClass="text-destructive" />
          <Metric
            label="Sisa Prorated"
            value={`${totalRemaining >= 0 ? "+" : "-"}Rp ${fmt(totalRemaining)}`}
            valueClass={totalRemaining >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}
          />
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Prorated memakai {dayOfMonth}/{totalDays} hari ({prorationPct}%). Kategori Fixed dihitung 100%, Variable diproporsikan.
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleAdd} className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Tambah Budget</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-center">
          <select
            value={selectedNewCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            disabled={availableCategories.length === 0 || saving || loading}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {availableCategories.length === 0 ? (
              <option value="">Semua kategori sudah punya budget</option>
            ) : (
              availableCategories.map((category) => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))
            )}
          </select>
          <Input
            type="number"
            min={1}
            placeholder="Amount"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            disabled={availableCategories.length === 0 || saving || loading}
          />
          <Button type="submit" size="sm" disabled={!selectedNewCategory || !newAmount || saving || loading}>
            Tambah
          </Button>
        </div>
      </form>

      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-14 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : data.budgets.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Belum ada budget untuk {formatMonthLabel(month)}. Tambahkan budget atau copy dari bulan sebelumnya.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="py-2.5 pl-4 pr-2 text-left text-[11px] font-medium text-muted-foreground">Kategori</th>
                  <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">Amount</th>
                  <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">Prorated</th>
                  <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">Spent</th>
                  <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground">Sisa</th>
                  <th className="py-2.5 pr-4 text-right text-[11px] font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.budgets.map((item) => {
                  const fixed = isFixed(item.category);
                  const effectiveBudget = item.budget + (item.rollover ?? 0);
                  const prorated = fixed ? effectiveBudget : Math.round((effectiveBudget * dayOfMonth) / totalDays);
                  const remaining = prorated - item.spent;
                  const pct = prorated > 0 ? (item.spent / prorated) * 100 : 0;
                  const isOver = pct >= 100;
                  const isNear = pct >= 80 && !isOver;
                  const isEditing = editingId === item.id;
                  const isConfirmDelete = deletingId === item.id;
                  const hasRollover = (item.rollover ?? 0) > 0;

                  return (
                    <tr key={item.id} className="group border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 pl-4 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium">{item.category}</span>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none",
                            fixed ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-muted text-muted-foreground"
                          )}>
                            {fixed ? "Fixed" : "Variable"}
                          </span>
                          {item.rolloverEnabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                              Rollover
                            </span>
                          )}
                        </div>
                        {hasRollover && (
                          <span className="block text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">
                            +{fmtCompact(item.rollover)} sisa bulan lalu
                          </span>
                        )}
                        <div className="mt-1.5 h-1 w-full max-w-[160px] rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", isOver ? "bg-destructive" : isNear ? "bg-yellow-500" : "bg-primary")}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSave(item);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="ml-auto w-28 text-right text-xs"
                            autoFocus
                          />
                        ) : (
                          <div>
                            <span className="text-xs text-muted-foreground">{fmt(item.budget)}</span>
                            {hasRollover && <span className="block text-[10px] text-violet-500">+{fmtCompact(item.rollover)}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        <span className={cn("text-xs", fixed ? "text-muted-foreground" : "font-medium text-foreground")}>{fmtCompact(prorated)}</span>
                        {!fixed && <span className="block text-[10px] text-muted-foreground">{prorationPct}%</span>}
                      </td>
                      <td className={cn("py-3 pr-3 text-right text-sm font-medium tabular-nums", isOver ? "text-destructive" : isNear ? "text-yellow-600 dark:text-yellow-400" : "")}>
                        {fmt(item.spent)}
                      </td>
                      <td className={cn("py-3 pr-3 text-right text-sm font-semibold tabular-nums", remaining < 0 ? "text-destructive" : "text-green-600 dark:text-green-400")}>
                        {remaining >= 0 ? "+" : "-"}{fmtCompact(Math.abs(remaining))}
                      </td>
                      <td className="py-3 pr-4">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-xs" onClick={() => handleSave(item)} disabled={saving}>
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon-xs" onClick={() => setEditingId(null)} disabled={saving}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : isConfirmDelete ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="destructive" size="xs" onClick={() => handleDelete(item.id)} disabled={saving}>Hapus</Button>
                            <Button variant="ghost" size="xs" onClick={() => setDeletingId(null)} disabled={saving}>Batal</Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => handleToggleRollover(item)}
                              disabled={saving}
                              className={item.rolloverEnabled ? "text-violet-600 bg-violet-100 dark:bg-violet-900/30" : "text-muted-foreground"}
                              title={item.rolloverEnabled ? "Nonaktifkan rollover" : "Aktifkan rollover"}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                setEditingId(item.id);
                                setEditAmount(item.budget.toString());
                                setDeletingId(null);
                              }}
                              disabled={saving}
                              title="Edit budget"
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                setDeletingId(item.id);
                                setEditingId(null);
                              }}
                              disabled={saving}
                              className="text-muted-foreground hover:text-destructive"
                              title="Hapus budget"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20">
                  <td className="py-2.5 pl-4 text-xs font-semibold text-muted-foreground">Total</td>
                  <td className="py-2.5 pr-3 text-right text-xs font-semibold text-muted-foreground tabular-nums">{fmt(totals.budget)}</td>
                  <td className="py-2.5 pr-3 text-right text-xs font-semibold text-muted-foreground tabular-nums">{fmtCompact(totals.prorated)}</td>
                  <td className="py-2.5 pr-3 text-right text-sm font-bold tabular-nums text-destructive">{fmt(totals.spent)}</td>
                  <td className="py-2.5 pr-3 text-right text-sm font-bold tabular-nums">
                    <span className={totalRemaining >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}>
                      {totalRemaining >= 0 ? "+" : "-"}{fmtCompact(Math.abs(totalRemaining))}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {data.unbudgeted.length > 0 && (
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Pengeluaran tanpa budget</span>
          </div>
          <table className="w-full">
            <tbody>
              {data.unbudgeted.map((item) => (
                <tr key={item.category} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-3 pl-4 pr-2 text-sm font-medium">{item.category}</td>
                  <td className="py-3 pr-4 text-right text-sm font-medium tabular-nums text-muted-foreground">{fmt(item.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}
