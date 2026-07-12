"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Plus, CalendarCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useApi } from "@/lib/hooks/use-api";
import { useDataEvent, emitDataChanged } from "@/lib/data-events";
import { formatCompactIDR, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/dashboard/SectionCard";

const InstallmentInputModal = dynamic(
  () => import("@/components/InstallmentInputModal"),
  { ssr: false }
);

interface InstallmentItem {
  id: string;
  name: string;
  totalAmount: number;
  tenor: number;
  startMonth: string;
  paidCount: number;
  paidAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  lunasMonth: string;
  status: string;
}

interface InstallmentSummary {
  activeCount: number;
  totalMonthly: number;
  totalOutstanding: number;
  lastLunasMonth: string | null;
  items: InstallmentItem[];
}

export default function InstallmentDashboardCard({ className }: { className?: string }) {
  const [showModal, setShowModal] = useState(false);

  const { data, mutate } = useApi<InstallmentSummary>("/api/installments/summary");

  useDataEvent("transactions", () => {
    mutate();
  });

  const handleSaved = () => {
    mutate();
    emitDataChanged("transactions");
  };

  if (!data) {
    return (
      <div className={cn("rounded-[22px] border border-border/60 bg-card p-4", className)}>
        <div className="mb-2 space-y-1">
          <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const { activeCount, totalMonthly, totalOutstanding, lastLunasMonth, items } = data;

  // Empty state
  if (activeCount === 0 && items.length === 0) {
    return (
      <>
        <div
          className={cn(
            "rounded-[22px] border border-dashed border-border/70 bg-card/60 p-4",
            className
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Cicilan Aktif</p>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Belum ada cicilan. Tambah cicilan baru untuk melacak pengeluaran berkala.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Plus className="size-4" />
            Tambah Cicilan
          </button>
        </div>
        {showModal && (
          <InstallmentInputModal
            onClose={() => setShowModal(false)}
            onSaved={handleSaved}
          />
        )}
      </>
    );
  }

  return (
    <>
      <SectionCard
        eyebrow="Keuangan"
        title="Cicilan Aktif"
        dense
        action={
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="size-3.5" />
            Tambah
          </button>
        }
        className={className}
      >
        {/* Summary stats */}
        <div className="mb-3.5 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
            <div className="mb-0.5 flex items-center gap-1 text-[10.5px] font-medium text-primary">
              <CreditCard className="size-3" />
              Per Bulan
            </div>
            <p className="text-[15px] font-bold tracking-tight text-primary">
              {formatCompactIDR(totalMonthly)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5">
            <div className="mb-0.5 flex items-center gap-1 text-[10.5px] font-medium text-amber-700 dark:text-amber-400">
              <CalendarCheck className="size-3" />
              Sisa Utang
            </div>
            <p className="text-[15px] font-bold tracking-tight text-amber-700 dark:text-amber-400">
              {formatCompactIDR(totalOutstanding)}
            </p>
          </div>
        </div>

        {/* Active count badge + freedom date */}
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <CreditCard className="size-3" />
            {activeCount} cicilan aktif
          </span>
          {lastLunasMonth && (
            <span className="text-[11px] text-muted-foreground">
              Lunas terakhir: <span className="font-medium text-foreground">{lastLunasMonth}</span>
            </span>
          )}
        </div>

        {/* Per-item progress bars */}
        <div className="space-y-2.5">
          {items.slice(0, 5).map((item) => {
            const pct =
              item.tenor > 0 ? Math.min(100, (item.paidCount / item.tenor) * 100) : 0;
            return (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {item.paidCount}/{item.tenor}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-foreground">
                    {Math.round(pct)}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {formatIDR(item.monthlyPayment)}/bln · sisa {formatCompactIDR(item.remainingAmount)}
                </p>
              </div>
            );
          })}
        </div>

        {items.length > 5 && (
          <Link
            href="/dashboard/installments"
            className="mt-3 inline-block text-[12px] font-medium text-primary hover:underline"
          >
            Lihat Semua &rarr;
          </Link>
        )}
      </SectionCard>

      {showModal && (
        <InstallmentInputModal
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
