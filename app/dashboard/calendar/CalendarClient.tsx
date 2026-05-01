"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarTransaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  type: "income" | "expense" | "transfer_in" | "transfer_out";
  accountName?: string;
}

interface DayData {
  income: number;
  expense: number;
  transactions: CalendarTransaction[];
}

interface CalendarResponse {
  days: Record<string, DayData>;
  summary: {
    totalIncome: number;
    totalExpense: number;
    net: number;
  };
}

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    const v = value / 1_000_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "jt";
  }
  if (value >= 1_000) {
    const v = value / 1_000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + "rb";
  }
  return value.toFixed(0);
}

function typeLabel(type: CalendarTransaction["type"]): string {
  switch (type) {
    case "income": return "Pemasukan";
    case "expense": return "Pengeluaran";
    case "transfer_in": return "Transfer Masuk";
    case "transfer_out": return "Transfer Keluar";
    default: return type;
  }
}

function isIncome(type: CalendarTransaction["type"]): boolean {
  return type === "income";
}

function isTransfer(type: CalendarTransaction["type"]): boolean {
  return type === "transfer_in" || type === "transfer_out";
}

export default function CalendarClient() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calData, setCalData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback((y: number, m: number) => {
    setLoading(true);
    setSelectedDay(null);
    fetch(`/api/transactions/calendar?year=${y}&month=${m}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCalData(d ?? null))
      .catch(() => setCalData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(year, month);
  }, [year, month, load]);

  function prevMonth() {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const todayStr = now.toISOString().slice(0, 10);
  const currentMonthStr = `${year}-${String(month).padStart(2, "0")}`;

  const selectedDayData = selectedDay ? calData?.days[selectedDay] : undefined;

  return (
    <div className="space-y-4">
      {calData && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Total Masuk</div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatIDR(calData.summary.totalIncome)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Total Keluar</div>
              <div className="text-sm font-semibold text-red-500">
                {formatIDR(calData.summary.totalExpense)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Net</div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  calData.summary.net >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500"
                )}
              >
                {calData.summary.net >= 0 ? "+" : ""}
                {formatIDR(calData.summary.net)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Bulan sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">
            {formatMonthYear(year, month)}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Bulan berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              className="text-center text-[10px] font-medium text-muted-foreground py-1"
            >
              {label}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="min-h-[52px] rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[52px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${currentMonthStr}-${String(day).padStart(2, "0")}`;
              const dayData = calData?.days[dateStr];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDay;
              const hasIncome = (dayData?.income ?? 0) > 0;
              const hasExpense = (dayData?.expense ?? 0) > 0;

              return (
                <button
                  key={day}
                  onClick={() =>
                    setSelectedDay((prev) => (prev === dateStr ? null : dateStr))
                  }
                  className={cn(
                    "min-h-[52px] rounded-lg flex flex-col items-center justify-start pt-1.5 pb-1 px-0.5 gap-0.5 transition-colors text-sm font-medium",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <span className="text-[11px] font-semibold leading-none">{day}</span>
                  {hasIncome && (
                    <span
                      className={cn(
                        "text-[9px] leading-tight font-medium truncate w-full text-center",
                        isSelected ? "text-white/90" : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      +{formatCompact(dayData!.income)}
                    </span>
                  )}
                  {hasExpense && (
                    <span
                      className={cn(
                        "text-[9px] leading-tight font-medium truncate w-full text-center",
                        isSelected ? "text-white/80" : "text-red-500"
                      )}
                    >
                      -{formatCompact(dayData!.expense)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">+</span>
            Pemasukan
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="text-red-500 font-semibold">-</span>
            Pengeluaran
          </div>
        </div>
      </div>

      {selectedDay && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {new Date(selectedDay + "T00:00:00").toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              {selectedDayData && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {selectedDayData.expense > 0 && (
                    <span className="text-red-500 font-medium">
                      -{formatIDR(selectedDayData.expense)}
                    </span>
                  )}
                  {selectedDayData.expense > 0 && selectedDayData.income > 0 && (
                    <span className="mx-1">·</span>
                  )}
                  {selectedDayData.income > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      +{formatIDR(selectedDayData.income)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted"
            >
              Tutup
            </button>
          </div>

          {!selectedDayData || selectedDayData.transactions.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              Tidak ada transaksi
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {selectedDayData.transactions.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          isTransfer(tx.type) ? "bg-muted-foreground" : isIncome(tx.type) ? "bg-emerald-500" : "bg-red-500"
                        )}
                      />
                      <span className="text-sm font-medium text-foreground truncate">
                        {tx.category}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 pl-3 flex items-center gap-2">
                      {tx.note && <span className="truncate">{tx.note}</span>}
                      {tx.accountName && (
                        <span className="shrink-0 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                          {tx.accountName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "text-sm font-semibold shrink-0",
                      isTransfer(tx.type)
                        ? "text-muted-foreground"
                        : isIncome(tx.type)
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-500"
                    )}
                  >
                    {isTransfer(tx.type) ? "" : isIncome(tx.type) ? "+" : "-"}
                    {formatIDR(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
