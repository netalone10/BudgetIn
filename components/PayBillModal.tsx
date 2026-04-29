"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { BillWithMeta } from "@/components/BillCard";

interface Account {
  id: string;
  name: string;
}

interface PayBillModalProps {
  bill: BillWithMeta;
  onClose: () => void;
  onPaid: () => void;
}

export default function PayBillModal({ bill, onClose, onPaid }: PayBillModalProps) {
  const [amount, setAmount] = useState(parseFloat(bill.amount).toString());
  const [accountId, setAccountId] = useState(bill.account?.id ?? "");
  const [note, setNote] = useState(`Pembayaran ${bill.name}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(Array.isArray(d?.accounts) ? d.accounts : []));
  }, []);

  const handlePay = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount), accountId: accountId || null, note }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Terjadi kesalahan.");
        return;
      }
      onPaid();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Bayar Tagihan</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="bg-muted/40 rounded-lg p-3 border border-border/50">
            <p className="font-semibold text-foreground">{bill.name}</p>
            {bill.category && <p className="text-xs text-muted-foreground mt-0.5">{bill.category.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nominal (Rp)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Bisa diubah untuk tagihan variabel (cth. listrik)</p>
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Catatan</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
              Batal
            </button>
            <button
              onClick={handlePay}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? "Memproses..." : "Konfirmasi Bayar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
