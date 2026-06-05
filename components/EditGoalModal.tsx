"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface UpdatedGoal {
  id: string;
  name: string;
  targetAmount: number;
  deadline?: string | null;
  createdAt: string;
}

interface Props {
  goalId: string;
  initialName: string;
  initialTargetAmount: number;
  initialDeadline?: string | null;
  onClose: () => void;
  onSaved: (goal: UpdatedGoal) => void;
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1.5";

export default function EditGoalModal({
  goalId,
  initialName,
  initialTargetAmount,
  initialDeadline,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialName);
  const [targetAmount, setTargetAmount] = useState(String(initialTargetAmount));
  const [deadline, setDeadline] = useState(initialDeadline ? initialDeadline.slice(0, 10) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const parsedAmount = Number(targetAmount);
    if (!trimmedName) return setError("Nama goal wajib diisi.");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return setError("Target amount harus lebih dari 0.");
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/savings/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          targetAmount: parsedAmount,
          deadline: deadline || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan perubahan.");
        return;
      }
      onSaved(data.goal);
      onClose();
    } catch {
      setError("Gagal menyimpan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="button"
        tabIndex={-1}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Edit Goal</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 flex flex-col gap-4">
          <div>
            <label htmlFor="edit-name" className={labelCls}>Nama Goal</label>
            <input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. Dana Darurat"
              required
              className={inputCls}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="edit-target" className={labelCls}>Target Amount (Rp)</label>
            <input
              id="edit-target"
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0"
              min={1}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="edit-deadline" className={labelCls}>Deadline (opsional)</label>
            <input
              id="edit-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
