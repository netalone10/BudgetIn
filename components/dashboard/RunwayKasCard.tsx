"use client";

import { ShieldCheck, ShieldAlert, Clock, Infinity as InfinityIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactIDR } from "@/lib/format";
import { SectionCard } from "@/components/dashboard/SectionCard";

export interface RunwayKasCardProps {
  /** Months of runway. Use Number.POSITIVE_INFINITY when burn is zero. */
  months: number;
  /** Total liquid (asset-classified) balance in IDR. */
  liquid: number;
  /** Average monthly burn (expense) used for the calculation. */
  avgBurn: number;
  className?: string;
}

type Tone = "safe" | "caution" | "danger" | "infinite" | "empty";

function classifyTone(months: number, liquid: number, avgBurn: number): Tone {
  if (liquid <= 0 && avgBurn <= 0) return "empty";
  if (!Number.isFinite(months)) return "infinite";
  if (months >= 6) return "safe";
  if (months >= 3) return "caution";
  return "danger";
}

const TONE_STYLES: Record<
  Tone,
  {
    accent: string;
    valueText: string;
    badgeBorder: string;
    badgeBg: string;
    badgeText: string;
    icon: React.ReactNode;
    statusLabel: string;
  }
> = {
  safe: {
    accent: "before:bg-emerald-500",
    valueText: "text-emerald-600 dark:text-emerald-400",
    badgeBorder: "border-emerald-500/25",
    badgeBg: "bg-emerald-500/8",
    badgeText: "text-emerald-700 dark:text-emerald-400",
    icon: <ShieldCheck className="size-3" />,
    statusLabel: "Aman",
  },
  caution: {
    accent: "before:bg-amber-500",
    valueText: "text-amber-600 dark:text-amber-400",
    badgeBorder: "border-amber-500/25",
    badgeBg: "bg-amber-500/8",
    badgeText: "text-amber-700 dark:text-amber-400",
    icon: <Clock className="size-3" />,
    statusLabel: "Waspada",
  },
  danger: {
    accent: "before:bg-destructive",
    valueText: "text-destructive",
    badgeBorder: "border-destructive/25",
    badgeBg: "bg-destructive/8",
    badgeText: "text-destructive",
    icon: <ShieldAlert className="size-3" />,
    statusLabel: "Bahaya",
  },
  infinite: {
    accent: "before:bg-emerald-500",
    valueText: "text-emerald-600 dark:text-emerald-400",
    badgeBorder: "border-emerald-500/25",
    badgeBg: "bg-emerald-500/8",
    badgeText: "text-emerald-700 dark:text-emerald-400",
    icon: <InfinityIcon className="size-3" />,
    statusLabel: "Tak terbatas",
  },
  empty: {
    accent: "before:bg-muted-foreground/40",
    valueText: "text-muted-foreground",
    badgeBorder: "border-border/70",
    badgeBg: "bg-muted/40",
    badgeText: "text-muted-foreground",
    icon: <Clock className="size-3" />,
    statusLabel: "Belum ada data",
  },
};

function formatMonths(months: number): string {
  if (!Number.isFinite(months)) return "∞";
  if (months >= 99.95) return "99+";
  return months.toFixed(1);
}

export default function RunwayKasCard({
  months,
  liquid,
  avgBurn,
  className,
}: RunwayKasCardProps) {
  const tone = classifyTone(months, liquid, avgBurn);
  const styles = TONE_STYLES[tone];

  const headlineSuffix =
    tone === "empty"
      ? ""
      : tone === "infinite"
        ? " bln"
        : " bln";

  const subtitle =
    tone === "empty"
      ? "Tambah akun & catat pengeluaran"
      : tone === "infinite"
        ? "Belum ada pengeluaran 2 bulan terakhir"
        : "Berdasar rata-rata harian (proyeksi 30 hari)";

  const helperLine =
    tone === "empty"
      ? null
      : tone === "infinite"
        ? `Likuid ${formatCompactIDR(liquid)}`
        : `Likuid ${formatCompactIDR(liquid)} · Burn ${formatCompactIDR(avgBurn)}/bln`;

  const heroLabel =
    tone === "empty"
      ? "—"
      : tone === "infinite"
        ? "Cukup ∞"
        : `Cukup ${formatMonths(months)}${headlineSuffix}`;

  return (
    <SectionCard eyebrow="Likuiditas" title="Runway Kas" dense className={className}>
      <div
        className={cn(
          "relative overflow-hidden rounded-[20px] border border-border/70 bg-card p-3.5",
          "before:absolute before:left-0 before:right-0 before:top-0 before:h-[3px] before:rounded-t-[20px] before:content-['']",
          styles.accent
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="label-mono text-muted-foreground">Tanpa pemasukan</p>
            <p
              className={cn(
                "mt-1 truncate text-[20px] font-bold tracking-tight md:text-[22px]",
                styles.valueText
              )}
            >
              {heroLabel}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
              styles.badgeBorder,
              styles.badgeBg,
              styles.badgeText
            )}
          >
            {styles.icon}
            {styles.statusLabel}
          </span>
        </div>

        <p className="mt-1.5 text-[11.5px] font-medium text-muted-foreground">
          {subtitle}
        </p>

        {helperLine && (
          <p className="mt-2 truncate text-[11px] text-muted-foreground/90">
            {helperLine}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
