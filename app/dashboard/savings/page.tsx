"use client";

import { useState, useEffect, useRef } from "react";
import { PiggyBank, Loader2, AlertCircle, Inbox, History, CheckCircle2, Clock } from "lucide-react";
import { useIsDemo } from "@/lib/hooks/use-is-demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SavingsGoalCard from "@/components/SavingsGoalCard";
import UnallocatedSavings from "@/components/UnallocatedSavings";
import SavingsMigrationBanner from "@/components/SavingsMigrationBanner";
import { cn } from "@/lib/utils";

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

export default function SavingsPage() {
  const isDemo = useIsDemo();
  const unallocatedRef = useRef<HTMLDivElement>(null);
  const [goals, setGoals] = useState<SavingsGoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [nameError, setNameError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bumped to force UnallocatedSavings to refetch (e.g. after unlinking a contribution)
  const [unallocatedKey, setUnallocatedKey] = useState(0);

  // History semua transaksi tabungan (allocated + unallocated)
  interface HistoryTx {
    id: string;
    date: string;
    amount: number;
    category: string;
    note: string;
    goalId: string | null;
    goalName: string | null;
  }
  const [history, setHistory] = useState<HistoryTx[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/savings/history", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setHistory(data.transactions ?? []);
    } catch {
      // silent fail
    } finally {
      setHistoryLoading(false);
    }
  }

  async function fetchGoals() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/savings", { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal memuat data");
      const data = await res.json();
      setGoals(data.goals ?? []);
    } catch {
      setError("Gagal memuat goals. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      fetchGoals();
      if (!isDemo) fetchHistory();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function validateForm(): boolean {
    let valid = true;
    setNameError("");
    setAmountError("");

    if (!name.trim()) {
      setNameError("Nama goal wajib diisi");
      valid = false;
    }

    const amount = parseFloat(targetAmount);
    if (!targetAmount || isNaN(amount) || amount <= 0) {
      setAmountError("Target amount harus lebih dari 0");
      valid = false;
    }

    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const body: { name: string; targetAmount: number; deadline?: string } = {
        name: name.trim(),
        targetAmount: parseFloat(targetAmount),
      };
      if (deadline) body.deadline = deadline;

      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Gagal membuat goal");
      }

      const data = await res.json();
      const newGoal: SavingsGoalWithProgress = {
        ...data.goal,
        totalContributed: 0,
        contributions: [],
      };
      setGoals((prev) => [newGoal, ...prev]);
      setName("");
      setTargetAmount("");
      setDeadline("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal membuat goal");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(goalId: string) {
    try {
      const res = await fetch(`/api/savings/${goalId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Gagal menghapus goal");
      }
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal menghapus goal");
    }
  }

  function handleContribute(
    goalId: string,
    contribution: { id: string; transactionId: string; amount: number; date: string; note: string }
  ) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          totalContributed: g.totalContributed + contribution.amount,
          contributions: [
            { id: contribution.transactionId, date: contribution.date, amount: contribution.amount, note: contribution.note },
            ...g.contributions,
          ],
        };
      })
    );
  }

  function handleEdit(
    goalId: string,
    updated: { id: string; name: string; targetAmount: number; deadline?: string | null; createdAt: string }
  ) {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, name: updated.name, targetAmount: updated.targetAmount, deadline: updated.deadline }
          : g
      )
    );
  }

  function handleUnlink(goalId: string, transactionId: string, amount: number) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          totalContributed: g.totalContributed - amount,
          contributions: g.contributions.filter((c) => c.id !== transactionId),
        };
      })
    );
    // Unlinked transaction returns to the unallocated pool — refetch that list
    setUnallocatedKey((k) => k + 1);
  }

  // Called when an unallocated tx is linked to a goal
  function handleAllocated(
    goalId: string,
    transactionId: string,
    amount: number,
    date: string,
    note: string
  ) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          totalContributed: g.totalContributed + amount,
          contributions: [
            { id: transactionId, date, amount, note },
            ...g.contributions,
          ],
        };
      })
    );
    // Refresh history supaya status transaksi ter-update
    fetchHistory();
  }

  const goalSummaries = goals.map((g) => ({ id: g.id, name: g.name }));

  return (
    <div className="flex min-w-0 flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-2 mt-4 md:mt-2">
          <PiggyBank className="size-7 text-primary" />
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Tabungan</h2>
        </div>

        {/* Migration Banner — tampil kalau ada transaksi tabungan lama belum dialokasikan */}
        {!isDemo && (
          <SavingsMigrationBanner
            targetRef={unallocatedRef}
            refreshKey={unallocatedKey}
            totalHistory={history.length}
          />
        )}

        {/* Create Goal Form */}
        {!isDemo && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Buat Goal Baru</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Input
                  type="text"
                  placeholder="Nama goal (contoh: Dana Darurat)"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(""); }}
                  disabled={submitting}
                  aria-invalid={!!nameError}
                />
                {nameError && <p className="text-xs text-destructive">{nameError}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <Input
                  type="number"
                  placeholder="Target amount (Rp)"
                  value={targetAmount}
                  onChange={(e) => { setTargetAmount(e.target.value); setAmountError(""); }}
                  disabled={submitting}
                  min={1}
                  aria-invalid={!!amountError}
                />
                {amountError && <p className="text-xs text-destructive">{amountError}</p>}
              </div>

              <div>
                <Input
                  type="date"
                  placeholder="Deadline (opsional)"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Menyimpan…
                  </>
                ) : (
                  "Buat Goal"
                )}
              </Button>
            </form>
          </div>
        )}

        {/* Goals List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchGoals}>
              Coba Lagi
            </Button>
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center shadow-sm">
            <PiggyBank className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada savings goal. Buat goal pertamamu di atas!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {goals.map((goal) => (
              <SavingsGoalCard
                key={goal.id}
                goal={goal}
                onDelete={handleDelete}
                onContribute={handleContribute}
                onEdit={handleEdit}
                onUnlink={handleUnlink}
              />
            ))}
          </div>
        )}

        {/* Unallocated savings — only show for non-demo, non-loading, non-error state */}
        {!isDemo && !loading && !error && (
          <div ref={unallocatedRef} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Inbox className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Belum Dialokasikan</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Transaksi tabungan yang belum terhubung ke goal manapun.
            </p>
            <UnallocatedSavings
              key={unallocatedKey}
              goals={goalSummaries}
              onAllocated={handleAllocated}
            />
          </div>
        )}

        {/* Riwayat Transaksi Tabungan */}
        {!isDemo && !loading && !error && (
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex w-full items-center justify-between gap-3 p-5 text-left"
            >
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Riwayat Transaksi Tabungan</h3>
                {history.length > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {history.length}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">{showHistory ? "Tutup ▲" : "Lihat semua ▼"}</span>
            </button>

            {showHistory && (
              <div className="border-t border-border px-5 pb-5">
                {historyLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Belum ada riwayat transaksi tabungan.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60 pt-1">
                    {history.map((tx) => (
                      <div key={tx.id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums">
                              Rp {new Intl.NumberFormat("id-ID").format(tx.amount)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(tx.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {tx.category}
                            </span>
                            {tx.note && (
                              <span className="truncate text-xs text-muted-foreground">{tx.note}</span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          {tx.goalId ? (
                            <span className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                              "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                            )}>
                              <CheckCircle2 className="size-3" />
                              {tx.goalName}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                              <Clock className="size-3" />
                              Belum dialokasikan
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
