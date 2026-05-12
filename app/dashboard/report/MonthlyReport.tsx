"use client";

import { ArrowDownCircle, ArrowUpCircle, Calendar, User, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah, monthlyMockReport, sumRows } from "./mock-data";

export default function MonthlyReport() {
  const data = monthlyMockReport;
  const totalIncome = sumRows(data.income);
  const totalExpense = sumRows(data.expense);
  const net = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
  const isPositive = net >= 0;

  return (
    <div className="space-y-6">
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
        <KpiCard
          label="Total Pemasukan"
          value={formatRupiah(totalIncome)}
          tone="positive"
          icon={<ArrowUpCircle className="size-4" />}
        />
        <KpiCard
          label="Total Pengeluaran"
          value={formatRupiah(totalExpense)}
          tone="negative"
          icon={<ArrowDownCircle className="size-4" />}
        />
        <KpiCard
          label={isPositive ? "Surplus" : "Defisit"}
          value={formatRupiah(net)}
          tone={isPositive ? "positive" : "negative"}
          icon={<Wallet className="size-4" />}
        />
        <KpiCard
          label="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          tone={savingsRate >= 20 ? "positive" : savingsRate >= 10 ? "neutral" : "negative"}
        />
      </section>

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
          />

          <CategoryTable
            heading="PENGELUARAN"
            rows={data.expense}
            total={totalExpense}
            tone="negative"
            showPercent
          />

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
                {isPositive ? "Anda mencatat surplus periode ini." : "Pengeluaran melebihi pemasukan."}
              </span>
            </div>
            <span
              className={cn(
                "text-2xl font-bold tabular-nums",
                isPositive ? "text-[#0fa76e]" : "text-destructive",
              )}
            >
              {formatRupiah(net)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function KpiCard({
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

function CategoryTable({
  heading,
  rows,
  total,
  tone,
  showPercent,
}: {
  heading: string;
  rows: { category: string; amount: number }[];
  total: number;
  tone: "positive" | "negative";
  showPercent?: boolean;
}) {
  const toneText = tone === "positive" ? "text-[#0fa76e]" : "text-destructive";
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
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full">
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
              <td className={cn("px-4 py-2.5 text-right text-sm font-bold tabular-nums", toneText)}>
                {formatRupiah(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
