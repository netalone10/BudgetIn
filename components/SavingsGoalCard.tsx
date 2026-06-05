"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useIsDemo } from "@/lib/hooks/use-is-demo";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ContributeModal from "@/components/ContributeModal";
import EditGoalModal from "@/components/EditGoalModal";

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

interface NewContribution {
  id: string;
  transactionId: string;
  amount: number;
  date: string;
  note: string;
}

interface UpdatedGoal {
  id: string;
  name: string;
  targetAmount: number;
  deadline?: string | null;
  createdAt: string;
}

interface Props {
  goal: SavingsGoalWithProgress;
  onDelete: (goalId: string) => void;
  onContribute: (goalId: string, contribution: NewContribution) => void;
  onEdit: (goalId: string, goal: UpdatedGoal) => void;
  onUnlink: (goalId: string, transactionId: string, amount: number) => void;
}

const ID_NUMBER_FORMAT = new Intl.NumberFormat("id-ID");

function formatRupiah(amount: number) {
  return ID_NUMBER_FORMAT.format(amount);
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

export default function SavingsGoalCard({ goal, onDelete, onContribute, onEdit, onUnlink }: Props) {
  const isDemo = useIsDemo();
  const [expanded, setExpanded] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const achieved = goal.totalContributed >= goal.targetAmount;
  const progressValue = Math.min(100, Math.round((goal.totalContributed / goal.targetAmount) * 100));
  const deadlineInfo = getDeadlineInfo(goal.deadline, achieved);

  function handleDelete() {
    if (!confirm("Hapus goal ini?")) return;
    onDelete(goal.id);
  }

  async function handleUnlink(transactionId: string, amount: number) {
    if (!confirm("Lepas kontribusi ini dari goal? Transaksinya tetap ada dan kembali ke daftar belum dialokasikan.")) return;
    setUnlinkingId(transactionId);
    try {
      const res = await fetch(`/api/savings/${goal.id}/contributions/${transactionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Gagal melepas kontribusi.");
        return;
      }
      onUnlink(goal.id, transactionId, amount);
    } catch {
      alert("Gagal melepas kontribusi. Coba lagi.");
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="min-w-0 truncate">{goal.name}</CardTitle>
        <CardAction className="col-start-1 row-start-auto justify-self-start sm:col-start-2 sm:row-start-1 sm:justify-self-end">
          <div className="flex flex-wrap items-center gap-1">
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
            {!isDemo && (
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="hover:text-primary"
                  onClick={() => setShowContributeModal(true)}
                  aria-label="Tambah kontribusi"
                >
                  <Plus />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="hover:text-primary"
                  onClick={() => setShowEditModal(true)}
                  aria-label="Edit goal"
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="hover:text-destructive"
                  onClick={handleDelete}
                  aria-label="Hapus goal"
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Progress bar */}
        <Progress value={progressValue} />

        {/* Nominal */}
        <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="break-words text-muted-foreground">
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
                    className="flex flex-col gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-muted-foreground">{formatDate(c.date)}</span>
                      {c.note && <span className="truncate text-foreground">{c.note}</span>}
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="break-words font-medium tabular-nums text-green-600 dark:text-green-400">
                        +Rp {formatRupiah(c.amount)}
                      </span>
                      {!isDemo && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="size-6 shrink-0 hover:text-destructive"
                          onClick={() => handleUnlink(c.id, c.amount)}
                          disabled={unlinkingId === c.id}
                          aria-label="Lepas kontribusi dari goal"
                          title="Lepas dari goal"
                        >
                          <X className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>

    {showContributeModal && (
      <ContributeModal
        goalId={goal.id}
        goalName={goal.name}
        onClose={() => setShowContributeModal(false)}
        onSaved={(contribution) => {
          onContribute(goal.id, contribution);
          setExpanded(true);
        }}
      />
    )}

    {showEditModal && (
      <EditGoalModal
        goalId={goal.id}
        initialName={goal.name}
        initialTargetAmount={goal.targetAmount}
        initialDeadline={goal.deadline}
        onClose={() => setShowEditModal(false)}
        onSaved={(updated) => onEdit(goal.id, updated)}
      />
    )}
    </>
  );
}
