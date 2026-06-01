"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import TransactionCard, {
  type Transaction,
  type TransactionCategory,
} from "@/components/TransactionCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useDataEvent, emitDataChanged } from "@/lib/data-events";
import { useApi } from "@/lib/hooks/use-api";
import { isExpenseTransaction, isTransferTransaction, isEquityTransaction } from "@/lib/transaction-classification";
import { isSavingsTransaction } from "@/lib/savings-utils";
import { cn } from "@/lib/utils";

type Period = "today" | "week" | "month" | "lastMonth" | "custom";
type TypeFilter = "all" | "expense" | "income" | "transfer";

type Account = {
  id: string;
  name: string;
  currency?: string;
  accountType?: { name: string; classification: string };
};

const PERIOD_OPTIONS: { key: Period; label: string; apiPeriod: string }[] = [
  { key: "today", label: "Hari ini", apiPeriod: "hari ini" },
  { key: "week", label: "Minggu ini", apiPeriod: "minggu ini" },
  { key: "month", label: "Bulan ini", apiPeriod: "bulan ini" },
  { key: "lastMonth", label: "Bulan lalu", apiPeriod: "bulan lalu" },
  { key: "custom", label: "Custom", apiPeriod: "custom" },
];

export default function TransactionsClient() {
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [accountFilter, setAccountFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: accountsData } = useApi<{ accounts: Account[] }>("/api/accounts");
  const accounts = accountsData?.accounts ?? [];

  const { data: categoriesData } = useApi<{ categories: { name: string; type: string; isSavings?: boolean }[] }>("/api/categories");
  const categories: TransactionCategory[] = (categoriesData?.categories ?? []).map(c => ({ name: c.name, type: c.type }));
  const savingsCategoryNames = useMemo(() => {
    return new Set(
      (categoriesData?.categories ?? [])
        .filter((c) => c.isSavings)
        .map((c) => c.name.toLowerCase())
    );
  }, [categoriesData]);

  const fetchTransactions = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const opt = PERIOD_OPTIONS.find((o) => o.key === period);
        let url = `/api/record?period=${encodeURIComponent(opt?.apiPeriod ?? "bulan ini")}`;
        if (period === "custom") {
          if (!customFrom || !customTo) {
            setTransactions([]);
            setLoading(false);
            return;
          }
          url = `/api/record?period=custom&from=${customFrom}&to=${customTo}`;
        }
        const res = await fetch(url, { cache: "no-store", signal });
        if (!res.ok) {
          setTransactions([]);
          return;
        }
        const data = await res.json();
        setTransactions(data.transactions ?? []);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setTransactions([]);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [period, customFrom, customTo]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchTransactions(controller.signal);
    return () => controller.abort();
  }, [fetchTransactions]);

  useDataEvent(["transactions"], () => {
    fetchTransactions();
  });

  useEffect(() => {
    setPage(1);
  }, [period, customFrom, customTo, typeFilter, categoryFilter, accountFilter, searchQuery, pageSize]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter === "expense") {
        if (isEquityTransaction(t)) return false;
        if (!t.amount) return false;
        if (!isExpenseTransaction(t)) return false;
        if (isSavingsTransaction(t.category, savingsCategoryNames)) return false;
      } else if (typeFilter === "income") {
        if (isEquityTransaction(t)) return false;
        if (!t.amount) return false;
        if (t.type !== "income") return false;
      } else if (typeFilter === "transfer") {
        if (!isTransferTransaction(t)) return false;
      }
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (accountFilter) {
        const matchAccount =
          t.accountId === accountFilter ||
          t.fromAccountId === accountFilter ||
          t.toAccountId === accountFilter;
        if (!matchAccount) return false;
      }
      if (q) {
        const haystack = `${t.note ?? ""} ${t.category ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, categoryFilter, accountFilter, searchQuery, savingsCategoryNames]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => t.category && set.add(t.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  function handleDelete(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    emitDataChanged(["transactions", "budget", "accounts"]);
  }

  function handleUpdate(id: string, data: Partial<Transaction>) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    emitDataChanged(["transactions", "budget", "accounts"]);
  }

  /** Bangun URL export CSV untuk periode yang sedang aktif. Null jika
   * custom range belum lengkap. Export mengikuti periode (bukan filter
   * client) sehingga semua transaksi periode tsb ikut, bukan hanya 200 teratas. */
  function buildExportUrl(): string | null {
    if (period === "custom") {
      if (!customFrom || !customTo) return null;
      return `/api/export/csv?period=custom&from=${customFrom}&to=${customTo}`;
    }
    const opt = PERIOD_OPTIONS.find((o) => o.key === period);
    return `/api/export/csv?period=${encodeURIComponent(opt?.apiPeriod ?? "bulan ini")}`;
  }

  function handleExport() {
    const url = buildExportUrl();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const canExport = !loading && transactions.length > 0 && !(period === "custom" && (!customFrom || !customTo));

  const hasActiveFilters =
    typeFilter !== "all" || categoryFilter !== "" || accountFilter !== "" || searchQuery !== "";

  function clearFilters() {
    setTypeFilter("all");
    setCategoryFilter("");
    setAccountFilter("");
    setSearchQuery("");
  }

  return (
    <div className="flex w-full flex-col">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-mono text-primary">Ledger</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Transaksi
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Memuat..."
                : `${filtered.length} dari ${transactions.length} transaksi${hasActiveFilters ? " (terfilter)" : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport}
            title="Export semua transaksi periode ini ke CSV"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
        </div>

        <SectionCard eyebrow="Filter" title="Cari & saring" dense className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors",
                  period === opt.key
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <div className="mt-3 flex flex-col gap-2 text-[12.5px] sm:flex-row sm:flex-wrap sm:items-center">
              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Dari</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-foreground"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Sampai</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 rounded-lg border border-border bg-background px-2 text-foreground"
                />
              </label>
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari note atau kategori..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground"
            >
              <option value="all">Semua tipe</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground"
            >
              <option value="">Semua kategori</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground"
            >
              <option value="">Semua akun</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
              Reset filter
            </button>
          )}
        </SectionCard>

        <SectionCard eyebrow="Hasil" title="Daftar transaksi" dense>
          {loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-background px-5 py-12 text-center text-sm text-muted-foreground">
              {transactions.length === 0
                ? "Belum ada transaksi pada periode ini."
                : "Tidak ada transaksi yang cocok dengan filter."}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[20px] border border-border/70 bg-background">
              <div className="overflow-x-auto [scrollbar-width:thin]">
                <table className="w-full sm:min-w-[760px] sm:table-fixed">
                  <thead className="hidden sm:table-header-group">
                    <tr className="border-b border-border bg-muted/35">
                      <th className="label-mono w-[88px] px-5 py-3 text-left text-muted-foreground">
                        Tgl
                      </th>
                      <th className="label-mono w-[28%] py-3 pr-4 text-left text-muted-foreground">
                        Deskripsi
                      </th>
                      <th className="label-mono w-[18%] py-3 pr-4 text-left text-muted-foreground">
                        Kategori
                      </th>
                      <th className="label-mono hidden w-[18%] py-3 pr-4 text-left text-muted-foreground sm:table-cell">
                        Akun
                      </th>
                      <th className="label-mono w-[156px] py-3 pr-4 text-right text-muted-foreground">
                        Jumlah
                      </th>
                      <th className="w-[72px] py-3 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((t) => (
                      <TransactionCard
                        key={t.id}
                        transaction={t}
                        categories={categories}
                        accounts={accounts}
                        onDelete={handleDelete}
                        onUpdate={handleUpdate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-border bg-muted/20 p-3 md:flex-row md:items-center md:justify-between md:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-medium text-muted-foreground">
                    Tampilkan
                  </span>
                  {([10, 20, 50] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => setPageSize(n)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors",
                        pageSize === n
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <span className="text-[12.5px] font-medium text-muted-foreground">
                    {Math.min((page - 1) * pageSize + 1, filtered.length)}-
                    {Math.min(page * pageSize, filtered.length)} dari {filtered.length}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-full border border-border bg-background px-3 py-0.5 text-[14px] transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {"<"}
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="rounded-full border border-border bg-background px-3 py-0.5 text-[14px] transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {">"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
