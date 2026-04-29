"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, BellRing, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import BillCard, { BillWithMeta, getBillStatus } from "@/components/BillCard";
import AddBillModal from "@/components/AddBillModal";
import PayBillModal from "@/components/PayBillModal";
import { format, startOfDay, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type FilterType = "all" | "due-today" | "overdue" | "due-soon" | "paid" | "upcoming";

interface Summary {
  totalBills: number;
  paidAmount: number;
  pendingAmount: number;
  overdueCount: number;
  dueTodayCount: number;
}

export default function BillsClient() {
  const [bills, setBills] = useState<BillWithMeta[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editBill, setEditBill] = useState<BillWithMeta | null>(null);
  const [payBill, setPayBill] = useState<BillWithMeta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [billsRes, summaryRes] = await Promise.all([
        fetch("/api/bills"),
        fetch(`/api/bills/summary?period=${format(new Date(), "yyyy-MM")}`),
      ]);
      if (billsRes.ok) setBills(await billsRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSkip = async (id: string) => {
    const res = await fetch(`/api/bills/${id}/skip`, { method: "POST" });
    if (res.ok) load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus tagihan ini?")) return;
    const res = await fetch(`/api/bills?id=${id}`, { method: "DELETE" });
    if (res.ok) load();
  };

  const filtered = bills.filter((b) => {
    if (filter === "all") return true;
    return getBillStatus(b) === filter;
  });

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "Semua" },
    { key: "overdue", label: "Terlambat" },
    { key: "due-today", label: "Hari Ini" },
    { key: "due-soon", label: "Segera" },
    { key: "paid", label: "Lunas" },
    { key: "upcoming", label: "Mendatang" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tagihan Rutin</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), "MMMM yyyy", { locale: idLocale })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => { setEditBill(null); setShowAdd(true); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Tagihan</p>
            <p className="text-xl font-bold text-foreground">{summary.totalBills}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Sudah Dibayar</p>
            <p className="text-xl font-bold text-emerald-600">
              {(summary.paidAmount / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Belum Bayar</p>
            <p className="text-xl font-bold text-foreground">
              {(summary.pendingAmount / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Terlambat</p>
            <p className={`text-xl font-bold ${summary.overdueCount > 0 ? "text-red-600" : "text-foreground"}`}>
              {summary.overdueCount}
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap mb-5">
        {filterButtons.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bills List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Memuat...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <BellRing className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {filter === "all" ? "Belum ada tagihan rutin. Klik \"Tambah\" untuk mulai." : "Tidak ada tagihan dengan filter ini."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onPay={() => setPayBill(bill)}
              onSkip={() => handleSkip(bill.id)}
              onEdit={() => { setEditBill(bill); setShowAdd(true); }}
              onDelete={() => handleDelete(bill.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddBillModal
          onClose={() => { setShowAdd(false); setEditBill(null); }}
          onSaved={load}
          editBill={editBill}
        />
      )}

      {payBill && (
        <PayBillModal
          bill={payBill}
          onClose={() => setPayBill(null)}
          onPaid={load}
        />
      )}
    </div>
  );
}
