"use client";

import { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  Info,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReport } from "./useReport";
import {
  CategoryTable,
  KpiCard,
  NetBanner,
  ReportEmptyState,
  ReportError,
  ReportLoadingSkeleton,
  formatRupiah,
  sumRows,
} from "./parts";
import type { CategoryRow } from "@/lib/report-data";

type CustomPayload = {
  periodLabel: string;
  ownerName: string;
  generatedAt: string;
  income: CategoryRow[];
  expense: CategoryRow[];
  startDate: string;
  endDate: string;
  daysInRange: number;
};

function defaultRange(): { from: string; to: string } {
  const today = new Date();
  const past = new Date(today);
  past.setDate(today.getDate() - 29);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(past), to: fmt(today) };
}

export default function CustomRangeReport() {
  const [initial] = useState(defaultRange);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [appliedFrom, setAppliedFrom] = useState(initial.from);
  const [appliedTo, setAppliedTo] = useState(initial.to);

  const { data, loading, error, refetch } = useReport<CustomPayload>(
    `/api/report?mode=custom&from=${appliedFrom}&to=${appliedTo}`,
  );

  const handleApply = () => {
    if (!from || !to || from > to) return;
    setAppliedFrom(from);
    setAppliedTo(to);
  };

  const rangeInvalid = !from || !to || from > to;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm md:flex-row md:items-end md:justify-between print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Mulai</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Selesai</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm tabular-nums"
            />
          </label>
          <Button size="sm" onClick={handleApply} disabled={rangeInvalid}>
            Terapkan
          </Button>
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Custom range
        </span>
      </div>

      {loading && <ReportLoadingSkeleton />}
      {error && !loading && (
        <ReportError message={error} onRetry={refetch} />
      )}

      {!loading && !error && data && <CustomRangeContent data={data} />}
    </div>
  );
}

function CustomRangeContent({ data }: { data: CustomPayload }) {
  const totalIncome = sumRows(data.income);
  const totalExpense = sumRows(data.expense);
  const net = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
  const isPositive = net >= 0;
  const hasAnyData = totalIncome > 0 || totalExpense > 0;

  if (!hasAnyData) {
    return <ReportEmptyState periodLabel={data.periodLabel} />;
  }

  return (
    <>
      <header className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <div>
          <span className="label-mono text-muted-foreground block">Laporan Custom Range</span>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {data.periodLabel}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <CalendarRange className="size-3.5" /> Periode {data.daysInRange} hari · {data.ownerName}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Total Pemasukan" value={formatRupiah(totalIncome)} tone="positive" icon={<ArrowUpCircle className="size-4" />} />
        <KpiCard label="Total Pengeluaran" value={formatRupiah(totalExpense)} tone="negative" icon={<ArrowDownCircle className="size-4" />} />
        <KpiCard
          label={isPositive ? "Surplus" : "Defisit"}
          value={formatRupiah(net)}
          tone={isPositive ? "positive" : "negative"}
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          label="Savings Rate"
          value={totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : "—"}
          tone={savingsRate >= 20 ? "positive" : savingsRate >= 10 ? "neutral" : "negative"}
        />
      </section>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-2.5 text-xs text-blue-700 dark:text-blue-300 inline-flex items-start gap-2 print:hidden">
        <Info className="size-3.5 mt-0.5 shrink-0" />
        <span>
          Custom range tidak terikat siklus bulanan. Kolom <strong>Avg/Hari</strong> = nominal ÷ {data.daysInRange} hari.
        </span>
      </div>

      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <span className="label-mono text-muted-foreground mb-4 block">
          01 / Income Statement — {data.periodLabel}
        </span>

        <div className="space-y-6">
          <CategoryTable
            heading="PEMASUKAN"
            rows={data.income}
            total={totalIncome}
            tone="positive"
            days={data.daysInRange}
          />
          <CategoryTable
            heading="PENGELUARAN"
            rows={data.expense}
            total={totalExpense}
            tone="negative"
            days={data.daysInRange}
            showPercent
          />
          <NetBanner
            net={net}
            subtitle={`Rata-rata net per hari: ${formatRupiah(Math.round(net / data.daysInRange))}`}
          />
        </div>
      </section>
    </>
  );
}
