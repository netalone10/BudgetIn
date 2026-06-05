"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useApi } from "@/lib/hooks/use-api";
import { format } from "date-fns";

interface Account {
  id: string;
  name: string;
}

interface NewContribution {
  id: string;
  transactionId: string;
  amount: number;
  date: string;
  note: string;
}

interface Props {
  goalId: string;
  goalName: string;
  onClose: () => void;
  onSaved: (contribution: NewContribution) => void;
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const labelCls = "block text-sm font-medium text-foreground mb-1.5";

export default function ContributeModal({ goalId, goalName, onClose, onSaved }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: accountsData } = useApi<{ accounts: Account[] }>("/api/accounts");
  const accounts = accountsData?.accounts ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return setError("Jumlah harus lebih dari 0.");
    }
    if (!accountId) return setError("Pilih akun sumber.");
    if (!date) return setError("Tanggal wajib diisi.");

    setLoading(true);
    try {
      const res = await fetch(`/api/savings/${goalId}/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          accountId,
          date,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan kontribusi.");
        return;
      }

      onSaved(data.contribution);
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
          <div>
            <h2 className="text-base font-semibold text-foreground">Tambah Kontribusi</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{goalName}</p>
          </div>
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
            <label htmlFor="contrib-amount" className={labelCls}>Jumlah (Rp)</label>
            <input
              id="contrib-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min={1}
              required
              className={inputCls}
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="contrib-account" className={labelCls}>Dari Akun</label>
            <select
              id="contrib-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">-- Pilih akun --</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="contrib-date" className={labelCls}>Tanggal</label>
            <input
              id="contrib-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="contrib-note" className={labelCls}>Catatan (opsional)</label>
            <input
              id="contrib-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="cth. Gaji bulan ini"
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
