"use client";

import { useState } from "react";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
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

type MonthlyPayload = {
  periodLabel: string;
  ownerName: string;
  generatedAt: string;
  income: CategoryRow[];
  expense: CategoryRow[];
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

export default function MonthlyReport() {
  const [month, setMonth] = useState<string>(currentMonthYM);
  const { data, loading, error, refetch } = useReport<MonthlyPayload>(
    `/api/report?mode=monthly&month=${month}`,
  );

  const isCurrentMonth = month === currentMonthYM();

  return (
    <div className="space-y-6">
      <PeriodSelector
        month={month}
        onPrev={() => setMonth((m) => shiftMonth(m, -1))}
        onNext={() => setMonth((m) => shiftMonth(m, 1))}
        onChange={setMonth}
        canGoNext={!isCurrentMonth}
      />

      {loading && <ReportLoadingSkeleton />}
      {error && !loading && <ReportError message={error} onRetry={refetch} />}

      {!loading && !error && data && (
        <MonthlyReportContent data={data} />
      )}
    </div>
  );
}

function PeriodSelector({
  month,
  onPrev,
  onNext,
  onChange,
  canGoNext,
}: {
  month: string;
  onPrev: () => void;
  onNext: () => void;
  onChange: (ym: string) => void;
  canGoNext: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm print:hidden">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrev} aria-label="Bulan sebelumnya">
          <ChevronLeft className="size-4" />
        </Button>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm tabular-nums"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={onNext}
          disabled={!canGoNext}
          aria-label="Bulan berikutnya"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        Periode laporan bulanan
      </span>
    </div>
  );
}

function MonthlyReportContent({ data }: { data: MonthlyPayload }) {
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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="label-mono text-muted-foreground block">Laporan Keuangan</span>
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

      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <span className="label-mono text-muted-foreground mb-4 block">
          01 / Income Statement — {data.periodLabel}
        </span>

        <div className="space-y-6">
          <CategoryTable heading="PEMASUKAN" rows={data.income} total={totalIncome} tone="positive" />
          <CategoryTable heading="PENGELUARAN" rows={data.expense} total={totalExpense} tone="negative" showPercent />
          <NetBanner net={net} />
        </div>
      </section>
    </>
  );
}
