"use client";

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DetailType } from "@/lib/details-data";

export interface TypeTabsProps {
  active: DetailType;
  onChange: (next: DetailType) => void;
  incomeTotal: number;
  expenseTotal: number;
  incomeCount: number;
  expenseCount: number;
}

/**
 * Format nominal IDR dengan separator ribuan id-ID.
 * Mengikuti pola `formatRupiah` di `app/dashboard/report/parts.tsx` /
 * `formatIDR` di `lib/format.ts` namun selalu mengembalikan `Rp0` saat
 * nilainya 0 (Requirement 2.2: "jika jumlah transaksi 0, total nominal
 * SHALL ditampilkan sebagai Rp0").
 */
function formatTotalIDR(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `Rp${Math.round(Math.abs(safe)).toLocaleString("id-ID")}`;
}

function formatCount(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.trunc(safe)).toLocaleString("id-ID");
}

interface TabPill {
  id: DetailType;
  label: string;
  total: number;
  count: number;
  icon: typeof ArrowUpCircle;
  /** Tailwind class untuk warna semantik nilai aktif (income hijau, expense destructive). */
  activeAccent: string;
  inactiveAccent: string;
}

/**
 * `TypeTabs` — sub-tab Pemasukan / Pengeluaran untuk halaman
 * `/dashboard/details`. Lihat Requirements 2.2, 2.3, 2.4, 2.6, 8.2, 12.1.
 *
 * - Selalu menampilkan dua pill: "Pemasukan" dan "Pengeluaran" lengkap dengan
 *   total IDR + jumlah transaksi (mengikuti pola `ReportClient` & format dari
 *   `report/parts.tsx`).
 * - Pill aktif memiliki `aria-selected="true"` plus highlight visual.
 * - Handler `onChange` hanya dipanggil dengan nilai valid (`"income"` atau
 *   `"expense"`); parent disarankan tetap memvalidasi (Req 2.6) tetapi
 *   komponen sendiri tidak akan mengeluarkan nilai lain.
 * - Container `flex flex-wrap` agar tetap rapi di bawah 360px (Req 12.1).
 */
export default function TypeTabs({
  active,
  onChange,
  incomeTotal,
  expenseTotal,
  incomeCount,
  expenseCount,
}: TypeTabsProps) {
  const tabs: TabPill[] = [
    {
      id: "income",
      label: "Pemasukan",
      total: incomeTotal,
      count: incomeCount,
      icon: ArrowUpCircle,
      activeAccent: "text-[#0fa76e]",
      inactiveAccent: "text-[#0fa76e]/80",
    },
    {
      id: "expense",
      label: "Pengeluaran",
      total: expenseTotal,
      count: expenseCount,
      icon: ArrowDownCircle,
      activeAccent: "text-destructive",
      inactiveAccent: "text-destructive/80",
    },
  ];

  const handleSelect = (next: DetailType) => {
    // Komponen sudah membatasi `tabs` ke nilai valid; guard tambahan
    // memastikan kita tidak pernah mem-bubble nilai di luar union.
    if (next !== "income" && next !== "expense") return;
    if (next === active) return;
    onChange(next);
  };

  return (
    <div
      role="tablist"
      aria-label="Tipe transaksi"
      className="flex flex-wrap gap-2 rounded-2xl border border-border bg-muted/30 p-1.5"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        const totalLabel = formatTotalIDR(tab.total);
        const countLabel = formatCount(tab.count);

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleSelect(tab.id)}
            className={cn(
              "group inline-flex min-w-[10rem] flex-1 items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-colors sm:flex-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "bg-background shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-5 shrink-0",
                isActive ? tab.activeAccent : tab.inactiveAccent,
              )}
              aria-hidden="true"
            />
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "text-sm font-semibold",
                  isActive ? "text-foreground" : "text-foreground/80",
                )}
              >
                {tab.label}
              </span>
              <span
                className={cn(
                  "text-base font-bold tabular-nums",
                  isActive ? tab.activeAccent : "text-foreground/70",
                )}
              >
                {totalLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                {countLabel} transaksi
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
