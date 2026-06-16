"use client";

import { useState } from "react";
import { AlertCircle, Loader2, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/hooks/use-api";

interface UnallocatedTx {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
}

interface Goal {
  id: string;
  name: string;
}

interface Props {
  goals: Goal[];
  onAllocated: (goalId: string, transactionId: string, amount: number, date: string, note: string) => void;
}

const ID_FORMAT = new Intl.NumberFormat("id-ID");

function formatRupiah(n: number) {
  return ID_FORMAT.format(n);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function UnallocatedSavings({ goals, onAllocated }: Props) {
  const { data, isLoading, error: apiError } = useApi<{ transactions: UnallocatedTx[] }>(
    "/api/savings/unallocated",
  );
  const [transactions, setTransactions] = useState<UnallocatedTx[]>([]);

  // Sync the editable local copy from the server (render-phase; no effect setState).
  const serverTx = data?.transactions;
  const [syncedTx, setSyncedTx] = useState<UnallocatedTx[] | undefined>(undefined);
  if (serverTx && serverTx !== syncedTx) {
    setSyncedTx(serverTx);
    setTransactions(serverTx);
  }

  const loading = isLoading && transactions.length === 0;
  const error = apiError ? "Gagal memuat transaksi. Coba lagi." : null;

  // Per-row state: which tx is open for goal picking, and which goal is selected
  const [openTxId, setOpenTxId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rowError, setRowError] = useState("");

  function openPicker(txId: string) {
    setOpenTxId(txId);
    setSelectedGoalId(goals[0]?.id ?? "");
    setRowError("");
  }

  function closePicker() {
    setOpenTxId(null);
    setSelectedGoalId("");
    setRowError("");
  }

  async function handleAllocate(tx: UnallocatedTx) {
    if (!selectedGoalId) return setRowError("Pilih goal terlebih dahulu.");
    setSubmitting(true);
    setRowError("");
    try {
      const res = await fetch(`/api/savings/${selectedGoalId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: tx.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError(data.error ?? "Gagal mengalokasikan.");
        return;
      }
      // Remove from unallocated list and notify parent
      setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
      onAllocated(selectedGoalId, tx.id, tx.amount, tx.date, tx.note);
      closePicker();
    } catch {
      setRowError("Gagal mengalokasikan. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm py-4">
        <AlertCircle className="size-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Semua transaksi tabungan sudah dialokasikan ke goal.
      </p>
    );
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="flex flex-col divide-y divide-border">
      {transactions.map((tx) => {
        const isOpen = openTxId === tx.id;
        return (
          <div key={tx.id} className="py-3 flex flex-col gap-2">
            {/* Transaction row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium tabular-nums text-sm">
                    Rp {formatRupiah(tx.amount)}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                </div>
                {tx.note && (
                  <span className="text-xs text-muted-foreground truncate">{tx.note}</span>
                )}
              </div>
              {!isOpen && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={() => openPicker(tx.id)}
                  disabled={goals.length === 0}
                >
                  <MoveRight className="size-3.5" />
                  Alokasikan
                </Button>
              )}
            </div>

            {/* Inline goal picker */}
            {isOpen && (
              <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className={inputCls}
                  autoFocus
                >
                  <option value="">-- Pilih goal --</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {rowError && (
                  <p className="text-xs text-destructive">{rowError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closePicker}
                    disabled={submitting}
                    className="flex-1 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAllocate(tx)}
                    disabled={submitting || !selectedGoalId}
                    className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60"
                  >
                    {submitting ? "Menyimpan…" : "Simpan"}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
