"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Repeat, BellRing } from "lucide-react";
import { useIsDemo } from "@/lib/hooks/use-is-demo";
import RecurringCard, { RecurringWithMeta, getRecurringStatus } from "@/components/RecurringCard";
import AddRecurringModal from "@/components/AddRecurringModal";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { RecurringType } from "@/utils/recurring-utils";

const CURRENT_MONTH_LABEL = format(new Date(), "MMMM yyyy", { locale: idLocale });

type StatusFilter = "all" | "due-today" | "overdue" | "due-soon" | "ran" | "upcoming";
type TypeFilter = "all" | RecurringType;

interface Summary {
  totalRecurring: number;
  paidAmount: number;
  pendingAmount: number;
  overdueCount: number;
  dueTodayCount: number;
}

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Semua" },
  { key: "overdue", label: "Terlambat" },
  { key: "due-today", label: "Hari Ini" },
  { key: "due-soon", label: "Segera" },
  { key: "ran", label: "Sudah Catat" },
  { key: "upcoming", label: "Mendatang" },
];

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Semua Tipe" },
  { key: "expense", label: "Pengeluaran" },
  { key: "income", label: "Pemasukan" },
  { key: "transfer", label: "Transfer" },
];

export default function RecurringClient() {
  const isDemo = useIsDemo();
  const [items, setItems] = useState<RecurringWithMeta[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<RecurringWithMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes] = await Promise.all([
        fetch("/api/recurring"),
        fetch(`/api/recurring/summary?period=${format(new Date(), "yyyy-MM")}`),
      ]);
      if (itemsRes.ok) {
        // /api/recurring mengembalikan { data, pagination }. Toleransi juga
        // bentuk array lama agar tidak crash ("items.filter is not a function").
        const json = await itemsRes.json();
        setItems(Array.isArray(json) ? json : (json?.data ?? []));
      }
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const handleRun = async (id: string) => {
    const res = await fetch(`/api/recurring/${id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (res.ok || res.status === 409) load();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Gagal mencatat.");
    }
  };

  const handleSkip = async (id: string) => {
    const res = await fetch(`/api/recurring/${id}/skip`, { method: "POST" });
    if (res.ok) load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus item berulang ini?")) return;
    const res = await fetch(`/api/recurring?id=${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const filtered = useMemo(() => items.filter((i) => {
    if (typeFilter !== "all" && i.type !== typeFilter) return false;
    if (statusFilter !== "all" && getRecurringStatus(i) !== statusFilter) return false;
    return true;
  }), [items, statusFilter, typeFilter]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Repeat className="size-6 text-primary" /> Berulang
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span suppressHydrationWarning>{CURRENT_MONTH_LABEL}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted" title="Refresh">
            <RefreshCw className="size-4" />
          </button>
          {!isDemo && (
            <button
              onClick={() => { setEditItem(null); setShowAdd(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Tambah
            </button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1 truncate">Total Item</p>
            <p className="text-xl font-bold text-foreground truncate">{summary.totalRecurring}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1 truncate">Sudah Tercatat</p>
            <p className="text-xl font-bold text-emerald-600 truncate">{(summary.paidAmount / 1000).toFixed(0)}k</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1 truncate">Belum Dicatat</p>
            <p className="text-xl font-bold text-foreground truncate">{(summary.pendingAmount / 1000).toFixed(0)}k</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 min-w-0">
            <p className="text-xs text-muted-foreground mb-1 truncate">Terlambat</p>
            <p className={`text-xl font-bold truncate ${summary.overdueCount > 0 ? "text-red-600" : "text-foreground"}`}>
              {summary.overdueCount}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-3">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_TABS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === f.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="size-5 animate-spin mr-2" />
          Memuat…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <BellRing className="size-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {statusFilter === "all" && typeFilter === "all"
              ? "Belum ada transaksi berulang. Klik \"Tambah\" untuk mulai."
              : "Tidak ada item dengan filter ini."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <RecurringCard
              key={item.id}
              item={item}
              onRun={() => handleRun(item.id)}
              onSkip={() => handleSkip(item.id)}
              onEdit={() => { setEditItem(item); setShowAdd(true); }}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddRecurringModal
          onClose={() => { setShowAdd(false); setEditItem(null); }}
          onSaved={load}
          editItem={editItem}
        />
      )}
    </div>
  );
}
