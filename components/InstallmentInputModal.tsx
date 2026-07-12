"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/hooks/use-api";
import { formatCompactIDR } from "@/lib/format";

interface Account {
  id: string;
  name: string;
  accountType?: { name: string; classification: string };
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface InstallmentItem {
  id: string;
  name: string;
  totalAmount: number;
  tenor: number;
  startMonth: string;
  accountId?: string | null;
  categoryId?: string | null;
  source?: string | null;
  note?: string | null;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
  editItem?: InstallmentItem | null;
}

const SOURCE_OPTIONS = [
  "Shopee",
  "Tokopedia",
  "Lazada",
  "BCA",
  "Mandiri",
  "Manual",
];

export default function InstallmentInputModal({ onClose, onSaved, editItem }: Props) {
  const [name, setName] = useState(editItem?.name ?? "");
  const [totalAmount, setTotalAmount] = useState(
    editItem ? editItem.totalAmount.toString() : ""
  );
  const [tenor, setTenor] = useState(
    editItem ? editItem.tenor.toString() : ""
  );
  const [startMonth, setStartMonth] = useState(
    editItem?.startMonth ?? new Date().toISOString().slice(0, 7)
  );
  const [accountId, setAccountId] = useState(editItem?.accountId ?? "");
  const [categoryId, setCategoryId] = useState(editItem?.categoryId ?? "");
  const [source, setSource] = useState(editItem?.source ?? "Manual");
  const [note, setNote] = useState(editItem?.note ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: accountsData } = useApi<{ accounts: Account[] }>("/api/accounts");
  const accounts = accountsData?.accounts ?? [];

  const { data: categoriesData } = useApi<{ categories: Category[] }>("/api/categories");
  const categories = categoriesData?.categories ?? [];

  // Filter accounts: Bank, E-Wallet, Kartu Kredit
  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      const cls = a.accountType?.classification?.toLowerCase() ?? "";
      const typeName = a.accountType?.name?.toLowerCase() ?? "";
      return (
        cls === "asset" ||
        typeName.includes("bank") ||
        typeName.includes("e-wallet") ||
        typeName.includes("ewallet") ||
        typeName.includes("kartu kredit") ||
        typeName.includes("credit")
      );
    });
  }, [accounts]);

  // Filter categories: expense only
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories]
  );

  // Preview calculations
  const parsedTotal = Number(totalAmount) || 0;
  const parsedTenor = parseInt(tenor, 10) || 0;
  const monthlyPayment = parsedTenor > 0 ? Math.ceil(parsedTotal / parsedTenor) : 0;
  const totalPaid = monthlyPayment * parsedTenor;
  const lunasMonth = useMemo(() => {
    if (!startMonth || parsedTenor <= 0) return null;
    const [y, m] = startMonth.split("-").map(Number);
    const endM = m + parsedTenor;
    const endY = y + Math.floor((endM - 1) / 12);
    const endMo = ((endM - 1) % 12) + 1;
    return `${endY}-${String(endMo).padStart(2, "0")}`;
  }, [startMonth, parsedTenor]);

  const readErrorMessage = async (res: Response) => {
    try {
      const data = await res.json();
      return data?.error ?? "Terjadi kesalahan.";
    } catch {
      return `Terjadi kesalahan (${res.status}).`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const parsedAmount = Number(totalAmount);
    const parsedTen = parseInt(tenor, 10);

    if (!trimmedName) return setError("Nama barang wajib diisi.");
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0)
      return setError("Total harga tidak valid.");
    if (!Number.isInteger(parsedTen) || parsedTen <= 0)
      return setError("Tenor tidak valid.");
    if (!startMonth) return setError("Mulai cicilan wajib diisi.");

    setLoading(true);
    try {
      const payload = {
        id: editItem?.id,
        name: trimmedName,
        totalAmount: parsedAmount,
        tenor: parsedTen,
        startMonth,
        accountId: accountId || null,
        categoryId: categoryId || null,
        source: source || "Manual",
        note: note.trim() || null,
      };

      onSaved();
      onClose();

      const res = await fetch("/api/installments", {
        method: editItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await readErrorMessage(res);
        toast.error(msg || "Gagal menyimpan cicilan.");
      }
    } catch {
      toast.error("Gagal menyimpan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary";
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
            {editItem ? "Edit Cicilan" : "Tambah Cicilan"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="p-5 flex flex-col gap-4"
        >
          {/* Nama Barang */}
          <div>
            <label htmlFor="inst-name" className={labelCls}>
              Nama Barang
            </label>
            <input
              id="inst-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. iPhone 15, Laptop ASUS"
              required
              className={inputCls}
            />
          </div>

          {/* Total Harga */}
          <div>
            <label htmlFor="inst-total" className={labelCls}>
              Total Harga (Rp)
            </label>
            <input
              id="inst-total"
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="0"
              min={1}
              required
              className={inputCls}
            />
          </div>

          {/* Tenor */}
          <div>
            <label htmlFor="inst-tenor" className={labelCls}>
              Tenor (bulan)
            </label>
            <input
              id="inst-tenor"
              type="number"
              value={tenor}
              onChange={(e) => setTenor(e.target.value)}
              placeholder="12"
              min={1}
              max={120}
              required
              className={inputCls}
            />
          </div>

          {/* Mulai Cicilan */}
          <div>
            <label htmlFor="inst-start" className={labelCls}>
              Mulai Cicilan
            </label>
            <input
              id="inst-start"
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          {/* Sumber Pembayaran */}
          <div>
            <label htmlFor="inst-acc" className={labelCls}>
              Sumber Pembayaran
            </label>
            <select
              id="inst-acc"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputCls}
            >
              <option value="">-- Pilih akun --</option>
              {filteredAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Kategori */}
          <div>
            <label htmlFor="inst-cat" className={labelCls}>
              Kategori
            </label>
            <select
              id="inst-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">-- Pilih kategori --</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sumber Cicilan */}
          <div>
            <label htmlFor="inst-source" className={labelCls}>
              Sumber Cicilan
            </label>
            <select
              id="inst-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={inputCls}
            >
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Catatan */}
          <div>
            <label htmlFor="inst-note" className={labelCls}>
              Catatan
            </label>
            <textarea
              id="inst-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="opsional"
              rows={2}
              className={inputCls}
            />
          </div>

          {/* Preview Panel */}
          {parsedTotal > 0 && parsedTenor > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2">
                Preview Cicilan
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cicilan/bulan</span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatCompactIDR(monthlyPayment)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total cicilan</span>
                <span className="font-medium tabular-nums text-foreground">
                  {formatCompactIDR(totalPaid)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Lunas</span>
                <span className="font-medium text-foreground">{lunasMonth}</span>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
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
              {loading ? "Menyimpan…" : editItem ? "Simpan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
