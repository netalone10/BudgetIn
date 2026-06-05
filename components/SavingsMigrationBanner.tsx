"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Sparkles, X } from "lucide-react";

interface Props {
  /** Ref ke section "Belum Dialokasikan" untuk di-scroll ke sana */
  targetRef: React.RefObject<HTMLElement | null>;
  /** Key yang di-bump dari parent saat ada alokasi baru → re-fetch count */
  refreshKey?: number;
}

export default function SavingsMigrationBanner({ targetRef, refreshKey }: Props) {
  const [count, setCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false); // reset dismiss tiap kali refreshKey berubah
    fetch("/api/savings/unallocated")
      .then((r) => r.json())
      .then((d) => setCount((d.transactions ?? []).length))
      .catch(() => setCount(0));
  }, [refreshKey]);

  // Belum selesai fetch, atau sudah dismiss, atau tidak ada unallocated
  if (count === null || dismissed || count === 0) return null;

  function scrollToSection() {
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="relative flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3.5 text-amber-900 shadow-sm dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
      {/* Icon */}
      <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" />

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">
          {count} transaksi tabungan lama belum dialokasikan
        </p>
        <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
          Transaksi ini dulunya dicatat sebagai pengeluaran dengan kategori tabungan.
          Alokasikan ke goal agar progress kamu akurat.
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={scrollToSection}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-500"
      >
        Alokasikan
        <ArrowDown className="size-3" />
      </button>

      {/* Dismiss */}
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
