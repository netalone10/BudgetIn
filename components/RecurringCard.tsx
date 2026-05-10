"use client";

import { format, startOfDay, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  CheckCircle2, Clock, AlertTriangle, CalendarClock,
  CreditCard, Pencil, Trash2, SkipForward,
  ArrowDownLeft, ArrowUpRight, ArrowLeftRight, PiggyBank,
} from "lucide-react";
import { useIsDemo } from "@/lib/hooks/use-is-demo";
import { cn } from "@/lib/utils";
import { describeFrequency, type RecurringFrequency, type RecurringType } from "@/utils/recurring-utils";

export type RecurringStatus = "ran" | "due-today" | "overdue" | "due-soon" | "upcoming";

export interface RecurringWithMeta {
  id: string;
  name: string;
  type: RecurringType;
  amount: string;
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  endDate: string | null;
  nextDueDate: string;
  lastRunAt: string | null;
  isActive: boolean;
  autoRecord: boolean;
  reminderDays: number[];
  note: string | null;
  category: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  toAccount: { id: string; name: string } | null;
  savingsGoal: { id: string; name: string } | null;
  occurrences: { id: string; occurredAt: string; amount: string; occurrenceKey: string }[];
}

export function getRecurringStatus(item: RecurringWithMeta): RecurringStatus {
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(item.nextDueDate));
  // Check if there's an occurrence whose key matches the *current* nextDueDate slot
  // (we treat it as ran if we have any occurrence with key >= today's yyyy-MM-dd or matching due date).
  const dueKey = format(due, "yyyy-MM-dd");
  const ran = item.occurrences.some((o) => o.occurrenceKey === dueKey);
  if (ran) return "ran";
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due-today";
  if (diff <= 7) return "due-soon";
  return "upcoming";
}

const TYPE_META: Record<RecurringType, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  expense:  { label: "Pengeluaran", icon: ArrowUpRight,    color: "text-red-500" },
  income:   { label: "Pemasukan",   icon: ArrowDownLeft,   color: "text-emerald-500" },
  transfer: { label: "Transfer",    icon: ArrowLeftRight,  color: "text-sky-500" },
};

interface RecurringCardProps {
  item: RecurringWithMeta;
  onRun: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function RecurringCard({ item, onRun, onSkip, onEdit, onDelete }: RecurringCardProps) {
  const isDemo = useIsDemo();
  const status = getRecurringStatus(item);
  const amount = parseFloat(item.amount);
  const dueDate = new Date(item.nextDueDate);
  const typeMeta = TYPE_META[item.type] ?? TYPE_META.expense;
  const TypeIcon = typeMeta.icon;

  const statusConfig = {
    ran: {
      badge: "Sudah Dijalankan",
      badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      border: "border-l-emerald-400",
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
    },
    "due-today": {
      badge: "Jatuh Tempo Hari Ini",
      badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      border: "border-l-red-500",
      icon: <AlertTriangle className="size-4 text-red-500" />,
    },
    overdue: {
      badge: "Terlambat",
      badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      border: "border-l-red-500",
      icon: <AlertTriangle className="size-4 text-red-500" />,
    },
    "due-soon": {
      badge: `H-${differenceInCalendarDays(startOfDay(dueDate), startOfDay(new Date()))}`,
      badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      border: "border-l-amber-400",
      icon: <Clock className="size-4 text-amber-500" />,
    },
    upcoming: {
      badge: format(dueDate, "d MMM", { locale: idLocale }),
      badgeClass: "bg-muted text-muted-foreground",
      border: "border-l-border",
      icon: <CalendarClock className="size-4 text-muted-foreground" />,
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-4 border-l-4 transition-shadow hover:shadow-md",
      cfg.border,
    )}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 shrink-0">{cfg.icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="break-words font-semibold text-foreground">{item.name}</p>
              <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium", typeMeta.color)}>
                <TypeIcon className="size-3" />
                {typeMeta.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Rp {amount.toLocaleString("id-ID")}
              {item.category && (
                <span className="ml-1 inline-block rounded-full bg-muted px-1.5 py-0.5 text-xs">{item.category.name}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {describeFrequency(item.frequency, item.interval)}
            </p>
            {item.account && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <CreditCard className="size-3" />
                {item.type === "transfer" && item.toAccount
                  ? <>{item.account.name} <ArrowLeftRight className="size-3" /> {item.toAccount.name}</>
                  : item.account.name}
              </p>
            )}
            {item.savingsGoal && (
              <p className="text-xs text-pink-500 mt-0.5 flex items-center gap-1">
                <PiggyBank className="size-3" /> {item.savingsGoal.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", cfg.badgeClass)}>
            {cfg.badge}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {status !== "ran" && !isDemo && (
              <>
                <button
                  onClick={onRun}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors",
                    status === "due-today" || status === "overdue"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-foreground hover:bg-muted/80",
                  )}
                >
                  Catat
                </button>
                <button
                  onClick={onSkip}
                  className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Lewati periode ini"
                >
                  <SkipForward className="size-3.5" />
                </button>
              </>
            )}
            {!isDemo && (
              <>
                <button
                  onClick={onEdit}
                  className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Hapus"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {item.note && (
        <p className="mt-2 text-xs text-muted-foreground pl-7 border-t border-border/50 pt-2">{item.note}</p>
      )}
    </div>
  );
}
