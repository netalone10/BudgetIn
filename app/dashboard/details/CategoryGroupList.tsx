"use client";

import TransactionCard, {
  type Transaction,
  type TransactionCategory,
} from "@/components/TransactionCard";
import type { CategoryGroup, DetailType } from "@/lib/details-data";
import CategoryRow, { getCategoryRegionId } from "./CategoryRow";

export interface CategoryGroupListProps {
  /** Sudah disaring + di-aggregate untuk tab aktif (income atau expense). */
  groups: CategoryGroup[];
  /** Tab aktif — menentukan copy empty state dan warna semantik di row. */
  type: DetailType;
  /** Set kategori yang sedang di-expand. Read-only di sisi anak. */
  expandedKeys: ReadonlySet<string>;
  onToggle: (category: string) => void;
  /** Diteruskan ke `TransactionCard` untuk dropdown kategori di modal edit. */
  categories: TransactionCategory[];
  /** Diteruskan ke `TransactionCard` untuk dropdown akun di modal edit. */
  accounts: Array<{ id: string; name: string }>;
  onDeleteTx: (id: string) => void;
  onUpdateTx: (id: string, data: Partial<Transaction>) => void;
}

/**
 * `CategoryGroupList` — accordion list per kategori untuk halaman
 * `/dashboard/details`. Lihat Requirements 6.1, 6.5, 6.6, 7.1, 9.1.
 *
 * - Render satu `<CategoryRow>` per group; default collapsed.
 * - Region transaksi (`<div role="region">`) hanya dimasukkan ke pohon React
 *   ketika `expandedKeys.has(group.category)` (lazy mount untuk performa
 *   di group besar — Req 6.5/6.6).
 * - `id` region disinkron dengan `aria-controls` di `CategoryRow` melalui
 *   helper `getCategoryRegionId` yang sama-sama di-import.
 * - Empty state inline saat `groups.length === 0` (Req 9.1).
 *
 * Catatan: `TransactionCard` me-render `<tr>` (lihat
 * `app/dashboard/transactions/TransactionsClient.tsx`), jadi list di-bungkus
 * `<table><tbody>` agar markup HTML valid dan styling responsifnya konsisten
 * dengan halaman Transaksi.
 */
export default function CategoryGroupList({
  groups,
  type,
  expandedKeys,
  onToggle,
  categories,
  accounts,
  onDeleteTx,
  onUpdateTx,
}: CategoryGroupListProps) {
  if (groups.length === 0) {
    const noun = type === "income" ? "pemasukan" : "pengeluaran";
    return (
      <div
        role="status"
        className="rounded-2xl border border-dashed border-border/70 bg-card px-5 py-10 text-center"
      >
        <p className="text-sm font-medium text-foreground">
          Belum ada {noun} di periode ini.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Coba ganti periode di filter di atas untuk melihat data lain.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {groups.map((group) => {
        const expanded = expandedKeys.has(group.category);
        const txListId = getCategoryRegionId(group.category);

        return (
          <li key={group.category} className="flex flex-col gap-2">
            <CategoryRow
              group={group}
              type={type}
              expanded={expanded}
              onToggle={() => onToggle(group.category)}
            />

            {expanded && (
              <div
                role="region"
                id={txListId}
                aria-label={`Transaksi kategori ${group.category}`}
                className="overflow-hidden rounded-2xl border border-border/70 bg-background"
              >
                <div className="overflow-x-auto [scrollbar-width:thin]">
                  <table className="w-full sm:min-w-[680px] sm:table-fixed">
                    <tbody>
                      {group.transactions.map((tx) => {
                        // `CategoryGroup.transactions` is typed as the broader
                        // `ReportTransactionLike` (see `lib/details-data.ts`),
                        // but at runtime `DetailsClient` always feeds full
                        // `Transaction` records (id/note/time/etc. from
                        // `/api/record`). Cast at the boundary so
                        // `TransactionCard` gets the type it expects.
                        const fullTx = tx as unknown as Transaction;
                        return (
                          <TransactionCard
                            key={fullTx.id}
                            transaction={fullTx}
                            categories={categories}
                            accounts={accounts}
                            onDelete={onDeleteTx}
                            onUpdate={onUpdateTx}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
