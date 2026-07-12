"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import {
  CreditCard,
  ChevronRight,
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Circle,
  Calendar,
  Tag,
  Wallet,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useApi } from "@/lib/hooks/use-api";
import { useDataEvent, emitDataChanged } from "@/lib/data-events";
import { formatCompactIDR, formatIDR, formatTanggalID } from "@/lib/format";
import { cn } from "@/lib/utils";

const InstallmentInputModal = dynamic(
  () => import("@/components/InstallmentInputModal"),
  { ssr: false }
);

interface Occurrence {
  id: string;
  occurredAt: string;
  amount: number;
  occurrenceKey: string;
  note: string | null;
}

interface InstallmentDetail {
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
  endDate: string;
  source: string | null;
  isActive: boolean;
  note: string | null;
  account: { id: string; name: string } | null;
  liabilityAccount: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  occurrences: Occurrence[];
}

export default function InstallmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    data: item,
    isLoading,
    mutate,
    error,
  } = useApi<InstallmentDetail>(id ? `/api/installments/${id}` : null);

  useDataEvent("transactions", () => {
    mutate();
  });

  const handleSaved = () => {
    mutate();
    emitDataChanged("transactions");
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/installments/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deactivateLiability: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Gagal menghapus cicilan.");
        return;
      }
      emitDataChanged("transactions");
      router.push("/dashboard/installments");
    } catch {
      alert("Gagal menghapus. Coba lagi.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Loading
  if (isLoading && !item) {
    return (
      <div className="flex min-w-0 flex-col w-full">
        <div className="mx-auto w-full max-w-3xl px-4 md:p-8 space-y-6">
          {/* Breadcrumb skeleton */}
          <div className="flex items-center gap-2 mt-4 md:mt-2">
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          </div>

          {/* Header skeleton */}
          <div className="rounded-2xl border border-border bg-card p-6 animate-pulse space-y-4">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-16 bg-muted rounded-xl" />
              <div className="h-16 bg-muted rounded-xl" />
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-2 gap-3">
            {["a", "b", "c", "d"].map((k) => (
              <div
                key={k}
                className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-2"
              >
                <div className="h-3 w-20 bg-muted rounded" />
                <div className="h-5 w-28 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error
  if (error || (!isLoading && !item)) {
    return (
      <div className="flex min-w-0 flex-col w-full">
        <div className="mx-auto w-full max-w-3xl px-4 md:p-8">
          <div className="flex flex-col items-center gap-3 py-16">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Cicilan tidak ditemukan.
            </p>
            <Link
              href="/dashboard/installments"
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
            >
              Kembali ke Daftar Cicilan
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pct = item!.progressPercent;
  const isCompleted = !item!.isActive || item!.remaining <= 0;

  // Build expected occurrences (months that should have been paid)
  const expectedOccurrences: {
    key: string;
    label: string;
    status: "paid" | "scheduled";
    amount: number;
  }[] = [];

  if (item!.tenor > 0) {
    const startDate = new Date(item!.startDate);
    const paidMap = new Map<string, Occurrence>();
    for (const occ of item!.occurrences) {
      paidMap.set(occ.occurrenceKey, occ);
      // Also index by YYYY-MM for month-level lookup
      const monthKey = occ.occurrenceKey.slice(0, 7);
      paidMap.set(monthKey, occ);
    }

    for (let i = 0; i < item!.tenor; i++) {
      const occDate = new Date(startDate);
      occDate.setMonth(occDate.getMonth() + i + 1); // first payment is next month
      const key = `${occDate.getFullYear()}-${String(occDate.getMonth() + 1).padStart(2, "0")}`;
      const label = occDate.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
      const paidOcc = paidMap.get(key);

      if (paidOcc) {
        expectedOccurrences.push({
          key,
          label,
          status: "paid",
          amount: paidOcc.amount,
        });
      } else {
        expectedOccurrences.push({
          key,
          label,
          status: "scheduled",
          amount: item!.monthlyAmount,
        });
      }
    }
  }

  // Freedom date formatting
  const freedomDateStr = item!.freedomDate
    ? new Date(item!.freedomDate).toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      })
    : "-";

  const startDateStr = item!.startDate
    ? formatTanggalID(item!.startDate.slice(0, 10))
    : "-";

  return (
    <div className="flex min-w-0 flex-col w-full">
      <div className="mx-auto w-full max-w-3xl px-4 md:p-8 space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm mt-4 md:mt-2">
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <Link
            href="/dashboard/installments"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Cicilan
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground truncate max-w-[200px]">
            {item!.name}
          </span>
        </nav>

        {/* Back button */}
        <Link
          href="/dashboard/installments"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Kembali
        </Link>

        {/* Header Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold text-foreground truncate">
                  {item!.name}
                </h1>
                {isCompleted ? (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    Lunas
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <CreditCard className="size-3" />
                    Aktif
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {item!.source && (
                  <span className="flex items-center gap-1">
                    <Tag className="size-3" />
                    {item!.source}
                  </span>
                )}
                {item!.category && (
                  <span className="flex items-center gap-1">
                    <Wallet className="size-3" />
                    {item!.category.name}
                  </span>
                )}
                {item!.account && (
                  <span className="flex items-center gap-1">
                    <CreditCard className="size-3" />
                    {item!.account.name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Edit"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                title="Hapus"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          {/* Big Progress Bar */}
          <div className="space-y-2 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Progress</span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {Math.round(pct)}%
              </span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isCompleted ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {item!.paid} dari {item!.tenor} bulan terbayar
            </p>
          </div>

          {/* Note */}
          {item!.note && (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {item!.note}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-xs font-medium text-primary mb-1">
              Cicilan/bln
            </p>
            <p className="text-lg font-bold text-primary tabular-nums">
              {formatIDR(item!.monthlyAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
              Sudah Dibayar
            </p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatCompactIDR(item!.paid * item!.monthlyAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
              Sisa Utang
            </p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400 tabular-nums">
              {formatCompactIDR(item!.outstandingDebt)}
            </p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">
              {isCompleted ? "Lunas" : "Target Lunas"}
            </p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-400">
              {freedomDateStr}
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            Info Cicilan
          </h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Mulai</p>
              <p className="font-medium text-foreground">{startDateStr}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Harga</p>
              <p className="font-medium text-foreground tabular-nums">
                {formatIDR(item!.totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Tenor</p>
              <p className="font-medium text-foreground">{item!.tenor} bulan</p>
            </div>
            {item!.liabilityAccount && (
              <div>
                <p className="text-muted-foreground text-xs">
                  Akun Liability
                </p>
                <p className="font-medium text-foreground">
                  {item!.liabilityAccount.name}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="p-5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="size-4 text-muted-foreground" />
              Riwayat Pembayaran
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {item!.paid} dari {item!.tenor} bulan terbayar
            </p>
          </div>

          {expectedOccurrences.length === 0 ? (
            <div className="p-5 text-center text-sm text-muted-foreground">
              Belum ada jadwal pembayaran.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {expectedOccurrences.map((occ, idx) => (
                <div
                  key={occ.key}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground tabular-nums w-6 text-right shrink-0">
                      {idx + 1}
                    </span>
                    {occ.status === "paid" ? (
                      <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium truncate",
                          occ.status === "paid"
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {occ.label}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm tabular-nums font-medium text-foreground">
                      {formatIDR(occ.amount)}
                    </span>
                    {occ.status === "paid" ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                        Sudah
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Jadwal
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && item && (
        <InstallmentInputModal
          onClose={() => setShowEditModal(false)}
          onSaved={handleSaved}
          editItem={{
            id: item.id,
            name: item.name,
            totalAmount: item.totalAmount,
            tenor: item.tenor,
            startMonth: item.startDate.slice(0, 7),
            source: item.source,
            note: item.note,
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Hapus Cicilan?
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Cicilan <strong>{item!.name}</strong> akan dinonaktifkan. Akun
              liability terkait juga akan dinonaktifkan. Tindakan ini tidak
              dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menghapus…
                  </>
                ) : (
                  "Hapus"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
