"use client";

import { format, startOfDay, differenceInCalendarDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CheckCircle2, Clock, AlertTriangle, CalendarClock, MoreHorizontal, CreditCard, Pencil, Trash2, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

export type BillStatus = "paid" | "due-today" | "overdue" | "due-soon" | "upcoming";

export interface BillWithMeta {
  id: string;
  name: string;
  amount: string;
  dueDay: number;
  nextDueDate: string;
  lastPaidAt: string | null;
  isActive: boolean;
  autoRecord: boolean;
  reminderDays: number[];
  note: string | null;
  category: { id: string; name: string } | null;
  account: { id: string; name: string } | null;
  payments: { id: string; paidAt: string; amount: string; paymentMonth: string }[];
}

export function getBillStatus(bill: BillWithMeta): BillStatus {
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(bill.nextDueDate));
  const currentMonth = format(today, "yyyy-MM");
  const paid = bill.payments.some((p) => p.paymentMonth === currentMonth);
  if (paid) return "paid";
  const diff = differenceInCalendarDays(due, today);
  if (diff < 0) return "overdue";
  if (diff === 0) return "due-today";
  if (diff <= 7) return "due-soon";
  return "upcoming";
}

interface BillCardProps {
  bill: BillWithMeta;
  onPay: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function BillCard({ bill, onPay, onSkip, onEdit, onDelete }: BillCardProps) {
  const status = getBillStatus(bill);
  const amount = parseFloat(bill.amount);
  const dueDate = new Date(bill.nextDueDate);

  const statusConfig = {
    paid: {
      badge: "Lunas",
      badgeClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      border: "border-l-emerald-400",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    },
    "due-today": {
      badge: "Jatuh Tempo Hari Ini",
      badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      border: "border-l-red-500",
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
    },
    overdue: {
      badge: "Terlambat",
      badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      border: "border-l-red-500",
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
    },
    "due-soon": {
      badge: `H-${differenceInCalendarDays(startOfDay(dueDate), startOfDay(new Date()))}`,
      badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      border: "border-l-amber-400",
      icon: <Clock className="h-4 w-4 text-amber-500" />,
    },
    upcoming: {
      badge: format(dueDate, "d MMM", { locale: idLocale }),
      badgeClass: "bg-muted text-muted-foreground",
      border: "border-l-border",
      icon: <CalendarClock className="h-4 w-4 text-muted-foreground" />,
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className={cn(
      "bg-card border border-border rounded-xl p-4 border-l-4 transition-shadow hover:shadow-md",
      cfg.border
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 shrink-0">{cfg.icon}</div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{bill.name}</p>
            <p className="text-sm text-muted-foreground">
              Rp {amount.toLocaleString("id-ID")}
              {bill.category && (
                <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">{bill.category.name}</span>
              )}
            </p>
            {bill.account && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> {bill.account.name}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", cfg.badgeClass)}>
            {cfg.badge}
          </span>
          <div className="flex items-center gap-1">
            {status !== "paid" && (
              <>
                <button
                  onClick={onPay}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-lg font-medium transition-colors",
                    status === "due-today" || status === "overdue"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  )}
                >
                  Bayar
                </button>
                <button
                  onClick={onSkip}
                  className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Lewati bulan ini"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              onClick={onEdit}
              className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Hapus"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {bill.note && (
        <p className="mt-2 text-xs text-muted-foreground pl-7 border-t border-border/50 pt-2">{bill.note}</p>
      )}
    </div>
  );
}
