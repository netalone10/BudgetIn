"use client";

import { useState } from "react";
import { Calendar, Scale, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReport } from "./useReport";
import type { CategoryRow, BalanceSheetGroup } from "@/lib/report-data";
import {
  KpiCard,
  ReportError,
  ReportLoadingSkeleton,
  formatRupiah,
} from "./parts";

type BalancePayload = {
  asOf: string;
  asOfLabel: string;
  ownerName: string;
  generatedAt: string;
  assets: CategoryRow[];
  liabilities: CategoryRow[];
  assetGroups: BalanceSheetGroup[];
  liabilityGroups: BalanceSheetGroup[];
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BalanceSheetReport() {
  const [asOf, setAsOf] = useState<string>(todayISO);
  const { data, loading, error, refetch } = useReport<BalancePayload>(
    `/api/report?mode=balance&asOf=${asOf}`,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per tanggal</span>
          <input
            type="date"
            value={asOf}
            max={todayISO()}
            onChange={(e) => e.target.value && setAsOf(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm tabular-nums"
          />
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Neraca snapshot
        </span>
      </div>

      {loading && <ReportLoadingSkeleton />}
      {error && !loading && <ReportError message={error} onRetry={refetch} />}

      {!loading && !error && data && <BalanceContent data={data} />}
    </div>
  );
}

function BalanceContent({ data }: { data: BalancePayload }) {
  const balanced = Math.abs(data.totalAssets - (data.totalLiabilities + data.equity)) < 1;

  return (
    <>
      <header className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="label-mono text-muted-foreground block">Balance Sheet (Neraca)</span>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Per {data.asOfLabel}
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

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Total Aset" value={formatRupiah(data.totalAssets)} tone="positive" />
        <KpiCard label="Total Liabilitas" value={formatRupiah(data.totalLiabilities)} tone="negative" />
        <KpiCard
          label="Ekuitas (Kekayaan Bersih)"
          value={formatRupiah(data.equity)}
          tone={data.equity >= 0 ? "positive" : "negative"}
          icon={<Scale className="size-4" />}
        />
      </section>

      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <span className="label-mono text-muted-foreground mb-4 block">
          03 / Balance Sheet — Per {data.asOfLabel}
        </span>

        <div className="grid gap-5 md:grid-cols-2">
          {/* ASET */}
          <BalanceColumn
            heading="ASET"
            groups={data.assetGroups}
            total={data.totalAssets}
            totalLabel="Total Aset"
            tone="positive"
          />

          {/* LIABILITAS + EKUITAS */}
          <div>
            <BalanceColumn
              heading="LIABILITAS"
              groups={data.liabilityGroups}
              total={data.totalLiabilities}
              totalLabel="Total Liabilitas"
              tone="negative"
              extraRow={{ label: "Ekuitas (Modal Pemilik)", value: data.equity }}
              grandTotalLabel="Total Liabilitas + Ekuitas"
              grandTotal={data.totalLiabilities + data.equity}
            />
          </div>
        </div>

        <div
          className={cn(
            "mt-5 flex items-center justify-between rounded-2xl border-2 px-5 py-4",
            balanced ? "border-[#0fa76e]/30 bg-[#0fa76e]/5" : "border-destructive/30 bg-destructive/5",
          )}
        >
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Persamaan Akuntansi
            </span>
            <span className="text-sm font-medium text-foreground">Aset = Liabilitas + Ekuitas</span>
          </div>
          <span className={cn("text-sm font-bold tabular-nums", balanced ? "text-[#0fa76e]" : "text-destructive")}>
            {formatRupiah(data.totalAssets)} = {formatRupiah(data.totalLiabilities + data.equity)}
          </span>
        </div>
      </section>
    </>
  );
}

function BalanceColumn({
  heading,
  groups,
  total,
  totalLabel,
  tone,
  extraRow,
  grandTotalLabel,
  grandTotal,
}: {
  heading: string;
  groups: BalanceSheetGroup[];
  total: number;
  totalLabel: string;
  tone: "positive" | "negative";
  extraRow?: { label: string; value: number };
  grandTotalLabel?: string;
  grandTotal?: number;
}) {
  const toneText = tone === "positive" ? "text-[#0fa76e]" : "text-destructive";
  const isEmpty = groups.every((g) => g.rows.length === 0);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="bg-muted/30 px-4 py-2">
        <span className={cn("text-[11px] font-bold uppercase tracking-widest", toneText)}>{heading}</span>
      </div>
      <table className="w-full">
        {isEmpty ? (
          <tbody>
            <tr>
              <td colSpan={2} className="px-4 py-3 text-center text-xs text-muted-foreground">
                Tidak ada akun {heading.toLowerCase()}.
              </td>
            </tr>
          </tbody>
        ) : (
          groups.map((group) => (
            <tbody key={group.typeName} className="border-b border-border last:border-0">
              <tr className="bg-muted/15">
                <td className="px-4 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.typeName}
                </td>
                <td className="px-4 pt-2.5 pb-1 text-right text-[11px] font-medium tabular-nums text-muted-foreground">
                  {formatRupiah(group.subtotal)}
                </td>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.category} className="hover:bg-muted/10">
                  <td className="px-4 py-2 pl-6 text-sm text-foreground">{row.category}</td>
                  <td className="px-4 py-2 text-right text-sm tabular-nums text-foreground">
                    {formatRupiah(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          ))
        )}
        <tfoot>
          <tr className="border-t border-border bg-muted/20">
            <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground">{totalLabel}</td>
            <td className={cn("px-4 py-2.5 text-right text-sm font-bold tabular-nums", toneText)}>
              {formatRupiah(total)}
            </td>
          </tr>
          {extraRow && (
            <tr className="border-t border-border">
              <td className="px-4 py-2.5 text-sm font-medium text-foreground">{extraRow.label}</td>
              <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-foreground">
                {formatRupiah(extraRow.value)}
              </td>
            </tr>
          )}
          {grandTotalLabel && typeof grandTotal === "number" && (
            <tr className="border-t-2 border-border bg-muted/30">
              <td className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground">
                {grandTotalLabel}
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums text-foreground">
                {formatRupiah(grandTotal)}
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
