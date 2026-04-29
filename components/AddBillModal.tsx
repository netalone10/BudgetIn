"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { BillWithMeta } from "@/components/BillCard";

interface Account {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface AddBillModalProps {
  onClose: () => void;
  onSaved: () => void;
  editBill?: BillWithMeta | null;
}

const REMINDER_OPTIONS = [
  { label: "H-1 (1 hari sebelum)", value: 1 },
  { label: "H-3 (3 hari sebelum)", value: 3 },
  { label: "H-7 (1 minggu sebelum)", value: 7 },
  { label: "H-14 (2 minggu sebelum)", value: 14 },
];

export default function AddBillModal({ onClose, onSaved, editBill }: AddBillModalProps) {
  const [name, setName] = useState(editBill?.name ?? "");
  const [amount, setAmount] = useState(editBill ? parseFloat(editBill.amount).toString() : "");
  const [dueDay, setDueDay] = useState(editBill?.dueDay?.toString() ?? "1");
  const [categoryId, setCategoryId] = useState(editBill?.category?.id ?? "");
  const [accountId, setAccountId] = useState(editBill?.account?.id ?? "");
  const [autoRecord, setAutoRecord] = useState(editBill?.autoRecord ?? false);
  const [reminderDays, setReminderDays] = useState<number[]>(editBill?.reminderDays ?? [1]);
  const [note, setNote] = useState(editBill?.note ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(Array.isArray(d?.accounts) ? d.accounts : []));
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(Array.isArray(d?.categories) ? d.categories.filter((c: Category) => c.type === "expense") : []));
  }, []);

  const toggleReminder = (val: number) => {
    setReminderDays((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        id: editBill?.id,
        name,
        amount: parseFloat(amount),
        dueDay: parseInt(dueDay, 10),
        categoryId: categoryId || null,
        accountId: accountId || null,
        autoRecord,
        reminderDays,
        note: note || null,
      };
      const res = await fetch("/api/bills", {
        method: editBill ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Terjadi kesalahan.");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">
            {editBill ? "Edit Tagihan" : "Tambah Tagihan"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nama Tagihan</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. Netflix, Listrik, Wifi"
              required
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nominal (Rp)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min={1}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Tanggal Jatuh Tempo</label>
              <input
                type="number"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                min={1}
                max={31}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">Tanggal 1-31 tiap bulan</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Pilih kategori --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Akun Pembayaran</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Pilih akun --</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Pengingat</label>
            <div className="flex flex-col gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminderDays.includes(opt.value)}
                    onChange={() => toggleReminder(opt.value)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Catat Otomatis</p>
              <p className="text-xs text-muted-foreground">Transaksi dicatat saat jatuh tempo</p>
            </div>
            <button
              type="button"
              onClick={() => setAutoRecord(!autoRecord)}
              className={`relative overflow-hidden h-6 w-11 rounded-full transition-colors ${autoRecord ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${autoRecord ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Catatan (opsional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="cth. Token listrik 900VA"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Menyimpan..." : editBill ? "Simpan Perubahan" : "Tambah Tagihan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
