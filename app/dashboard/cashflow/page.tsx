"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, TrendingDown, AlertCircle, ChevronLeft, ChevronRight, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths } from "date-fns";
import { id } from "date-fns/locale";

interface TxItem {
  id: string;
  date: string;
  note: string;
  amount: number;
  category: string;
  type: string;
}

interface CreditCardData {
  accountId: string;
  accountName: string;
  settlementDate: number;
  jatuhTempoDate: number;
  totalSpend: string;
  totalPayment: string;
  outstanding: string;
  isOverdue: boolean;
  transactions: TxItem[];
}

interface CashflowResponse {
  period: {
    start: string;
    end: string;
    dueDate: string;
    settlementDate: number;
  } | null;
  creditCards: CreditCardData[];
  summary: {
    totalSpend: string;
    totalPayment: string;
    totalOutstanding: string;
    overdueCount: number;
  };
}

function formatIDR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "d MMM yyyy", { locale: id });
}

export default function CashflowPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/"); },
  });

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<CashflowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  function toggleCard(accountId: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.has(accountId) ? next.delete(accountId) : next.add(accountId);
      return next;
    });
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cashflow?month=${month}&year=${year}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError("Gagal memuat laporan arus kas.");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  function handlePrevMonth() {
    const prev = subMonths(new Date(year, month - 1), 1);
    setMonth(prev.getMonth() + 1);
    setYear(prev.getFullYear());
  }

  function handleNextMonth() {
    const next = addMonths(new Date(year, month - 1), 1);
    setMonth(next.getMonth() + 1);
    setYear(next.getFullYear());
  }

  const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: id });

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Laporan Arus Kas</h1>
            <p className="text-xs text-muted-foreground">Pantau pengeluaran Kartu Kredit</p>
          </div>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-base font-semibold min-w-[140px] text-center">{monthName}</span>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl p-4">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && (!data?.creditCards || data.creditCards.length === 0) && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <CreditCard className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">Belum ada Kartu Kredit.</p>
          <p className="text-xs text-muted-foreground">
            Tambahkan akun dengan tipe "Kartu Kredit" untuk melihat laporan arus kas.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {data && data.creditCards.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Pengeluaran</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">
                {formatIDR(data.summary.totalSpend)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Pembayaran</p>
              <p className="text-lg font-bold text-emerald-500 tabular-nums">
                {formatIDR(data.summary.totalPayment)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
              <p className="text-lg font-bold text-amber-500 tabular-nums">
                {formatIDR(data.summary.totalOutstanding)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Terlambat</p>
              <p className={cn(
                "text-lg font-bold tabular-nums",
                data.summary.overdueCount > 0 ? "text-red-500" : "text-emerald-500"
              )}>
                {data.summary.overdueCount} Kartu
              </p>
            </div>
          </div>

          {/* Period Info */}
          {data.period && (
            <div className="rounded-lg bg-muted/50 px-4 py-2 text-center text-sm text-muted-foreground">
              Perioda: {formatDate(data.period.start)} — {formatDate(data.period.end)} • 
              Jatuh Tempo: {formatDate(data.period.dueDate)}
            </div>
          )}

          {/* Credit Card List */}
          <div className="space-y-3">
            {data.creditCards.map((cc) => (
              <div
                key={cc.accountId}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-red-500" />
                    <span className="font-medium text-sm">{cc.accountName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {cc.isOverdue ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium">
                        Terlambat
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium">
                        Aktif
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Pengeluaran</p>
                      <p className="font-semibold text-red-500 tabular-nums">
                        {formatIDR(cc.totalSpend)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pembayaran</p>
                      <p className="font-semibold text-emerald-500 tabular-nums">
                        {formatIDR(cc.totalPayment)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Outstanding</span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        parseFloat(cc.outstanding) > 0 ? "text-amber-500" : "text-emerald-500"
                      )}>
                        {formatIDR(cc.outstanding)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>Settlement: tgl {cc.settlementDate}</span>
                    <span>Jatuh Tempo: tgl {cc.jatuhTempoDate}</span>
                  </div>

                  {/* Toggle transaksi */}
                  {cc.transactions.length > 0 && (
                    <button
                      onClick={() => toggleCard(cc.accountId)}
                      className="w-full flex items-center justify-center gap-1.5 pt-2 border-t border-border/50 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {expandedCards.has(cc.accountId) ? (
                        <><ChevronUp className="h-3.5 w-3.5" /> Sembunyikan transaksi</>
                      ) : (
                        <><ChevronDown className="h-3.5 w-3.5" /> {cc.transactions.length} transaksi</>
                      )}
                    </button>
                  )}
                </div>

                {/* Daftar transaksi */}
                {expandedCards.has(cc.accountId) && cc.transactions.length > 0 && (
                  <div className="border-t border-border">
                    {cc.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 hover:bg-muted/20 transition-colors gap-3"
                      >
                        <span className="text-xs text-muted-foreground w-16 shrink-0">
                          {format(new Date(tx.date), "d MMM", { locale: id })}
                        </span>
                        <span className="text-xs flex-1 truncate">{tx.note || "—"}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{tx.category}</span>
                        <span className={cn(
                          "text-xs font-semibold tabular-nums shrink-0",
                          tx.type === "payment" ? "text-emerald-500" : "text-red-500"
                        )}>
                          {tx.type === "payment" ? "+" : "-"}
                          {new Intl.NumberFormat("id-ID").format(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Helper for cn
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}