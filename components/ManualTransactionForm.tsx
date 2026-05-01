"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitDataChanged } from "@/lib/data-events";

interface Account {
  id: string;
  name: string;
  currency: string;
  accountType: { name: string; classification: string };
}

interface ManualTransactionFormProps {
  accounts: Account[];
  categories: string[];
  onSuccess: () => void;
  defaultAccountId?: string;
}

type TabType = "expense" | "income" | "transfer";

export default function ManualTransactionForm({ accounts, categories, onSuccess, defaultAccountId }: ManualTransactionFormProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("expense");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  // Reset form on tab change
  useEffect(() => {
    setAmount("");
    setAccountId(defaultAccountId ?? "");
    setToAccountId("");
    setCategory("");
    setNote("");
    setError(null);
    setSuccess(null);
  }, [tab, defaultAccountId]);

  const activeAccounts = accounts.filter((a) => a.id);

  // Check if user has multiple currencies
  const currencies = new Set(activeAccounts.map((a) => a.currency));
  const isMultiCurrency = currencies.size > 1;

  // Grouped accounts for optgroup, sorted alphabetically within each group
  const accountsByType = activeAccounts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .reduce<Record<string, Account[]>>((acc, a) => {
      const typeName = a.accountType.name;
      if (!acc[typeName]) acc[typeName] = [];
      acc[typeName].push(a);
      return acc;
    }, {});

  // Cross-currency warning
  const fromAcc = activeAccounts.find((a) => a.id === accountId);
  const toAcc = activeAccounts.find((a) => a.id === toAccountId);
  const currencyMismatch =
    tab === "transfer" && fromAcc && toAcc && fromAcc.currency !== toAcc.currency;

  // Liability target label
  const isLiabilityTarget = tab === "transfer" && toAcc?.accountType.classification === "liability";

  const expenseCategories = categories.filter((c) => !["Gaji", "Freelance", "Bonus", "Investasi", "Bisnis", "THR", "Dividen", "Lainnya", "Pemasukan"].includes(c));
  const incomeCategories = categories.filter((c) => ["Gaji", "Freelance", "Bonus", "Investasi", "Bisnis", "THR", "Dividen", "Lainnya", "Pemasukan"].includes(c));
  const currentCategories = tab === "income" ? incomeCategories : expenseCategories;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount)) {
      setError("Nominal tidak valid.");
      return;
    }
    if (tab === "transfer" && parsedAmount <= 0) {
      setError("Nominal transfer harus lebih dari 0.");
      return;
    }
    if (tab !== "transfer" && parsedAmount === 0) {
      setError("Nominal tidak boleh 0.");
      return;
    }

    const payload: Record<string, unknown> = { type: tab, amount: parsedAmount, date, note };

    if (tab === "transfer") {
      payload.accountId = accountId;
      payload.toAccountId = toAccountId;
    } else {
      payload.accountId = accountId;
      payload.category = category;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan transaksi.");
        return;
      }
      setSuccess(tab === "transfer" ? "Transfer berhasil dicatat." : "Transaksi berhasil dicatat.");
      setAmount("");
      setNote("");
      setCategory("");
      onSuccess();
      emitDataChanged(["transactions", "budget", "accounts"]);
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  if (activeAccounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
        <p className="text-sm text-muted-foreground mb-3">Belum ada akun. Buat akun dulu untuk mulai input manual.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/accounts")}>
          Buat Akun Pertama →
        </Button>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: React.ElementType; color: string }[] = [
    { key: "expense", label: "Pengeluaran", icon: ArrowDownCircle, color: "text-red-500" },
    { key: "income", label: "Pemasukan", icon: ArrowUpCircle, color: "text-emerald-500" },
    { key: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "text-blue-500" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors",
              tab === key
                ? "bg-muted/60 border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            )}
          >
            <Icon className={cn("h-4 w-4", tab === key ? color : "")} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Nominal (Rp)</label>
          <input
            type="number"
            min={tab === "transfer" ? "1" : "-1000000000"}
            max="1000000000"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Account(s) */}
        {tab === "transfer" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Dari Akun</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Pilih akun</option>
                {Object.entries(accountsByType).map(([typeName, accs]) => (
                  <optgroup key={typeName} label={typeName}>
                    {accs.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === toAccountId}>
                        {isMultiCurrency ? `${a.name} (${a.currency})` : a.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {isLiabilityTarget ? "Bayar ke" : "Ke Akun"}
              </label>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Pilih akun</option>
                {Object.entries(accountsByType).map(([typeName, accs]) => (
                  <optgroup key={typeName} label={typeName}>
                    {accs.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === accountId}>
                        {isMultiCurrency ? `${a.name} (${a.currency})` : a.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {tab === "income" ? "Masuk ke Akun" : "Dari Akun"}
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Pilih akun</option>
              {Object.entries(accountsByType).map(([typeName, accs]) => (
                <optgroup key={typeName} label={typeName}>
                  {accs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {isMultiCurrency ? `${a.name} (${a.currency})` : a.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {/* Category (not for transfer) */}
        {tab !== "transfer" && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Pilih kategori</option>
              {currentCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date + Note */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tanggal</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Catatan (opsional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tulis catatan..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Warnings */}
        {currencyMismatch && (
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
            ⚠️ Transfer beda mata uang ({fromAcc?.currency} → {toAcc?.currency}) belum didukung. Catat sebagai pengeluaran dan pemasukan terpisah.
          </p>
        )}
        {isLiabilityTarget && !currencyMismatch && (
          <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2">
            💡 Pembayaran cicilan/hutang: uang keluar dari akun asal, saldo hutang berkurang. Net worth tidak berubah.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-3 py-2">
            ✓ {success}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || !!currencyMismatch}
          className="w-full"
          size="sm"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Menyimpan...</>
          ) : tab === "transfer" ? (
            isLiabilityTarget ? "Catat Pembayaran Cicilan/Hutang" : "Catat Transfer"
          ) : tab === "income" ? (
            "Catat Pemasukan"
          ) : (
            "Catat Pengeluaran"
          )}
        </Button>
      </form>
    </div>
  );
}
