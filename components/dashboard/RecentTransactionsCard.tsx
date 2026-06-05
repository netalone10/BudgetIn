"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EditModal } from "@/components/TransactionCard";
import type { Transaction, TransactionCategory } from "@/components/TransactionCard";
import { useIsDemo } from "@/lib/hooks/use-is-demo";
import { emitDataChanged } from "@/lib/data-events";
import { isTransferTransaction } from "@/lib/transaction-classification";
import { cn } from "@/lib/utils";
import { getCategoryIconForTransaction } from "@/utils/category-icons";

const ID_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];

function emojiForRow(t: Transaction): string {
  return getCategoryIconForTransaction(t.category ?? "", t.type);
}

function formatRowDate(iso: string): string {
  const todayStr = new Date().toISOString().slice(0, 10);
  if (iso === todayStr) return "Hari ini";
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (iso === yesterday) return "Kemarin";
  const [, m, d] = iso.split("-");
  const day = parseInt(d, 10);
  const monthIdx = parseInt(m, 10) - 1;
  if (Number.isNaN(day) || monthIdx < 0 || monthIdx > 11) return iso;
  return `${day} ${ID_MONTHS[monthIdx]}`;
}

const idFormat = new Intl.NumberFormat("id-ID");

export interface RecentTransactionsCardProps {
  transactions: Transaction[];
  categories: TransactionCategory[];
  accounts: { id: string; name: string }[];
  limit?: number;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Transaction>) => void;
}

export default function RecentTransactionsCard({
  transactions,
  categories,
  accounts,
  limit = 5,
  onDelete,
  onUpdate,
}: RecentTransactionsCardProps) {
  const isDemo = useIsDemo();
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const recent = transactions.slice(0, limit);

  async function handleDelete(t: Transaction) {
    if (!confirm("Hapus transaksi ini?")) return;

    // Optimistic: remove immediately, reconcile via refetch on error.
    onDelete(t.id);

    try {
      const res = await fetch(`/api/record/${t.id}`, { method: "DELETE" });
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

  return (
    <SectionCard
      eyebrow="Ledger"
      title="Transaksi Terakhir"
      dense
      action={
        <Link
          href="/dashboard/transactions"
          className="cursor-pointer text-[12px] font-semibold text-primary hover:underline"
        >
          {transactions.length > limit
            ? `${transactions.length} total →`
            : "Lihat semua →"}
        </Link>
      }
    >
      {recent.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-background px-5 py-10 text-center text-sm text-muted-foreground">
          Belum ada transaksi bulan ini.
        </div>
      ) : (
        <ul className="flex flex-col">
          {recent.map((t) => {
            const isIncome = t.type === "income" || t.type === "transfer_in";
            const isTransfer = isTransferTransaction(t);
            // Signed effective amount: for non-transfers, reverse the sign of expenses so
            // contra-entries (refund/reversal with negative amount) flip tone to "in".
            const effectiveAmount = isTransfer ? t.amount : (isIncome ? t.amount : -t.amount);
            const isPositiveEffect = effectiveAmount >= 0;
            const tone: "out" | "in" | "tf" = isTransfer ? "tf" : isPositiveEffect ? "in" : "out";

            const resolveAccountName = (id: string | null | undefined, fallback: string | null | undefined) =>
              fallback || (id ? accounts.find((a) => a.id === id)?.name : undefined) || null;
            const displayName = (() => {
              if (isTransfer) {
                const from = resolveAccountName(t.fromAccountId, t.fromAccountName);
                const to = resolveAccountName(t.toAccountId, t.toAccountName);
                if (from && to) return `${from} → ${to}`;
                const own = resolveAccountName(t.accountId, null);
                if (t.type === "transfer_out") return own ? `${own} →` : t.category;
                if (t.type === "transfer_in") return own ? `→ ${own}` : t.category;
                return t.category;
              }
              return t.note?.trim() || t.category;
            })();

            const displayCategory = isTransfer
              ? (t.note?.trim() || "Transfer")
              : t.category;

            const amountText = (() => {
              const abs = idFormat.format(Math.abs(t.amount));
              if (isTransfer) return `Rp ${abs}`;
              return `${isPositiveEffect ? "+" : "-"}Rp ${abs}`;
            })();

            return (
              <li
                key={t.id}
                className="group flex items-center gap-3 border-b border-border/40 py-2.5 last:border-0"
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[15px]",
                    tone === "out" && "bg-destructive/10",
                    tone === "in" && "bg-emerald-500/10",
                    tone === "tf" && "bg-blue-500/10"
                  )}
                >
                  {emojiForRow(t)}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {displayCategory}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "whitespace-nowrap text-[13px] font-bold tabular-nums",
                      tone === "out" && "text-destructive",
                      tone === "in" && "text-emerald-600 dark:text-emerald-400",
                      tone === "tf" && "text-blue-600 dark:text-blue-400"
                    )}
                  >
                    {amountText}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {formatRowDate(t.date)}
                  </p>
                </div>

                {!isDemo && (
                  <div className="ml-1 flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => setEditingTx(t)}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Edit transaksi"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      className="flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Hapus transaksi"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editingTx && (
        <EditModal
          transaction={editingTx}
          categories={categories}
          accounts={accounts}
          onClose={() => setEditingTx(null)}
          onSaved={(updates) => {
            onUpdate(editingTx.id, updates);
            setEditingTx(null);
          }}
        />
      )}
    </SectionCard>
  );
}
