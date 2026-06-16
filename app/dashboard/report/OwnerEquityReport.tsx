"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReport } from "./useReport";
import {
  KpiCard,
  ReportError,
  ReportLoadingSkeleton,
  formatRupiah,
} from "./parts";

type EquityPayload = {
  periodLabel: string;
  ownerName: string;
  generatedAt: string;
  beginningEquity: number;
  endingEquity: number;
  netIncome: number;
  withdrawals: number;
  adjustments: number;
  reconciliation: number;
};

function currentMonthYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Format dengan tanda eksplisit (+/−) untuk baris mutasi. */
function formatSigned(value: number): string {
  if (!value) return "Rp 0";
  const sign = value < 0 ? "−" : "+";
  return `${sign}Rp ${Math.abs(value).toLocaleString("id-ID")}`;
}

export default function OwnerEquityReport() {
  const [month, setMonth] = useState<string>(currentMonthYM);
  const { data, loading, error, refetch } = useReport<EquityPayload>(
    `/api/report?mode=equity&month=${month}`,
  );

  const isCurrentMonth = month === currentMonthYM();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Bulan sebelumnya">
            <ChevronLeft className="size-4" />
          </Button>
          <input
            type="month"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm tabular-nums"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={isCurrentMonth}
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Perubahan ekuitas per bulan
        </span>
      </div>

      {loading && <ReportLoadingSkeleton />}
      {error && !loading && <ReportError message={error} onRetry={refetch} />}

      {!loading && !error && data && <EquityContent data={data} />}
    </div>
  );
}

function EquityContent({ data }: { data: EquityPayload }) {
  const change = data.endingEquity - data.beginningEquity;
  const showRecon = Math.abs(data.reconciliation) >= 1;

  return (
    <>
      <header className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="label-mono text-muted-foreground block">Statement of Owner&apos;s Equity</span>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {data.periodLabel}
            </h3>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" /> {data.ownerName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" /> Dibuat {data.generatedAt}
            </span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Modal Awal" value={formatRupiah(data.beginningEquity)} tone="neutral" />
        <KpiCard
          label="Laba Bersih"
          value={formatRupiah(data.netIncome)}
          tone={data.netIncome >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Perubahan Ekuitas"
          value={formatRupiah(change)}
          tone={change >= 0 ? "positive" : "negative"}
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          label="Modal Akhir"
          value={formatRupiah(data.endingEquity)}
          tone={data.endingEquity >= 0 ? "positive" : "negative"}
        />
      </section>

      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <span className="label-mono text-muted-foreground mb-4 block">
          02 / Statement of Owner&apos;s Equity — {data.periodLabel}
        </span>

        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <tbody>
              <WaterfallRow label="Modal Awal (Ekuitas Awal Periode)" value={data.beginningEquity} plain />
              <WaterfallRow label="Laba Bersih Periode Ini" value={data.netIncome} signed />
              <WaterfallRow label="Penarikan ke Tabungan / Investasi" value={-data.withdrawals} signed />
              <WaterfallRow label="Penyesuaian Ekuitas (Saldo Awal & Koreksi)" value={data.adjustments} signed />
              {showRecon && (
                <WaterfallRow label="Selisih Rekonsiliasi (mutasi akun liabilitas, dll)" value={data.reconciliation} signed muted />
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/30">
                <td className="px-4 py-3 text-sm font-bold uppercase tracking-wider text-foreground">
                  Modal Akhir (Ekuitas Akhir Periode)
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right text-base font-bold tabular-nums",
                    data.endingEquity >= 0 ? "text-[#0fa76e]" : "text-destructive",
                  )}
                >
                  {formatRupiah(data.endingEquity)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Tabungan/investasi diperlakukan sebagai penarikan ke ekuitas (mengurangi kekayaan bersih),
          bukan beban. Saldo Awal &amp; Penyesuaian Saldo langsung memengaruhi ekuitas tanpa melewati laba rugi.
        </p>
      </section>
    </>
  );
}

function WaterfallRow({
  label,
  value,
  signed,
  plain,
  muted,
}: {
  label: string;
  value: number;
  signed?: boolean;
  plain?: boolean;
  muted?: boolean;
}) {
  const tone = plain
    ? "text-foreground"
    : value > 0
    ? "text-[#0fa76e]"
    : value < 0
    ? "text-destructive"
    : "text-muted-foreground";
  return (
    <tr className={cn("border-b border-border last:border-0", muted && "bg-muted/10")}>
      <td className="px-4 py-2.5 text-sm text-foreground">{label}</td>
      <td className={cn("px-4 py-2.5 text-right text-sm tabular-nums font-medium", tone)}>
        {signed ? formatSigned(value) : formatRupiah(value)}
      </td>
    </tr>
  );
}
