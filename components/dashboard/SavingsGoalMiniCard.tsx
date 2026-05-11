"use client";

import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { formatCompactIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActiveSavingsGoal } from "@/lib/dashboard-data";

export interface SavingsGoalMiniCardProps {
  goal: ActiveSavingsGoal | null;
}

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export default function SavingsGoalMiniCard({ goal }: SavingsGoalMiniCardProps) {
  return (
    <SectionCard
      eyebrow="Target Tabungan"
      title="Progress goals"
      dense
      action={
        <Link
          href="/dashboard/savings"
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          Semua →
        </Link>
      }
    >
      {!goal ? (
        <EmptyGoal />
      ) : (
        <GoalContent goal={goal} />
      )}
      <Link
        href="/dashboard/savings"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/40 bg-primary/8 px-3 py-2 text-[12.5px] font-semibold text-primary transition-opacity hover:opacity-80"
      >
        <Plus className="size-3.5" />
        Tambah target baru
      </Link>
    </SectionCard>
  );
}

function GoalContent({ goal }: { goal: ActiveSavingsGoal }) {
  const pct = goal.targetAmount > 0
    ? Math.min(100, (goal.totalContributed / goal.targetAmount) * 100)
    : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.totalContributed);
  const dash = (pct / 100) * RING_CIRCUMFERENCE;
  const gap = RING_CIRCUMFERENCE - dash;

  const monthsLeft = (() => {
    if (!goal.deadline) return null;
    const now = new Date();
    const deadline = new Date(goal.deadline);
    const months = Math.max(
      0,
      (deadline.getFullYear() - now.getFullYear()) * 12 +
        (deadline.getMonth() - now.getMonth())
    );
    return months;
  })();

  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0">
        <svg width="86" height="86" viewBox="0 0 86 86">
          <circle
            cx="43"
            cy="43"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            className="text-primary/15"
          />
          <circle
            cx="43"
            cy="43"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform="rotate(-90 43 43)"
            className="text-primary transition-[stroke-dasharray] duration-700"
          />
          <text
            x="43"
            y="40"
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            className="fill-foreground"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            {pct.toFixed(1).replace(".0", "")}%
          </text>
          <text
            x="43"
            y="54"
            textAnchor="middle"
            fontSize="9.5"
            className="fill-muted-foreground"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            tercapai
          </text>
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold tracking-tight text-foreground">
          {goal.name}
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          <span className="font-semibold text-primary">
            {formatCompactIDR(goal.totalContributed)}
          </span>{" "}
          / {formatCompactIDR(goal.targetAmount)}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[11.5px] text-muted-foreground">
          <span>
            Sisa: <strong className="font-semibold text-foreground/80">{formatCompactIDR(remaining)}</strong>
          </span>
          {monthsLeft !== null && (
            <span>
              ~<strong className="font-semibold text-foreground/80">{monthsLeft} bulan</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyGoal() {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-background/60 p-5 text-center")}>
      <Sparkles className="size-5 text-primary" />
      <p className="text-[13px] font-medium text-foreground">
        Belum ada target tabungan
      </p>
      <p className="text-[11.5px] text-muted-foreground">
        Tetapkan target untuk dana darurat, nikah, atau impian lain.
      </p>
    </div>
  );
}
