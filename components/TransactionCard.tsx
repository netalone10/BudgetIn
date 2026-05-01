"use client";

import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitDataChanged } from "@/lib/data-events";

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  created_at: string;
  type?: "expense" | "income" | "transfer_out" | "transfer_in";
  fromAccountName?: string;
  toAccountName?: string;
  accountId?: string | null;
}

export interface TransactionCategory {
  name: string;
  type: string;
}

interface Props {
  transaction: Transaction;
  categories?: TransactionCategory[];
  accounts?: { id: string; name: string }[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Transaction>) => void;
}

const INPUT_CLS = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const LABEL_CLS = "block text-xs font-medium text-muted-foreground mb-1";

const idFormat = new Intl.NumberFormat("id-ID");
function formatRupiah(amount: number) {
  return idFormat.format(amount);
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  transaction: Transaction;
  categories: TransactionCategory[];
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (updates: Partial<Transaction>) => void;
}

function EditModal({ transaction, categories, accounts, onClose, onSaved }: EditModalProps) {
  const [editDate, setEditDate] = useState(transaction.date);
  const [editNote, setEditNote] = useState(transaction.note);
  const [editAmount, setEditAmount] = useState(String(transaction.amount));
  const [editCategory, setEditCategory] = useState(transaction.category);
  const [editAccountId, setEditAccountId] = useState(transaction.accountId ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryType =
    transaction.type === "income" || transaction.type === "transfer_in"
      ? "income"
      : "expense";
  const filteredCategoryNames = categories
    .filter((c) => c.type === categoryType)
    .map((c) => c.name);
  const categoryOptions = filteredCategoryNames.includes(transaction.category)
    ? filteredCategoryNames
    : [...filteredCategoryNames, transaction.category].sort();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/record/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: editDate,
        note: editNote,
        amount: Number(editAmount),
        category: editCategory,
        accountId: editAccountId || null,
      }),
    });
    if (res.ok) {
      onSaved({
        date: editDate,
        note: editNote,
        amount: Number(editAmount),
        category: editCategory,
        accountId: editAccountId || null,
      });
    } else {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error || "Gagal menyimpan.");
    }
    setLoading(false);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">Edit Transaksi</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Tanggal</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className={LABEL_CLS}>Nominal (Rp)</label>
              <input
                type="number"
                step="1"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Catatan</label>
            <input
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Tulis catatan..."
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label className={LABEL_CLS}>Kategori</label>
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className={INPUT_CLS}
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              {!categoryOptions.includes(editCategory) && (
                <option value={editCategory}>{editCategory}</option>
              )}
            </select>
          </div>

          {accounts.length > 0 && (
            <div>
              <label className={LABEL_CLS}>Akun</label>
              <select
                value={editAccountId}
                onChange={(e) => setEditAccountId(e.target.value)}
                className={INPUT_CLS}
              >
                <option value="">— Tanpa Akun —</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Transaction Row ───────────────────────────────────────────────────────────

function TransactionCard({ transaction, categories = [], accounts = [], onDelete, onUpdate }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  async function handleDelete() {
    if (!confirm("Hapus transaksi ini?")) return;
    setDeleting(true);
    const res = await fetch(`/api/record/${transaction.id}`, { method: "DELETE" });
    if (res.ok) {
      onDelete(transaction.id);
      emitDataChanged(["transactions", "budget", "accounts"]);
    }
    setDeleting(false);
  }

  function handleSaved(updates: Partial<Transaction>) {
    onUpdate(transaction.id, updates);
    setShowModal(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
    emitDataChanged(["transactions", "budget", "accounts"]);
  }

  const isIncome = transaction.type === "income" || transaction.type === "transfer_in";
  const effectiveAmount = isIncome ? transaction.amount : -transaction.amount;
  const isPositiveEffect = effectiveAmount >= 0;

  const displayAccount =
    transaction.fromAccountName ||
    transaction.toAccountName ||
    (transaction.accountId ? accounts.find((a) => a.id === transaction.accountId)?.name : undefined);

  return (
    <>
      <tr className={cn(
        "group border-b last:border-0 transition-colors hover:bg-muted/30",
        justSaved && "bg-green-50/70 dark:bg-green-950/20"
      )}>
        {/* Tanggal */}
        <td className="py-2.5 pl-4 pr-3 text-xs text-muted-foreground whitespace-nowrap w-20">
          {formatDate(transaction.date)}
        </td>

        {/* Deskripsi */}
        <td className="py-2.5 pr-3 min-w-0">
          <span className="text-sm block">
            {transaction.note || <span className="text-muted-foreground">—</span>}
          </span>
        </td>

        {/* Kategori */}
        <td className="py-2.5 pr-3 whitespace-nowrap">
          <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            {transaction.category}
          </span>
        </td>

        {/* Akun */}
        <td className="py-2.5 pr-3 whitespace-nowrap hidden sm:table-cell">
          {displayAccount ? (
            <span className="text-xs text-muted-foreground">{displayAccount}</span>
          ) : null}
        </td>

        {/* Jumlah */}
        <td className="py-2.5 pr-2 text-right whitespace-nowrap">
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            isPositiveEffect ? "text-green-600 dark:text-green-400" : ""
          )}>
            {isPositiveEffect ? "+" : "-"}{formatRupiah(Math.abs(transaction.amount))}
          </span>
        </td>

        {/* Actions */}
        <td className="py-2.5 pr-3 w-16">
          <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setShowModal(true)}
              disabled={deleting}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </td>
      </tr>

      {showModal && (
        <EditModal
          transaction={transaction}
          categories={categories}
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

export default memo(TransactionCard);
