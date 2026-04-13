"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Contribution {
  id: string;
  date: string;
  amount: number;
  note: string;
}

interface SavingsGoalWithProgress {
  id: string;
  name: string;
  targetAmount: number;
  deadline?: string | null;
  createdAt: string;
  totalContributed: number;
  contributions: Contribution[];
}

interface Props {
  goal: SavingsGoalWithProgress;
  onDelete: (goalId: string) => void;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID").format(amount);
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function getDeadlineInfo(
  deadline: string | null | undefined,
  achieved: boolean
): { label: string; variant: "achieved" | "late" | "remaining" } | null {
  if (!deadline) return null;
  if (achieved) return { label: "Tercapai", variant: "achieved" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  if (deadlineDate < today) {
    return { label: "Terlambat", variant: "late" };
  }

  const diffMs = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return { label: `${diffDays} hari lagi`, variant: "remaining" };
}

export default function SavingsGoalCard({ goal, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);

  const achieved = goal.totalContributed >= goal.targetAmount;
  const progressValue = Math.min(100, Math.round((goal.totalContributed / goal.targetAmount) * 100));
  const deadlineInfo = getDeadlineInfo(goal.deadline, achieved);

  function handleDelete() {
    if (!confirm("Hapus goal ini?")) return;
    onDelete(goal.id);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{goal.name}</CardTitle>
        <CardAction>
          <div className="flex items-center gap-1">
            {achieved && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Tercapai
              </span>
            )}
            {!achieved && deadlineInfo?.variant === "late" && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                Terlambat
              </span>
            )}
            {!achieved && deadlineInfo?.variant === "remaining" && (
              <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                {deadlineInfo.label}
              </span>
            )}
            <Button
              size="icon-sm"
              variant="ghost"
              className="hover:text-destructive"
              onClick={handleDelete}
              aria-label="Hapus goal"
            >
              <Trash2 />
            </Button>
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Progress bar */}
        <Progress value={progressValue} />

        {/* Nominal */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Rp {formatRupiah(goal.totalContributed)} / Rp {formatRupiah(goal.targetAmount)}
          </span>
          <span className="font-medium tabular-nums">{progressValue}%</span>
        </div>

        {/* Expand/collapse contribution history */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between px-0 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            <span>Riwayat kontribusi ({goal.contributions.length})</span>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>

          {expanded && (
            <div className="mt-2 flex flex-col gap-1.5">
              {goal.contributions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Belum ada kontribusi.</p>
              ) : (
                goal.contributions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground">{formatDate(c.date)}</span>
                      {c.note && <span className="text-foreground">{c.note}</span>}
                    </div>
                    <span className="font-medium tabular-nums text-green-600 dark:text-green-400">
                      +Rp {formatRupiah(c.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
