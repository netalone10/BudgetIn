"use client";

import { memo, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useIsDemo } from "@/lib/hooks/use-is-demo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitDataChanged } from "@/lib/data-events";
import { getCategoryIconForTransaction } from "@/utils/category-icons";

export interface Transaction {
  id: string;
  date: string;
  time?: string | null;
  amount: number;
  category: string;
  note: string;
  created_at: string;
  type?: "expense" | "income" | "transfer_out" | "transfer_in";
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
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

const INPUT_CLS = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground/65 focus:outline-none focus:ring-3 focus:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50";
const SELECT_CLS = `${INPUT_CLS} min-w-0 truncate`;
const LABEL_CLS = "mb-1.5 block text-[12px] font-semibold text-muted-foreground";
const EMPTY_CATEGORIES: TransactionCategory[] = [];
const EMPTY_ACCOUNTS: { id: string; name: string }[] = [];

const idFormat = new Intl.NumberFormat("id-ID");
function formatRupiah(amount: number) {
  return idFormat.format(amount);
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

function formatTime(time?: string | null) {
  return time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

interface EditModalProps {
  transaction: Transaction;
  categories: TransactionCategory[];
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (updates: Partial<Transaction>) => void;
}

export function EditModal({ transaction, categories, accounts, onClose, onSaved }: EditModalProps) {
  const [editDate, setEditDate] = useState(transaction.date);
  const [editTime, setEditTime] = useState(() => formatTime(transaction.time));
  const [editNote, setEditNote] = useState(transaction.note);
  const [editAmount, setEditAmount] = useState(String(transaction.amount));
  const [editCategory, setEditCategory] = useState(transaction.category);
  const [editAccountId, setEditAccountId] = useState(transaction.accountId ?? transaction.fromAccountId ?? "");
  const [error, setError] = useState<string | null>(null);

  const categoryType =
    transaction.type === "income" || transaction.type === "transfer_in"
      ? "income"
      : "expense";
  const filteredCategoryNames = categories.flatMap((c) =>
    c.type === categoryType ? [c.name] : []
  );
  const categoryOptions = filteredCategoryNames.includes(transaction.category)
    ? filteredCategoryNames
    : [...filteredCategoryNames, transaction.category].sort();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const updates = {
      date: editDate,
      time: editTime,
      note: editNote,
      amount: Number(editAmount),
      category: editCategory,
      accountId: editAccountId || null,
    };

    // Optimistic: notify parent & close immediately — no spinner.
    toast.success("Transaksi berhasil diperbarui.");
    onSaved(updates);

    try {
      const res = await fetch(`/api/record/${transaction.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error || "Gagal menyimpan.";
        toast.error(msg);
        emitDataChanged(["transactions", "budget", "accounts"]);
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
      emitDataChanged(["transactions", "budget", "accounts"]);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      role="button"
      tabIndex={-1}
    >
      <div className="w-full max-w-md overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[var(--shadow-offset-x)_var(--shadow-offset-y)_var(--shadow-blur)_var(--shadow-spread)_color-mix(in_srgb,var(--shadow-color)_70%,transparent)]">
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/25 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Transaksi</p>
            <h2 className="text-base font-semibold text-foreground">Edit transaksi</h2>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-lg leading-none text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="transactioncard-field-1" className={LABEL_CLS}>Tanggal</label>
              <input id="transactioncard-field-1"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label htmlFor="transactioncard-field-2" className={LABEL_CLS}>Jam</label>
              <input id="transactioncard-field-2"
                type="time"
                value={editTime}
                onChange={(e) => setEditTime(e.target.value)}
                required
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="transactioncard-field-3" className={LABEL_CLS}>Nominal (Rp)</label>
            <input id="transactioncard-field-3"
              type="number"
              step="1"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              required
              className={cn(INPUT_CLS, "font-semibold tabular-nums")}
            />
          </div>

          <div>
            <label htmlFor="transactioncard-field-4" className={LABEL_CLS}>Catatan</label>
            <input id="transactioncard-field-4"
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Tulis catatan…"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor="transactioncard-field-5" className={LABEL_CLS}>Kategori</label>
            <select id="transactioncard-field-5"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className={SELECT_CLS}
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
              <label htmlFor="transactioncard-field-6" className={LABEL_CLS}>Akun</label>
              <select id="transactioncard-field-6"
                value={editAccountId}
                onChange={(e) => setEditAccountId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">— Tanpa Akun —</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" className="h-10 rounded-lg">
              Simpan
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ── Transaction Row ───────────────────────────────────────────────────────────

function TransactionCard({ transaction, categories = EMPTY_CATEGORIES, accounts = EMPTY_ACCOUNTS, onDelete, onUpdate }: Props) {
  const isDemo = useIsDemo();
  const [showModal, setShowModal] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  async function handleDelete() {
    if (!confirm("Hapus transaksi ini?")) return;

    // Optimistic: remove row immediately, reconcile via refetch on error.
    onDelete(transaction.id);

    try {
      const res = await fetch(`/api/record/${transaction.id}`, { method: "DELETE" });
      if (res.ok) {
        emitDataChanged(["transactions", "budget", "accounts"]);
      } else {
        toast.error("Gagal menghapus transaksi.");
        emitDataChanged(["transactions", "budget", "accounts"]);
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
      emitDataChanged(["transactions", "budget", "accounts"]);
    }
  }

  function handleSaved(updates: Partial<Transaction>) {
    onUpdate(transaction.id, updates);
    setShowModal(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
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
      <tr
        className={cn(
          "group block border-b border-border/70 bg-background p-3 transition-colors last:border-0 hover:bg-muted/25 sm:table-row sm:bg-transparent sm:p-0",
          justSaved && "bg-emerald-50/70 dark:bg-emerald-950/20"
        )}
      >
        {/* Tanggal */}
        <td className="flex w-full items-center justify-between pb-2 text-xs text-muted-foreground sm:table-cell sm:w-[88px] sm:whitespace-nowrap sm:py-2.5 sm:pl-4 sm:pr-3">
          <span className="block">{formatDate(transaction.date)}</span>
          <span className="block text-[11px]">{formatTime(transaction.time)}</span>
        </td>

        {/* Deskripsi */}
        <td className="block min-w-0 pb-2 sm:table-cell sm:py-2.5 sm:pr-3">
          <span className="block break-words text-sm font-medium text-foreground sm:truncate sm:font-normal">
            {transaction.note || <span className="text-muted-foreground">—</span>}
          </span>
          {displayAccount && (
            <span className="text-[11px] text-muted-foreground block sm:hidden">
              {displayAccount}
            </span>
          )}
        </td>

        {/* Kategori */}
        <td className="block min-w-0 pb-2 sm:table-cell sm:whitespace-nowrap sm:py-2.5 sm:pr-3">
          <span className="inline-flex items-center gap-1 max-w-full truncate rounded-lg bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            <span>{getCategoryIconForTransaction(transaction.category, transaction.type)}</span>
            {transaction.category}
          </span>
        </td>

        {/* Akun */}
        <td className="hidden min-w-0 whitespace-nowrap py-2.5 pr-3 sm:table-cell">
          {displayAccount ? (
            <span className="block truncate text-xs text-muted-foreground">{displayAccount}</span>
          ) : null}
        </td>

        {/* Jumlah */}
        <td className="flex min-w-0 items-center justify-between pb-2 sm:table-cell sm:w-[156px] sm:whitespace-nowrap sm:py-2.5 sm:pr-4 sm:text-right">
          <span className="text-xs font-medium text-muted-foreground sm:hidden">Jumlah</span>
          <span className={cn(
            "ml-3 shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums",
            isPositiveEffect ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
          )}>
            {isPositiveEffect ? "+" : "-"}{formatRupiah(Math.abs(transaction.amount))}
          </span>
        </td>

        {/* Actions */}
        <td className="block w-full sm:table-cell sm:w-[72px] sm:py-2.5 sm:pr-3">
          {!isDemo && (
          <div className="flex items-center justify-end gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="size-7 rounded-lg shadow-none"
              onClick={() => setShowModal(true)}

            >
              <Pencil className="size-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 rounded-lg shadow-none hover:text-destructive"
              onClick={handleDelete}

            >
              <Trash2 className="size-3" />
            </Button>
          </div>
          )}
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
