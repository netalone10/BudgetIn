"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  category: string;
  note: string;
  created_at: string;
  type?: "expense" | "income";
}

interface Props {
  transaction: Transaction;
  categories?: string[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Transaction>) => void;
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID").format(amount);
}

function formatDate(dateStr: string) {
  const [, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

export default function TransactionCard({ transaction, categories = [], onDelete, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState(transaction.date);
  const [editNote, setEditNote] = useState(transaction.note);
  const [editAmount, setEditAmount] = useState(String(transaction.amount));
  const [editCategory, setEditCategory] = useState(transaction.category);
  const [loading, setLoading] = useState(false);

  // Gabungkan kategori user + kategori transaksi ini (kalau belum ada di list)
  const categoryOptions = categories.includes(transaction.category)
    ? categories
    : [...categories, transaction.category].sort();

  async function handleSave() {
    setLoading(true);
    const res = await fetch(`/api/record/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: editDate,
        note: editNote,
        amount: Number(editAmount),
        category: editCategory,
      }),
    });
    if (res.ok) {
      onUpdate(transaction.id, {
        date: editDate,
        note: editNote,
        amount: Number(editAmount),
        category: editCategory,
      });
      setEditing(false);
    }
    setLoading(false);
  }

  function handleCancel() {
    setEditDate(transaction.date);
    setEditNote(transaction.note);
    setEditAmount(String(transaction.amount));
    setEditCategory(transaction.category);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm("Hapus transaksi ini?")) return;
    setLoading(true);
    const res = await fetch(`/api/record/${transaction.id}`, { method: "DELETE" });
    if (res.ok) onDelete(transaction.id);
    setLoading(false);
  }

  const isIncome = transaction.type === "income";

  return (
    <tr className={cn(
      "group border-b last:border-0 transition-colors hover:bg-muted/30",
      editing && "bg-muted/40"
    )}>
      {/* Tanggal */}
      <td className="py-2.5 pl-4 pr-3 text-xs text-muted-foreground whitespace-nowrap w-20">
        {editing ? (
          <Input
            type="date"
            className="h-7 text-xs px-2 w-32"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
          />
        ) : (
          formatDate(transaction.date)
        )}
      </td>

      {/* Deskripsi */}
      <td className="py-2.5 pr-3 min-w-0">
        {editing ? (
          <Input
            className="h-7 text-xs px-2"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
          />
        ) : (
          <span className="text-sm block">
            {transaction.note || <span className="text-muted-foreground">—</span>}
          </span>
        )}
      </td>

      {/* Kategori */}
      <td className="py-2.5 pr-3 whitespace-nowrap">
        {editing ? (
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value)}
            className={cn(
              "h-7 rounded-md border bg-background px-2 text-xs",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "min-w-[100px]"
            )}
          >
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
            {!categoryOptions.includes(editCategory) && (
              <option value={editCategory}>{editCategory}</option>
            )}
          </select>
        ) : (
          <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
            {transaction.category}
          </span>
        )}
      </td>

      {/* Jumlah */}
      <td className="py-2.5 pr-2 text-right whitespace-nowrap">
        {editing ? (
          <Input
            className="h-7 w-28 text-xs px-2 text-right"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            type="number"
          />
        ) : (
          <span className={cn(
            "text-sm font-semibold tabular-nums",
            isIncome ? "text-green-600 dark:text-green-400" : ""
          )}>
            {isIncome ? "+" : "-"}{formatRupiah(transaction.amount)}
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="py-2.5 pr-3 w-16">
        <div className={cn(
          "flex items-center justify-end gap-0.5 transition-opacity",
          editing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {editing ? (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSave} disabled={loading}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancel} disabled={loading}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(true)} disabled={loading}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
