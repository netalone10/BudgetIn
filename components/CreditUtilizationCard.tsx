"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, AlertTriangle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIDR, formatCompactIDR } from "@/lib/format";
import { useDataEvent } from "@/lib/data-events";

interface CreditUtilizationData {
  accountId: string;
  accountName: string;
  creditLimit: number | null;
  currentBalance: number;
  availableCredit: number | null;
  utilizationPercent: number | null;
  warning: "none" | "approaching" | "over_limit";
  billingCycleDay: number | null;
  tanggalJatuhTempo: number | null;
  tanggalSettlement: number | null;
}

interface Props {
  accountId: string;
  refreshTrigger?: number;
  onEditLimit?: () => void;
}

export default function CreditUtilizationCard({
  accountId,
  refreshTrigger = 0,
  onEditLimit,
}: Props) {
  const [data, setData] = useState<CreditUtilizationData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (noStore = false) => {
      setLoading(true);
      fetch(
        `/api/accounts/${accountId}/credit-utilization`,
        noStore ? { cache: "no-store" } : undefined
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    },
    [accountId]
  );

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [refreshTrigger, load]);

  useDataEvent(["transactions", "accounts"], () => load(true));

  if (loading) {
    return (
      <div className="relative animate-pulse overflow-hidden rounded-[20px] border border-border/70 bg-card p-6 shadow-sm before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[20px] before:bg-primary before:content-['']">
        <div className="mb-2 h-3 w-32 rounded bg-muted" />
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="mt-4 h-3 w-full rounded-full bg-muted" />
        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="h-14 rounded-2xl bg-muted/50" />
          <div className="h-14 rounded-2xl bg-muted/50" />
          <div className="h-14 rounded-2xl bg-muted/50" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const limit = data.creditLimit;
  const balance = data.currentBalance;
  const available = data.availableCredit;
  const pct = data.utilizationPercent;

  const warningColor =
    data.warning === "over_limit"
      ? "destructive"
      : data.warning === "approaching"
        ? "amber"
        : "emerald";

  const progressColor =
    warningColor === "destructive"
      ? "bg-red-500"
      : warningColor === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";

  const progressTrackColor =
    warningColor === "destructive"
      ? "bg-red-500/15"
      : warningColor === "amber"
        ? "bg-amber-500/15"
        : "bg-emerald-500/15";

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-border/70 bg-card p-6 shadow-sm before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[20px] before:bg-primary before:content-['']">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          <p className="label-mono text-muted-foreground">Kartu Kredit</p>
        </div>
        {onEditLimit && (
          <button
            onClick={onEditLimit}
            className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
          >
            <Settings className="size-3" />
            Edit Limit
          </button>
        )}
      </div>

      {/* Account name */}
      <p className="mt-1 text-sm font-medium text-foreground truncate">
        {data.accountName}
      </p>

      {/* Limit display */}
      <p className="mt-1 truncate text-[18px] font-bold tracking-tight md:text-[22px] text-foreground">
        {limit !== null ? formatIDR(limit) : "Limit belum diatur"}
      </p>

      {/* Warning badge */}
      {data.warning !== "none" && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
            data.warning === "over_limit"
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          )}
        >
          <AlertTriangle className="size-3" />
          {data.warning === "over_limit"
            ? `Penggunaan ${pct}% — melebihi limit!`
            : `Penggunaan ${pct}% — mendekati limit`}
        </div>
      )}

      {/* Progress bar */}
      {pct !== null && (
        <div className="mt-3">
          <div
            className={cn(
              "h-2.5 w-full rounded-full",
              progressTrackColor
            )}
          >
            <div
              className={cn("h-2.5 rounded-full transition-all", progressColor)}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/50 px-4 py-3">
          <span className="font-medium text-foreground">Limit</span>
          <p className="mt-1 text-base font-semibold text-foreground">
            {limit !== null ? formatCompactIDR(limit) : "-"}
          </p>
        </div>
        <div className="rounded-2xl bg-muted/50 px-4 py-3">
          <span className="font-medium text-red-500">Terpakai</span>
          <p className="mt-1 text-base font-semibold text-foreground">
            {formatCompactIDR(balance)}
          </p>
        </div>
        <div className="rounded-2xl bg-muted/50 px-4 py-3">
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            Tersedia
          </span>
          <p className="mt-1 text-base font-semibold text-foreground">
            {available !== null ? formatCompactIDR(available) : "-"}
          </p>
        </div>
      </div>

      {/* Billing info */}
      <div className="mt-4 flex flex-wrap gap-4 text-[11.5px] text-muted-foreground">
        {data.tanggalSettlement && (
          <span>
            Settlement: <strong className="text-foreground">tgl {data.tanggalSettlement}</strong>
          </span>
        )}
        {data.tanggalJatuhTempo && (
          <span>
            Jatuh tempo: <strong className="text-foreground">tgl {data.tanggalJatuhTempo}</strong>
          </span>
        )}
        {data.billingCycleDay && (
          <span>
            Siklus: <strong className="text-foreground">tgl {data.billingCycleDay}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
