"use client";

import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactIDR } from "@/lib/format";

/**
 * Upcoming Bills Card — shows recurring payments due within 7 days.
 * Helps user prepare cashflow before bills hit.
 */

interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  nextDueDate: string;
  category?: { name: string } | null;
  account?: { name: string } | null;
  type: string;
}

interface Props {
  recurring: RecurringItem[];
  className?: string;
}

const WINDOW_DAYS = 7;

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function countdownLabel(days: number): string {
  if (days < 0) return "Terlambat";
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  return `${days} hari lagi`;
}

function countdownColor(days: number): string {
  if (days < 0) return "bg-red-500/15 text-red-600 dark:text-red-400";
  if (days <= 1) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (days <= 3) return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
  return "bg-muted text-muted-foreground";
}

export default function UpcomingBillsCard({ recurring, className }: Props) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming = recurring
    .filter((r) => {
      const days = daysUntil(r.nextDueDate);
      return days >= 0 && days <= WINDOW_DAYS;
    })
    .sort((a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime())
    .slice(0, 5);

  return (
    <div
      className={cn(
        "rounded-[24px] border border-border/70 bg-card/90 p-4 shadow-sm sm:rounded-[30px] md:p-5",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 text-orange-500" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Tagihan Mendatang
        </p>
      </div>

      {upcoming.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">
          Tidak ada tagihan dalam {WINDOW_DAYS} hari ke depan.
        </p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((item) => {
            const days = daysUntil(item.nextDueDate);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.category?.name ?? item.type}
                    {item.account?.name ? ` · ${item.account.name}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatCompactIDR(item.amount)}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
                      countdownColor(days)
                    )}
                  >
                    {countdownLabel(days)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
