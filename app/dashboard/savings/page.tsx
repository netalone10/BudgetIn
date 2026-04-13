"use client";

import { useState, useEffect } from "react";
import { PiggyBank, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SavingsGoalCard from "@/components/SavingsGoalCard";

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

  async function fetchGoals() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/savings");
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
    fetchGoals();
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

  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 pb-2 mt-4 md:mt-2">
          <PiggyBank className="h-7 w-7 text-primary" />
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">Tabungan</h2>
        </div>

        {/* Create Goal Form */}
        <div className="rounded-2xl border border-border bg-card px-5 py-5 shadow-sm">
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
              {nameError && (
                <p className="text-xs text-destructive">{nameError}</p>
              )}
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
              {amountError && (
                <p className="text-xs text-destructive">{amountError}</p>
              )}
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
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Buat Goal"
              )}
            </Button>
          </form>
        </div>

        {/* Goals List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchGoals}>
              Coba Lagi
            </Button>
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-12 text-center shadow-sm">
            <PiggyBank className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada savings goal. Buat goal pertamamu di atas!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {goals.map((goal) => (
              <SavingsGoalCard key={goal.id} goal={goal} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
