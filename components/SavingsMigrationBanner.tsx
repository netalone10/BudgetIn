"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Sparkles, X } from "lucide-react";

interface Props {
  targetRef: React.RefObject<HTMLElement | null>;
  refreshKey?: number;
  /** Total semua savings transactions (allocated + unallocated) — dikirim dari parent */
  totalHistory?: number;
}

export default function SavingsMigrationBanner({ targetRef, refreshKey, totalHistory }: Props) {
  const [unallocatedCount, setUnallocatedCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    fetch("/api/savings/unallocated")
      .then((r) => r.json())
      .then((d) => setUnallocatedCount((d.transactions ?? []).length))
      .catch(() => setUnallocatedCount(0));
  }, [refreshKey]);

  // Belum selesai fetch
  if (unallocatedCount === null) return null;
  // Sudah dismiss atau tidak ada apa-apa
  if (dismissed || (unallocatedCount === 0 && !totalHistory)) return null;

  function scrollToSection() {
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Semua sudah dialokasikan, tapi ada history → tampilkan versi ringan
  if (unallocatedCount === 0 && totalHistory && totalHistory > 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-emerald-800 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-200">
        <span className="text-base">✅</span>
        <p className="flex-1 text-sm">
          Semua transaksi tabungan sudah dialokasikan ke goal.
        </p>
        <button
          onClick={scrollToSection}
          className="shrink-0 text-xs font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
        >
          Lihat riwayat
        </button>
      </div>
    );
  }

  // Ada yang belum dialokasikan
  return (
    <div className="relative flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3.5 text-amber-900 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">
          {unallocatedCount} transaksi tabungan lama belum dialokasikan
        </p>
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
          Dulunya dicatat sebagai pengeluaran dengan kategori tabungan.
          Alokasikan ke goal agar progress kamu akurat.
        </p>
      </div>

      <button
        onClick={scrollToSection}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
      >
        Alokasikan
        <ArrowDown className="size-3" />
      </button>

      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2.5 top-2.5 rounded p-0.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/40"
        aria-label="Tutup"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
