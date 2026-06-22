"use client";

import { Wallet } from "lucide-react";
import Link from "next/link";
import type { SafeToSpendResult } from "@/lib/safe-to-spend";
import { formatIDR, formatCompactIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Kartu "Aman dipakai per hari". Menampilkan alokasi harian yang masih aman
 * dari sisa budget variable sampai akhir bulan. Angka berasal dari
 * `computeSafeToSpend` (lihat lib/safe-to-spend.ts) sehingga 1 sumber dengan
 * halaman Budget.
 *
 * Tidak dirender jika belum ada budget variable atau bukan bulan berjalan
 * (safe-to-spend hanya bermakna untuk hari ini).
 */
export default function SafeToSpendCard({
  result,
  showLink = true,
  className,
}: {
  result: SafeToSpendResult;
  showLink?: boolean;
  className?: string;
}) {
  if (!result.hasBudget || !result.isCurrentMonth) return null;

  const { perDay, remaining, daysLeft, depleted, variableSpent, variableBudget } = result;
  const usedPct = variableBudget > 0 ? Math.min(100, (variableSpent / variableBudget) * 100) : 0;

  return (
    <div
      className={cn(
        "rounded-[22px] border p-4",
        depleted ? "border-destructive/30 bg-destructive/5" : "border-emerald-500/30 bg-emerald-500/5",
        className
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Wallet
          className={cn(
            "size-4 shrink-0",
            depleted ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
          )}
        />
        <p
          className={cn(
            "text-sm font-semibold",
            depleted ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"
          )}
        >
          Aman Dipakai
        </p>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {daysLeft} hari lagi
        </span>
      </div>

      {depleted ? (
        <>
          <p className="text-lg font-bold text-destructive">Budget variabel habis</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Sudah {formatCompactIDR(variableSpent)} dari {formatCompactIDR(variableBudget)}.
            Tahan dulu sampai bulan depan, ya.
          </p>
        </>
      ) : (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatIDR(Math.floor(perDay))}
            </span>
            <span className="text-[13px] font-medium text-muted-foreground">/ hari</span>
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Sisa {formatCompactIDR(remaining)} untuk {daysLeft} hari ke depan.
          </p>
        </>
      )}

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", depleted ? "bg-destructive" : "bg-emerald-500")}
          style={{ width: `${usedPct}%` }}
        />
      </div>

      {showLink && (
        <Link
          href="/dashboard/budget"
          className={cn(
            "mt-3 inline-block text-[12px] font-medium hover:underline",
            depleted ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"
          )}
        >
          Atur budget &rarr;
        </Link>
      )}
    </div>
  );
}
