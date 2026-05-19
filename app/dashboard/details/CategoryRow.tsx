"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/format";
import type { CategoryGroup, DetailType } from "@/lib/details-data";

/**
 * Build a stable, DOM-safe id for the transaction-list region rendered when a
 * category row is expanded. Exported so `CategoryGroupList` can wire the same
 * id on its `<div role="region">` and on `aria-controls` here.
 *
 * Categories within a single income/expense list are unique by construction
 * (they're keyed by `tx.category`), so the simple slug is unambiguous in
 * practice. Empty/all-special category names fall back to "uncategorized".
 */
export function getCategoryRegionId(category: string): string {
  const slug = category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `details-tx-${slug || "uncategorized"}`;
}

export interface CategoryRowProps {
  group: CategoryGroup;
  type: DetailType;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Header row for a single category in the details accordion. Click or Enter /
 * Space toggle the expanded state — a native `<button>` provides both behaviors
 * for free and keeps `aria-expanded` / `aria-controls` semantics intact.
 *
 * - Income totals use the semantic green palette used elsewhere in the app
 *   (`text-emerald-600` / `dark:text-emerald-400`).
 * - Expense totals use `text-destructive` (matches `parts.tsx` and
 *   `BudgetStatus`).
 * - Share bar tints with the same semantic color.
 */
export default function CategoryRow({
  group,
  type,
  expanded,
  onToggle,
}: CategoryRowProps) {
  const txListId = getCategoryRegionId(group.category);
  const isIncome = type === "income";
  // Clamp share to [0, 1] defensively before converting to %.
  const sharePct = Math.max(0, Math.min(1, group.share)) * 100;

  const amountClass = isIncome
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-destructive";
  const barClass = isIncome
    ? "bg-emerald-500/80 dark:bg-emerald-400/80"
    : "bg-destructive/80";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-controls={txListId}
      className={cn(
        "group/row flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 text-left",
        "transition-colors hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        expanded && "bg-muted/20",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {group.category}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground",
              )}
              aria-label={`${group.count} transaksi`}
            >
              {group.count}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {sharePct.toFixed(1)}%
            </span>
            <span
              className={cn(
                "text-sm font-semibold tabular-nums",
                amountClass,
              )}
            >
              {formatIDR(group.amount)}
            </span>
          </div>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="presentation"
        >
          <div
            className={cn("h-full rounded-full transition-all", barClass)}
            style={{ width: `${sharePct}%` }}
          />
        </div>
      </div>

      <ChevronDown
        aria-hidden="true"
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
          expanded && "rotate-180",
        )}
      />
    </button>
  );
}
