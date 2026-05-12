"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Calendar, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  KpiCard,
  ReportEmptyState,
  ReportError,
  ReportLoadingSkeleton,
  compactRupiah,
  formatRupiah,
} from "./parts";
import type { YearlyCategoryRow } from "@/lib/report-data";

const MONTH_LABELS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type YearlyPayload = {
  year: number;
  ownerName: string;
  generatedAt: string;
  income: YearlyCategoryRow[];
  expense: YearlyCategoryRow[];
};

function sumMonthly(rows: YearlyCategoryRow[]): number[] {
  const totals = new Array(12).fill(0);
  for (const row of rows) {
    for (let i = 0; i < 12; i++) totals[i] += row.monthly[i] ?? 0;
  }
  return totals;
}

export default function YearlyReport() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [data, setData] = useState<YearlyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useMemo(
    () => async (y: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/report?mode=yearly&year=${y}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memuat laporan.");
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchData(year);
  }, [year, fetchData]);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
    return years;
  }, [currentYear]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm print:hidden">
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tahun</span>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm tabular-nums"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Periode laporan tahunan</span>
      </div>

      {loading && <ReportLoadingSkeleton />}
      {error && !loading && <ReportError message={error} onRetry={() => fetchData(year)} />}
      {!loading && !error && data && <YearlyReportContent data={data} />}
    </div>
  );
}

function YearlyReportContent({ data }: { data: YearlyPayload }) {
  const incomeMonthlyTotals = sumMonthly(data.income);
  const expenseMonthlyTotals = sumMonthly(data.expense);
  const netMonthly = incomeMonthlyTotals.map((v, i) => v - expenseMonthlyTotals[i]);

  const totalIncomeYear = incomeMonthlyTotals.reduce((a, b) => a + b, 0);
  const totalExpenseYear = expenseMonthlyTotals.reduce((a, b) => a + b, 0);
  const netYear = totalIncomeYear - totalExpenseYear;
  const monthsWithActivity = expenseMonthlyTotals.filter((v) => v > 0).length || 1;
  const avgMonthlyExpense = totalExpenseYear / monthsWithActivity;
  const hasAnyData = totalIncomeYear > 0 || totalExpenseYear > 0;

  if (!hasAnyData) {
    return <ReportEmptyState periodLabel={`Tahun ${data.year}`} />;
  }

  return (
    <>
      <header className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <div>
          <span className="label-mono text-muted-foreground block">Laporan Tahunan</span>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Tahun {data.year}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Calendar className="size-3.5" /> {data.ownerName} · Dibuat {data.generatedAt}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Pemasukan Tahun" value={formatRupiah(totalIncomeYear)} tone="positive" icon={<ArrowUpCircle className="size-4" />} />
        <KpiCard label="Pengeluaran Tahun" value={formatRupiah(totalExpenseYear)} tone="negative" icon={<ArrowDownCircle className="size-4" />} />
        <KpiCard label="Net Tahun" value={formatRupiah(netYear)} tone={netYear >= 0 ? "positive" : "negative"} icon={<Wallet className="size-4" />} />
        <KpiCard label="Avg Pengeluaran/Bulan" value={formatRupiah(Math.round(avgMonthlyExpense))} tone="neutral" />
      </section>

      <section className="rounded-[24px] border border-border bg-card p-6 shadow-sm print-section print:rounded-lg print:border-black/30 print:p-4">
        <span className="label-mono text-muted-foreground mb-4 block">
          01 / Income Statement Matrix — {data.year}
        </span>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[1000px] text-xs">
            <thead className="bg-muted/30">
              <tr className="border-b border-border">
                <th className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Kategori
                </th>
                {MONTH_LABELS_ID.map((m) => (
                  <th key={m} className="px-2 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {data.income.length > 0 && (
                <>
                  <tr className="bg-[#0fa76e]/5 border-b border-border">
                    <td colSpan={14} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#0fa76e]">
                      PEMASUKAN
                    </td>
                  </tr>
                  {data.income.map((row) => (
                    <MatrixRow key={row.category} label={row.category} values={row.monthly} />
                  ))}
                  <tr className="bg-[#0fa76e]/5 border-y border-border">
                    <td className="sticky left-0 z-10 bg-[#0fa76e]/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[#0fa76e]">
                      Total Pemasukan
                    </td>
                    {incomeMonthlyTotals.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right text-[11px] font-bold tabular-nums text-[#0fa76e]">
                        {compactRupiah(v)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[#0fa76e]">
                      {formatRupiah(totalIncomeYear)}
                    </td>
                  </tr>
                </>
              )}

              {data.expense.length > 0 && (
                <>
                  <tr className="bg-destructive/5 border-b border-border">
                    <td colSpan={14} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-destructive">
                      PENGELUARAN
                    </td>
                  </tr>
                  {data.expense.map((row) => (
                    <MatrixRow key={row.category} label={row.category} values={row.monthly} />
                  ))}
                  <tr className="bg-destructive/5 border-y border-border">
                    <td className="sticky left-0 z-10 bg-destructive/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-destructive">
                      Total Pengeluaran
                    </td>
                    {expenseMonthlyTotals.map((v, i) => (
                      <td key={i} className="px-2 py-2 text-right text-[11px] font-bold tabular-nums text-destructive">
                        {compactRupiah(v)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-destructive">
                      {formatRupiah(totalExpenseYear)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>

            <tfoot>
              <tr className={cn(netYear >= 0 ? "bg-[#0fa76e]/10" : "bg-destructive/10")}>
                <td className={cn(
                  "sticky left-0 z-10 px-3 py-3 text-[11px] font-bold uppercase tracking-wider",
                  netYear >= 0 ? "bg-[#0fa76e]/10 text-[#0fa76e]" : "bg-destructive/10 text-destructive"
                )}>
                  NET
                </td>
                {netMonthly.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-2 py-3 text-right text-[11px] font-bold tabular-nums",
                      v === 0 ? "text-muted-foreground" : v >= 0 ? "text-[#0fa76e]" : "text-destructive",
                    )}
                  >
                    {compactRupiah(v)}
                  </td>
                ))}
                <td className={cn(
                  "px-3 py-3 text-right text-sm font-bold tabular-nums",
                  netYear >= 0 ? "text-[#0fa76e]" : "text-destructive"
                )}>
                  {formatRupiah(netYear)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Nominal per bulan ditampilkan dalam format ringkas (rb / jt). Total kolom paling kanan menampilkan nilai penuh dalam Rupiah.
        </p>
      </section>
    </>
  );
}

function MatrixRow({ label, values }: { label: string; values: number[] }) {
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/10">
      <td className="sticky left-0 z-10 bg-card px-3 py-2 text-sm font-medium text-foreground">
        {label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-2 py-2 text-right text-xs tabular-nums text-muted-foreground">
          {compactRupiah(v)}
        </td>
      ))}
      <td className="px-3 py-2 text-right text-sm font-semibold tabular-nums text-foreground">
        {formatRupiah(total)}
      </td>
    </tr>
  );
}
