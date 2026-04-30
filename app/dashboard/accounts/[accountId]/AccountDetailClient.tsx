"use client";

import { useState, useMemo, useCallback } from "react";
import { TrendingUp, TrendingDown, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import TransactionCard from "@/components/TransactionCard";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";
import type { AccountDetailData, AccountTransaction } from "@/lib/account-detail-data";

// ── Types ────────────────────────────────────────────────────────────────────

type Period = "bulan ini" | "bulan lalu" | "3 bulan" | "semua";

interface Props {
  initialData: AccountDetailData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatIDR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AccountDetailClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState<Period>("bulan ini");
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [page, setPage] = useState(1);

  const { account, transactions, summary } = data;
  const isLiability = account.accountType.classification === "liability";
  const balance = parseFloat(account.currentBalance);
  const color = account.color ?? account.accountType.color ?? "#6366f1";

  const visibleTransactions = useMemo(
    () => transactions.slice((page - 1) * pageSize, page * pageSize),
    [transactions, page, pageSize]
  );
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));

  // ── Fetch on period change ──────────────────────────────────────────────

  const fetchData = useCallback(
    async (p: Period, opts?: { skipBalance?: boolean; skipAccount?: boolean }) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("period", p);
        qs.set("limit", "500");
        if (opts?.skipBalance) qs.set("skipBalance", "1");
        if (opts?.skipAccount) qs.set("skipAccount", "1");

        const res = await fetch(`/api/accounts/${account.id}/transactions?${qs.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setData((prev) => ({
            ...prev,
            // On period change balance/account don't change; on data refresh we want updated values.
            account: json.account ?? prev.account,
            transactions: json.transactions,
            summary: json.summary,
          }));
          setPage(1);
        }
      } catch {
        // keep current data
      } finally {
        setLoading(false);
      }
    },
    [account.id]
  );

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    // Period change doesn't affect account metadata or balance — skip re-fetching them.
    fetchData(p, { skipBalance: true, skipAccount: true });
  }

  // Refresh when other tabs emit data changes — fetch everything since balance may have changed.
  useDataEvent(["transactions", "accounts"], () => {
    fetchData(period);
  });

  // ── Transaction CRUD handlers ───────────────────────────────────────────

  const handleDeleteTx = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  const handleUpdateTx = useCallback((id: string, updates: Partial<AccountTransaction>) => {
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  const periods: { label: string; value: Period }[] = [
    { label: "Bulan Ini", value: "bulan ini" },
    { label: "Bulan Lalu", value: "bulan lalu" },
    { label: "3 Bulan", value: "3 bulan" },
    { label: "Semua", value: "semua" },
  ];

  return (
    <>
      {/* Account Header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div
            className="h-12 w-12 rounded-xl shrink-0 flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: color }}
          >
            {account.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold truncate">{account.name}</h1>
              {isLiability && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium shrink-0">
                  Hutang
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{account.accountType.name}</p>
            {account.accountType.name === "Kartu Kredit" &&
              account.tanggalSettlement &&
              account.tanggalJatuhTempo && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Settlement tgl {account.tanggalSettlement} &middot; Jatuh tempo tgl{" "}
                  {account.tanggalJatuhTempo}
                </p>
              )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground mb-0.5">Saldo Saat Ini</p>
            <p
              className={cn(
                "text-xl font-bold tabular-nums",
                isLiability
                  ? "text-red-500"
                  : balance < 0
                    ? "text-amber-500"
                    : "text-foreground"
              )}
            >
              {formatIDR(balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePeriodChange(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Masuk</span>
          </div>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {loading ? "..." : formatIDR(summary.totalIn)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs text-muted-foreground">Keluar</span>
          </div>
          <p className="text-base font-bold text-red-500 tabular-nums">
            {loading ? "..." : formatIDR(summary.totalOut)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Net</span>
          </div>
          <p
            className={cn(
              "text-base font-bold tabular-nums",
              summary.net >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500"
            )}
          >
            {loading ? "..." : formatIDR(summary.net)}
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold">
            Riwayat Transaksi{" "}
            {!loading && (
              <span className="text-muted-foreground font-normal">({summary.count})</span>
            )}
          </h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {transactions.length === 0 && !loading ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <p className="text-sm text-muted-foreground">
              Belum ada transaksi di akun ini untuk periode ini.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-2 pl-4 pr-3 text-xs font-medium text-muted-foreground w-20">
                      Tanggal
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground">
                      Deskripsi
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground">
                      Kategori
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                      Akun
                    </th>
                    <th className="py-2 pr-2 text-xs font-medium text-muted-foreground text-right">
                      Jumlah
                    </th>
                    <th className="py-2 pr-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((t) => (
                    <TransactionCard
                      key={t.id}
                      transaction={t}
                      onDelete={handleDeleteTx}
                      onUpdate={handleUpdateTx}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {transactions.length > 10 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <div className="flex items-center gap-1">
                  {([10, 20, 50] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setPageSize(s);
                        setPage(1);
                      }}
                      className={cn(
                        "px-2 py-1 rounded-md transition-colors",
                        pageSize === s
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    {(page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, transactions.length)} dari{" "}
                    {transactions.length}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-30"
                  >
                    &lsaquo;
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-30"
                  >
                    &rsaquo;
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
