"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, TrendingDown, AlertCircle, ChevronLeft, ChevronRight, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths } from "date-fns";
import { id } from "date-fns/locale";
import { useDataEvent } from "@/lib/data-events";

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

const IDR_FORMAT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const ID_NUMBER_FORMAT = new Intl.NumberFormat("id-ID");

function formatIDR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return IDR_FORMAT.format(num);
}

function formatDate(dateStr: string): string {
  return format(new Date(dateStr), "d MMM yyyy", { locale: id });
}

export default function CashflowPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/"); },
  });

  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
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

  const fetchData = useCallback(
    async (opts?: { noStore?: boolean; silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(
          `/api/cashflow?month=${month}&year=${year}`,
          opts?.noStore ? { cache: "no-store" } : undefined
        );
        if (!res.ok) throw new Error("Gagal memuat data");
        const json = await res.json();
        setData(json);
      } catch {
        if (!opts?.silent) setError("Gagal memuat laporan arus kas.");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [month, year]
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    // Defer off the synchronous effect path: setState runs in the promise
    // callback, not during the effect body.
    let active = true;
    Promise.resolve().then(() => {
      if (active) fetchData();
    });
    return () => {
      active = false;
    };
  }, [status, fetchData]);

  useDataEvent(["transactions", "accounts"], () => {
    if (status === "authenticated") fetchData({ noStore: true, silent: true });
  });

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
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-9 shrink-0 rounded-xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
          <TrendingDown className="size-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">Laporan Arus Kas</h1>
          <p className="text-xs text-muted-foreground">Pantau pengeluaran Kartu Kredit</p>
        </div>
      </div>

      {/* Month Navigator */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-base font-semibold min-w-[140px] text-center">{monthName}</span>
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl p-4">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && (!data?.creditCards || data.creditCards.length === 0) && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <CreditCard className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">Belum ada Kartu Kredit.</p>
          <p className="text-xs text-muted-foreground">
            Tambahkan akun dengan tipe &quot;Kartu Kredit&quot; untuk melihat laporan arus kas.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      {data && data.creditCards.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="min-w-0 rounded-xl border border-border bg-card p-3 text-center sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Pengeluaran</p>
              <p className="break-words text-[clamp(0.8rem,3vw,1.125rem)] font-bold leading-tight text-red-500 tabular-nums">
                {formatIDR(data.summary.totalSpend)}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-border bg-card p-3 text-center sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Pembayaran</p>
              <p className="break-words text-[clamp(0.8rem,3vw,1.125rem)] font-bold leading-tight text-emerald-500 tabular-nums">
                {formatIDR(data.summary.totalPayment)}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-border bg-card p-3 text-center sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
              <p className="break-words text-[clamp(0.8rem,3vw,1.125rem)] font-bold leading-tight text-amber-500 tabular-nums">
                {formatIDR(data.summary.totalOutstanding)}
              </p>
            </div>
            <div className="min-w-0 rounded-xl border border-border bg-card p-3 text-center sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">Terlambat</p>
              <p className={cn(
                "break-words text-[clamp(0.8rem,3vw,1.125rem)] font-bold leading-tight tabular-nums",
                data.summary.overdueCount > 0 ? "text-red-500" : "text-emerald-500"
              )}>
                {data.summary.overdueCount} Kartu
              </p>
            </div>
          </div>

          {/* Period Info */}
          {data.period && (
            <div className="rounded-lg bg-muted/50 px-4 py-2 text-center text-sm text-muted-foreground break-words">
              <span className="block sm:inline">Periode: {formatDate(data.period.start)} — {formatDate(data.period.end)}</span>
              <span className="hidden sm:inline"> • </span>
              <span className="block sm:inline">Jatuh Tempo: {formatDate(data.period.dueDate)}</span>
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
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <CreditCard className="size-4 text-red-500 shrink-0" />
                    <span className="truncate text-sm font-medium">{cc.accountName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Pengeluaran</p>
                      <p className="break-words font-semibold text-red-500 tabular-nums">
                        {formatIDR(cc.totalSpend)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Pembayaran</p>
                      <p className="break-words font-semibold text-emerald-500 tabular-nums">
                        {formatIDR(cc.totalPayment)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-muted-foreground">Outstanding</span>
                      <span className={cn(
                        "break-words font-bold tabular-nums",
                        parseFloat(cc.outstanding) > 0 ? "text-amber-500" : "text-emerald-500"
                      )}>
                        {formatIDR(cc.outstanding)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 pt-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
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
                        <><ChevronUp className="size-3.5" /> Sembunyikan transaksi</>
                      ) : (
                        <><ChevronDown className="size-3.5" /> {cc.transactions.length} transaksi</>
                      )}
                    </button>
                  )}
                </div>

                {/* Daftar transaksi */}
                {expandedCards.has(cc.accountId) && cc.transactions.length > 0 && (
                  <div className="overflow-x-auto border-t border-border">
                    <div className="min-w-0">
                    {cc.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="grid gap-1 border-b px-4 py-2.5 text-xs transition-colors last:border-0 hover:bg-muted/20 sm:grid-cols-[4rem_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3"
                      >
                        <span className="text-muted-foreground sm:w-16 sm:shrink-0">
                          <span suppressHydrationWarning>{format(new Date(tx.date), "d MMM", { locale: id })}</span>
                        </span>
                        <span className="truncate">{tx.note || "—"}</span>
                        <span className="truncate text-muted-foreground sm:shrink-0">{tx.category}</span>
                        <span className={cn(
                          "font-semibold tabular-nums whitespace-nowrap sm:shrink-0",
                          tx.type === "payment" ? "text-emerald-500" : "text-red-500"
                        )}>
                          {tx.type === "payment" ? "+" : "-"}
                          {ID_NUMBER_FORMAT.format(tx.amount)}
                        </span>
                      </div>
                    ))}
                    </div>
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
