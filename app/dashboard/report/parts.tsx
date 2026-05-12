"use client";

import Link from "next/link";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/report-data";

export function formatRupiah(value: number): string {
  if (!value) return "—";
  const sign = value < 0 ? "-" : "";
  return `${sign}Rp ${Math.abs(value).toLocaleString("id-ID")}`;
}

export function compactRupiah(value: number): string {
  if (!value) return "—";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}rb`;
  return `${sign}${abs}`;
}

export function sumRows(rows: { amount: number }[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

export function KpiCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "positive"
      ? "text-[#0fa76e]"
      : tone === "negative"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-[20px] border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-2 text-lg font-bold tabular-nums md:text-xl", toneClass)}>
        {value}
      </div>
    </div>
  );
}

export function CategoryTable({
  heading,
  rows,
  total,
  tone,
  showPercent,
  days,
}: {
  heading: string;
  rows: CategoryRow[];
  total: number;
  tone: "positive" | "negative";
  showPercent?: boolean;
  /** Kalau dikasih, render kolom Avg/Hari = nominal ÷ days. */
  days?: number;
}) {
  const toneText = tone === "positive" ? "text-[#0fa76e]" : "text-destructive";
  const showAvg = typeof days === "number" && days > 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className={cn("text-[11px] font-bold uppercase tracking-widest", toneText)}>
          {heading}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {rows.length} kategori
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-3 text-center text-xs text-muted-foreground">
          Tidak ada {heading.toLowerCase()} di periode ini.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className={cn("w-full", showAvg && "min-w-[420px]")}>
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Kategori
                </th>
                {showPercent && (
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    %
                  </th>
                )}
                {showAvg && (
                  <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Avg/Hari
                  </th>
                )}
                <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Nominal
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.category} className="border-b border-border last:border-0 hover:bg-muted/10">
                  <td className="px-4 py-2.5 text-sm font-medium text-foreground">{row.category}</td>
                  {showPercent && (
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                      {total > 0 ? `${((row.amount / total) * 100).toFixed(1)}%` : "—"}
                    </td>
                  )}
                  {showAvg && (
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                      {formatRupiah(Math.round(row.amount / days!))}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right text-sm tabular-nums text-foreground">
                    {formatRupiah(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/20">
              <tr>
                <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground">
                  Total {heading}
                </td>
                {showPercent && <td className="px-3 py-2.5" />}
                {showAvg && (
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    {formatRupiah(Math.round(total / days!))}
                  </td>
                )}
                <td className={cn("px-4 py-2.5 text-right text-sm font-bold tabular-nums", toneText)}>
                  {formatRupiah(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export function NetBanner({ net, subtitle }: { net: number; subtitle?: string }) {
  const isPositive = net >= 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl border-2 px-5 py-4",
        isPositive
          ? "border-[#0fa76e]/30 bg-[#0fa76e]/5"
          : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          NET (Pemasukan – Pengeluaran)
        </span>
        <span className="text-xs text-muted-foreground">
          {subtitle ?? (isPositive ? "Anda mencatat surplus periode ini." : "Pengeluaran melebihi pemasukan.")}
        </span>
      </div>
      <span className={cn("text-2xl font-bold tabular-nums", isPositive ? "text-[#0fa76e]" : "text-destructive")}>
        {formatRupiah(net)}
      </span>
    </div>
  );
}

export function ReportLoadingSkeleton() {
  return (
    <div className="rounded-[24px] border border-border bg-card p-12 flex flex-col items-center justify-center shadow-sm">
      <Loader2 className="size-8 animate-spin text-primary mb-3" />
      <h3 className="text-sm font-medium text-muted-foreground">Memuat data laporan…</h3>
    </div>
  );
}

export function ReportError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[24px] border border-destructive/20 bg-destructive/5 p-6 text-center shadow-sm">
      <AlertTriangle className="size-7 text-destructive mx-auto mb-3" />
      <h3 className="font-semibold text-destructive mb-1">Gagal memuat laporan</h3>
      <p className="text-sm text-destructive/80 mb-4">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Coba Lagi
        </Button>
      )}
    </div>
  );
}

export function ReportEmptyState({ periodLabel }: { periodLabel: string }) {
  return (
    <div className="rounded-[24px] border border-border bg-card p-12 text-center shadow-sm">
      <div className="size-14 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
        <FileText className="size-6" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Belum ada transaksi</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
        Tidak ditemukan transaksi pemasukan atau pengeluaran di periode <strong>{periodLabel}</strong>. Catat transaksi pertama untuk melihat laporan.
      </p>
      <Link
        href="/dashboard"
        className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Catat Transaksi
      </Link>
    </div>
  );
}
