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
}

interface Props {
  transaction: Transaction;
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

export default function TransactionCard({ transaction, onDelete, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState(transaction.note);
  const [editAmount, setEditAmount] = useState(String(transaction.amount));
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    const res = await fetch(`/api/record/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note: editNote,
        amount: Number(editAmount),
      }),
    });
    if (res.ok) {
      onUpdate(transaction.id, { note: editNote, amount: Number(editAmount) });
      setEditing(false);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!confirm("Hapus transaksi ini?")) return;
    setLoading(true);
    const res = await fetch(`/api/record/${transaction.id}`, { method: "DELETE" });
    if (res.ok) onDelete(transaction.id);
    setLoading(false);
  }

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border p-3 text-sm transition-colors",
        editing && "bg-muted/50"
      )}
    >
      {/* Left: date + category badge */}
      <div className="flex items-start gap-2 min-w-0">
        <span className="mt-0.5 shrink-0 text-xs text-muted-foreground w-12">
          {formatDate(transaction.date)}
        </span>
        <div className="min-w-0">
          <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-medium mb-1">
            {transaction.category}
          </span>
          {editing ? (
            <Input
              className="h-6 text-xs px-1 py-0"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
          ) : (
            <p className="text-muted-foreground truncate">{transaction.note || "—"}</p>
          )}
        </div>
      </div>

      {/* Right: amount + actions */}
      <div className="flex items-center gap-1 shrink-0">
        {editing ? (
          <Input
            className="h-6 w-24 text-xs px-1 py-0 text-right"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            type="number"
          />
        ) : (
          <span className="font-medium tabular-nums">
            -{formatRupiah(transaction.amount)}
          </span>
        )}

        {editing ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleSave}
              disabled={loading}
            >
              <Check className="h-3 w-3 text-green-600" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setEditing(false)}
              disabled={loading}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-50 hover:opacity-100"
              onClick={() => setEditing(true)}
              disabled={loading}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-50 hover:opacity-100 hover:text-destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
