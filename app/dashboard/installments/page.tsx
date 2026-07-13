"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Plus,
  CalendarCheck,
  ChevronRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useApi } from "@/lib/hooks/use-api";
import { useDataEvent, emitDataChanged } from "@/lib/data-events";
import { formatCompactIDR, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

const InstallmentInputModal = dynamic(
  () => import("@/components/InstallmentInputModal"),
  { ssr: false }
);

interface InstallmentItem {
  id: string;
  name: string;
  totalAmount: number;
  tenor: number;
  paid: number;
  remaining: number;
  monthlyAmount: number;
  outstandingDebt: number;
  progressPercent: number;
  freedomDate: string;
  startDate: string;
  source: string | null;
  nextDueDate: string;
  isActive: boolean;
}

interface InstallmentsResponse {
  data: InstallmentItem[];
}

export default function InstallmentsPage() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading, mutate } = useApi<InstallmentsResponse>(
    "/api/installments"
  );

  useDataEvent("transactions", () => {
    mutate();
  });

  const handleSaved = () => {
    mutate();
    emitDataChanged("transactions");
  };

  const items = data?.data ?? [];

  // Sort: active first, then completed
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return 0;
    });
  }, [items]);

  // Stats
  const stats = useMemo(() => {
    const active = items.filter((i) => i.isActive);
    const totalMonthly = active.reduce((s, i) => s + i.monthlyAmount, 0);
    const totalOutstanding = active.reduce((s, i) => s + i.outstandingDebt, 0);
    return {
      activeCount: active.length,
      totalCount: items.length,
      totalMonthly,
      totalOutstanding,
    };
  }, [items]);

  // Loading skeleton
  if (isLoading && !data) {
    return (
      <div className="flex min-w-0 flex-col w-full">
        <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2 mt-4 md:mt-2">
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </div>

          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-8 w-40 bg-muted rounded-lg animate-pulse" />
              <div className="h-4 w-52 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-9 w-28 bg-muted rounded-lg animate-pulse" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-3 gap-3">
            {["a", "b", "c"].map((k) => (
              <div
                key={k}
                className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2"
              >
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-6 w-28 bg-muted rounded" />
              </div>
            ))}
          </div>

          {/* List skeleton */}
          <div className="space-y-3">
            {["i1", "i2", "i3"].map((k) => (
              <div
                key={k}
                className="rounded-2xl border border-border bg-card p-5 animate-pulse space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <div className="h-5 w-40 bg-muted rounded" />
                    <div className="h-3 w-28 bg-muted rounded" />
                  </div>
                  <div className="h-6 w-16 bg-muted rounded-full" />
                </div>
                <div className="h-2.5 w-full bg-muted rounded-full" />
                <div className="flex justify-between">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (!data && !isLoading) {
    return (
      <div className="flex min-w-0 flex-col w-full">
        <div className="mx-auto w-full max-w-5xl px-4 md:p-8">
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Gagal memuat data cicilan.
            </p>
            <button
              onClick={() => mutate()}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm mt-4 md:mt-2">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">Cicilan</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="size-7 text-primary" />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Cicilan
              </h2>
              <p className="text-sm text-muted-foreground">
                Kelola semua cicilan aktif dan riwayat
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="size-4" />
            Tambah Cicilan
          </button>
        </div>

        {/* Stats Cards */}
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary mb-1">
                <CreditCard className="size-3.5" />
                Aktif
              </div>
              <p className="text-xl font-bold text-primary">
                {stats.activeCount}
              </p>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
                <CalendarCheck className="size-3.5" />
                Per Bulan
              </div>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
                {formatCompactIDR(stats.totalMonthly)}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                <AlertCircle className="size-3.5" />
                Sisa Utang
              </div>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
                {formatCompactIDR(stats.totalOutstanding)}
              </p>
            </div>
          </div>
        )}

        {/* Installment List */}
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 px-5 py-12 text-center">
            <CreditCard className="size-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              Belum ada cicilan. Tambah cicilan baru untuk melacak pengeluaran
              berkala.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="size-4" />
              Tambah Cicilan
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((item) => {
              const pct = item.progressPercent;
              const isCompleted = !item.isActive || item.remaining <= 0;
              return (
                <Link
                  key={item.id}
                  href={`/dashboard/installments/${item.id}`}
                  className="block rounded-2xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-foreground truncate">
                          {item.name}
                        </h3>
                        {isCompleted ? (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                            Lunas
                          </span>
                        ) : (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.source && `${item.source} · `}
                        {formatIDR(item.monthlyAmount)}/bln
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isCompleted
                              ? "bg-emerald-500"
                              : "bg-primary"
                          )}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs font-semibold tabular-nums text-foreground">
                        {Math.round(pct)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="tabular-nums">
                        {item.paid}/{item.tenor} bulan
                      </span>
                      <span>
                        Sisa {formatCompactIDR(item.outstandingDebt)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <InstallmentInputModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
