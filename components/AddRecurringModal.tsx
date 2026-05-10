"use client";

import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import { RecurringWithMeta } from "@/components/RecurringCard";
import {
  RECURRING_FREQUENCIES,
  RECURRING_TYPES,
  type RecurringFrequency,
  type RecurringType,
} from "@/utils/recurring-utils";

interface Account { id: string; name: string }
interface Category { id: string; name: string; type: string }
interface SavingsGoal { id: string; name: string }

interface Props {
  onClose: () => void;
  onSaved: () => void;
  editItem?: RecurringWithMeta | null;
}

const REMINDER_OPTIONS = [
  { label: "H-1 (1 hari sebelum)", value: 1 },
  { label: "H-3 (3 hari sebelum)", value: 3 },
  { label: "H-7 (1 minggu sebelum)", value: 7 },
  { label: "H-14 (2 minggu sebelum)", value: 14 },
];

const TYPE_LABEL: Record<RecurringType, string> = {
  expense: "Pengeluaran",
  income: "Pemasukan",
  transfer: "Transfer",
};

const FREQ_LABEL: Record<RecurringFrequency, string> = {
  daily: "Hari",
  weekly: "Minggu",
  monthly: "Bulan",
  yearly: "Tahun",
};

export default function AddRecurringModal({ onClose, onSaved, editItem }: Props) {
  const [name, setName] = useState(editItem?.name ?? "");
  const [type, setType] = useState<RecurringType>(editItem?.type ?? "expense");
  const [amount, setAmount] = useState(editItem ? parseFloat(editItem.amount).toString() : "");
  const [frequency, setFrequency] = useState<RecurringFrequency>(editItem?.frequency ?? "monthly");
  const [interval, setInterval] = useState((editItem?.interval ?? 1).toString());
  const [startDate, setStartDate] = useState(
    editItem?.startDate
      ? format(new Date(editItem.startDate), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(
    editItem?.endDate ? format(new Date(editItem.endDate), "yyyy-MM-dd") : "",
  );
  const [categoryId, setCategoryId] = useState(editItem?.category?.id ?? "");
  const [accountId, setAccountId] = useState(editItem?.account?.id ?? "");
  const [toAccountId, setToAccountId] = useState(editItem?.toAccount?.id ?? "");
  const [savingsGoalId, setSavingsGoalId] = useState(editItem?.savingsGoal?.id ?? "");
  const [autoRecord, setAutoRecord] = useState(editItem?.autoRecord ?? false);
  const [reminderDays, setReminderDays] = useState<number[]>(editItem?.reminderDays ?? [1]);
  const [note, setNote] = useState(editItem?.note ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(Array.isArray(d?.accounts) ? d.accounts : []));
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d?.categories) ? d.categories : []));
    fetch("/api/savings").then((r) => r.ok ? r.json() : { goals: [] }).then((d) => setGoals(Array.isArray(d?.goals) ? d.goals : [])).catch(() => {});
  }, []);

  const filteredCategories = useMemo(() => {
    if (type === "transfer") return [];
    return categories.filter((c) => c.type === type);
  }, [categories, type]);

  const toggleReminder = (val: number) => {
    setReminderDays((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  };

  const readErrorMessage = async (res: Response) => {
    try { const data = await res.json(); return data?.error ?? "Terjadi kesalahan."; }
    catch { return `Terjadi kesalahan (${res.status}).`; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const parsedAmount = Number(amount);
    const parsedInterval = parseInt(interval, 10);

    if (!trimmedName) return setError("Nama wajib diisi.");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return setError("Nominal tidak valid.");
    if (!Number.isInteger(parsedInterval) || parsedInterval < 1) return setError("Interval tidak valid.");
    if (!startDate) return setError("Tanggal mulai wajib diisi.");
    if (type === "transfer" && (!accountId || !toAccountId)) {
      return setError("Akun sumber dan tujuan wajib diisi untuk transfer.");
    }
    if (type === "transfer" && accountId === toAccountId) {
      return setError("Akun sumber dan tujuan tidak boleh sama.");
    }

    setLoading(true);
    try {
      const payload = {
        id: editItem?.id,
        name: trimmedName,
        type,
        amount: parsedAmount,
        frequency,
        interval: parsedInterval,
        startDate,
        endDate: endDate || null,
        categoryId: type === "transfer" ? null : (categoryId || null),
        accountId: accountId || null,
        toAccountId: type === "transfer" ? (toAccountId || null) : null,
        savingsGoalId: savingsGoalId || null,
        autoRecord,
        reminderDays,
        note: note.trim() || null,
      };
      const res = await fetch("/api/recurring", {
        method: editItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError(await readErrorMessage(res)); return; }
      onSaved();
      onClose();
    } catch {
      setError("Gagal menyimpan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  const labelCls = "block text-sm font-medium text-foreground mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="button"
        tabIndex={-1}
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editItem ? "Edit Berulang" : "Tambah Berulang"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-5 flex flex-col gap-4">
          {/* Type tabs */}
          <div>
            <span className={labelCls}>Tipe</span>
            <div className="grid grid-cols-3 gap-2">
              {RECURRING_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    type === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-foreground border-border hover:bg-muted/80"
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="rec-name" className={labelCls}>Nama</label>
            <input id="rec-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Gaji, Netflix, Transfer Tabungan" required className={inputCls} />
          </div>

          <div>
            <label htmlFor="rec-amount" className={labelCls}>Nominal (Rp)</label>
            <input id="rec-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" min={1} required className={inputCls} />
          </div>

          {/* Frequency */}
          <div>
            <span className={labelCls}>Frekuensi</span>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-2 items-center">
              <span className="text-sm text-muted-foreground">Setiap</span>
              <input type="number" value={interval} onChange={(e) => setInterval(e.target.value)} min={1} max={999} className={inputCls} />
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)} className={inputCls}>
                {RECURRING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQ_LABEL[f]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rec-start" className={labelCls}>Tanggal Mulai</label>
              <input id="rec-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={inputCls} />
            </div>
            <div>
              <label htmlFor="rec-end" className={labelCls}>Berakhir (opsional)</label>
              <input id="rec-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Category (expense/income only) */}
          {type !== "transfer" && (
            <div>
              <label htmlFor="rec-cat" className={labelCls}>Kategori</label>
              <select id="rec-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                <option value="">-- Pilih kategori --</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Account fields */}
          <div>
            <label htmlFor="rec-acc" className={labelCls}>
              {type === "transfer" ? "Dari Akun" : type === "income" ? "Akun Tujuan" : "Akun Pembayaran"}
            </label>
            <select id="rec-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
              <option value="">-- Pilih akun --</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {type === "transfer" && (
            <div>
              <label htmlFor="rec-to-acc" className={labelCls}>Ke Akun</label>
              <select id="rec-to-acc" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} className={inputCls}>
                <option value="">-- Pilih akun tujuan --</option>
                {accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          {/* Savings goal (optional) */}
          {goals.length > 0 && (
            <div>
              <label htmlFor="rec-goal" className={labelCls}>Goal Tabungan (opsional)</label>
              <select id="rec-goal" value={savingsGoalId} onChange={(e) => setSavingsGoalId(e.target.value)} className={inputCls}>
                <option value="">-- Tidak terkait goal --</option>
                {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">Otomatis tercatat sebagai kontribusi ke goal ini.</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input id="rec-auto" type="checkbox" checked={autoRecord} onChange={(e) => setAutoRecord(e.target.checked)} />
            <label htmlFor="rec-auto" className="text-sm text-foreground cursor-pointer">Otomatis catat saat jatuh tempo</label>
          </div>

          <div>
            <span className={labelCls}>Pengingat Email</span>
            <div className="flex flex-col gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={reminderDays.includes(opt.value)} onChange={() => toggleReminder(opt.value)} />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="rec-note" className={labelCls}>Catatan</label>
            <input id="rec-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="opsional" className={inputCls} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted">
              Batal
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {loading ? "Menyimpan…" : editItem ? "Simpan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
