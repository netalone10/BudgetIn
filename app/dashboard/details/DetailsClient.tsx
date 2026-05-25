"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/dashboard/SectionCard";
import type {
  Transaction,
  TransactionCategory,
} from "@/components/TransactionCard";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  aggregateDetails,
  applyDetailsFilters,
  toggleExpand,
  type DetailType,
  type DetailsFilters,
  type Period,
} from "@/lib/details-data";
import TypeTabs from "./TypeTabs";
import CategoryGroupList from "./CategoryGroupList";

// Reference: `TransactionCard` uses lightweight account objects with
// `id` + `name`. Keep an extended local shape so the account dropdown can
// render the same hints we have in `TransactionsClient`.
type Account = {
  id: string;
  name: string;
  currency?: string;
  accountType?: { name: string; classification: string };
};

// Server-side category row (matches `/api/categories` response — see
// `app/api/categories/route.ts`).
type ApiCategory = {
  id: string;
  name: string;
  type: string;
  isSavings?: boolean;
};

const PERIOD_OPTIONS: { key: Period; label: string; apiPeriod: string }[] = [
  { key: "today", label: "Hari ini", apiPeriod: "hari ini" },
  { key: "week", label: "Minggu ini", apiPeriod: "minggu ini" },
  { key: "month", label: "Bulan ini", apiPeriod: "bulan ini" },
  { key: "lastMonth", label: "Bulan lalu", apiPeriod: "bulan lalu" },
  { key: "custom", label: "Custom", apiPeriod: "custom" },
];

/** Map our internal `Period` union to the legacy Indonesian phrase used by
 *  `/api/record?period=...`. Mirrors `PERIOD_OPTIONS` in
 *  `app/dashboard/transactions/TransactionsClient.tsx`. */
function periodToApi(period: Period): string {
  const found = PERIOD_OPTIONS.find((p) => p.key === period);
  return found?.apiPeriod ?? "bulan ini";
}

/** Strict YYYY-MM-DD validation. Reuses the same regex as `/api/report` and
 *  `/api/record` (see `DATE_RE` in those routes) so all three layers agree on
 *  what counts as a "valid" date. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isValidIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00`);
  return !Number.isNaN(d.getTime());
}

/** Custom range is "valid" only when both endpoints are real dates and
 *  `from <= to`. String-compare works for ISO `YYYY-MM-DD`. */
function isValidCustomRange(from: string, to: string): boolean {
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return false;
  return from <= to;
}

type ErrorKind =
  | { kind: "token_expired" }
  | { kind: "network" }
  | null;

export default function DetailsClient() {
  const [, startTransition] = useTransition();

  // ── UI state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTabRaw] = useState<DetailType>("expense");
  const [period, setPeriod] = useState<Period>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // ── Data state ──────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [savingsSet, setSavingsSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind>(null);

  // Active-tab setter — silently ignores invalid values (Req 2.6) and skips
  // updates when the value is unchanged so we don't churn `expandedKeys`
  // (which is reset on tab change via the effect below).
  const setActiveTab = useCallback((next: DetailType) => {
    if (next !== "income" && next !== "expense") return;
    setActiveTabRaw((prev) => (prev === next ? prev : next));
  }, []);

  // ── Fetch helpers ───────────────────────────────────────────────────────
  // Track the latest in-flight request so we can abort the previous one
  // before kicking off a new fetch (Req 3.5 / Req 10.3).
  const inFlightRef = useRef<AbortController | null>(null);

  const fetchTx = useCallback(
    async (signal?: AbortSignal) => {
      // Custom range must be valid before we hit the network (Req 3.4) —
      // otherwise we display the helper text and leave `transactions` alone.
      if (period === "custom" && !isValidCustomRange(customFrom, customTo)) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const url =
        period === "custom"
          ? `/api/record?period=custom&from=${customFrom}&to=${customTo}`
          : `/api/record?period=${encodeURIComponent(periodToApi(period))}`;

      try {
        const res = await fetch(url, { cache: "no-store", signal });
        if (!res.ok) {
          if (res.status === 401) {
            // Token expired — surface the dedicated error UI (Req 10.1).
            try {
              const data = (await res.json()) as { error?: string };
              if (data?.error === "token_expired") {
                setError({ kind: "token_expired" });
                return;
              }
            } catch {
              // fall through to network error below
            }
            setError({ kind: "network" });
            return;
          }
          // Network / 5xx (Req 10.2)
          setError({ kind: "network" });
          return;
        }
        const data = (await res.json()) as { transactions?: Transaction[] };
        setTransactions(data.transactions ?? []);
      } catch (err) {
        // AbortError → leave state as-is, do not show error UI (Req 10.3).
        if ((err as Error)?.name === "AbortError") return;
        setError({ kind: "network" });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [period, customFrom, customTo],
  );

  // Driver effect: aborts the previous request, fires a fresh one whenever
  // the active range changes.
  useEffect(() => {
    const controller = new AbortController();
    inFlightRef.current?.abort();
    inFlightRef.current = controller;
    void fetchTx(controller.signal);
    return () => controller.abort();
  }, [fetchTx]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/accounts", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { accounts?: Account[] };
      setAccounts(data.accounts ?? []);
    } catch {
      // Non-fatal — filter dropdown just won't populate.
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { categories?: ApiCategory[] };
      const list = data.categories ?? [];
      setCategories(list.map((c) => ({ name: c.name, type: c.type })));
      // Mirror `/api/report/route.ts`: build the savings set from categories
      // flagged as `isSavings`, lowercased for case-insensitive comparison
      // by `isSavingsTransaction`.
      setSavingsSet(
        new Set(
          list
            .filter((c) => c.isSavings === true)
            .map((c) => c.name.toLowerCase()),
        ),
      );
    } catch {
      // Non-fatal — savings categories simply won't be excluded.
    }
  }, []);

  // Mount-only fetch for accounts + categories (parallel with the first
  // transactions fetch driven by the effect above).
  useEffect(() => {
    void fetchAccounts();
    void fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  // External data events — keep the page in sync with mutations elsewhere.
  useDataEvent(["transactions", "accounts", "categories"], (topic) => {
    if (topic === "transactions") {
      // Re-run for the active period; abort previous (Req 7.4 / Req 3.5).
      const controller = new AbortController();
      inFlightRef.current?.abort();
      inFlightRef.current = controller;
      void fetchTx(controller.signal);
    }
    if (topic === "accounts") void fetchAccounts();
    if (topic === "categories") void fetchCategories();
  });

  // Reset expansion whenever the visible window or active tab changes.
  // Spec: Req 2.5 (tab change) and Req 3.6 (period / custom range change).
  useEffect(() => {
    setExpandedKeys(new Set());
  }, [activeTab, period, customFrom, customTo]);

  // ── Derived data ────────────────────────────────────────────────────────
  const filteredTx = useMemo(
    () =>
      applyDetailsFilters(transactions, {
        period,
        customFrom,
        customTo,
        searchQuery,
        accountFilter,
        categoryFilter,
      } as DetailsFilters),
    [transactions, period, customFrom, customTo, searchQuery, accountFilter, categoryFilter],
  );

  const agg = useMemo(
    () => aggregateDetails(filteredTx, savingsSet),
    [filteredTx, savingsSet],
  );

  const incomeCount = useMemo(
    () => agg.incomeGroups.reduce((s, g) => s + g.count, 0),
    [agg.incomeGroups],
  );
  const expenseCount = useMemo(
    () => agg.expenseGroups.reduce((s, g) => s + g.count, 0),
    [agg.expenseGroups],
  );

  const groups = activeTab === "income" ? agg.incomeGroups : agg.expenseGroups;
  const tabTotal = activeTab === "income" ? agg.incomeTotal : agg.expenseTotal;
  const tabCount = activeTab === "income" ? incomeCount : expenseCount;

  // Category dropdown options derived from current transactions, like
  // `TransactionsClient` does. Mixed types are fine — the dropdown is global
  // (filters apply before splitting into income/expense groups).
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => t.category && set.add(t.category));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const customRangeInvalid =
    period === "custom" && !isValidCustomRange(customFrom, customTo);

  const hasActiveFilters =
    searchQuery !== "" || accountFilter !== "" || categoryFilter !== "";
  const noFilteredMatches =
    !loading &&
    !error &&
    !customRangeInvalid &&
    transactions.length > 0 &&
    filteredTx.length === 0;

  // ── Mutation handlers ───────────────────────────────────────────────────
  const handleDeleteTx = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    emitDataChanged(["transactions", "budget", "accounts"]);
  }, []);

  const handleUpdateTx = useCallback(
    (id: string, data: Partial<Transaction>) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...data } : t)),
      );
      emitDataChanged(["transactions", "budget", "accounts"]);
    },
    [],
  );

  const handleToggleCategory = useCallback((cat: string) => {
    setExpandedKeys((prev) => toggleExpand(prev, cat));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setAccountFilter("");
    setCategoryFilter("");
  }, []);

  const retryFetch = useCallback(() => {
    const controller = new AbortController();
    inFlightRef.current?.abort();
    inFlightRef.current = controller;
    void fetchTx(controller.signal);
  }, [fetchTx]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <TypeTabs
        active={activeTab}
        onChange={setActiveTab}
        incomeTotal={agg.incomeTotal}
        expenseTotal={agg.expenseTotal}
        incomeCount={incomeCount}
        expenseCount={expenseCount}
      />

      <SectionCard eyebrow="Filter" title="Cari & saring" dense>
        {/* Period pills (mirrors TransactionsClient) */}
        <div className="flex flex-wrap items-center gap-2">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => startTransition(() => setPeriod(opt.key))}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors",
                period === opt.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-pressed={period === opt.key}
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
                aria-invalid={customRangeInvalid || undefined}
                aria-describedby={
                  customRangeInvalid ? "details-custom-range-help" : undefined
                }
              />
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Sampai</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-foreground"
                aria-invalid={customRangeInvalid || undefined}
                aria-describedby={
                  customRangeInvalid ? "details-custom-range-help" : undefined
                }
              />
            </label>
            {customRangeInvalid && (
              <p
                id="details-custom-range-help"
                role="alert"
                className="basis-full text-xs text-destructive"
              >
                Pilih tanggal mulai dan akhir yang valid.
              </p>
            )}
          </div>
        )}

        {/* Filter bar grid: 1 col mobile, 2–4 cols on tablet/desktop (Req 12.2) */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari note atau kategori..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground"
              aria-label="Cari transaksi"
            />
          </div>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground"
            aria-label="Filter akun"
          >
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground"
            aria-label="Filter kategori"
          >
            <option value="">Semua kategori</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-border bg-background px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
              Reset filter
            </button>
          )}
        </div>
      </SectionCard>

      {/* Inline summary strip — total + count for the active tab (Req 8.1) */}
      <SectionCard
        eyebrow={activeTab === "income" ? "Pemasukan" : "Pengeluaran"}
        title={
          error
            ? "Ringkasan tidak tersedia"
            : `${formatIDR(tabTotal)} · ${tabCount} transaksi`
        }
        description={
          loading
            ? "Memuat data periode aktif..."
            : error
              ? "Terjadi gangguan saat memuat ringkasan."
              : `Periode aktif: ${PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? "Bulan ini"}.`
        }
        dense
      >
        {error?.kind === "token_expired" ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <p>Sesi expired. Silakan login ulang.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void signOut({ callbackUrl: "/login" })}
            >
              Logout & login ulang
            </Button>
          </div>
        ) : error?.kind === "network" ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border/70 bg-background px-4 py-6 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p>Gagal memuat data. Periksa koneksi atau coba lagi sebentar.</p>
            <Button type="button" variant="outline" size="sm" onClick={retryFetch}>
              Coba lagi
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
            <div className="h-12 animate-pulse rounded-2xl bg-muted" />
          </div>
        ) : noFilteredMatches ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border/70 bg-background px-5 py-10 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p>Tidak ada transaksi yang cocok dengan filter.</p>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              Reset filter
            </Button>
          </div>
        ) : (
          <CategoryGroupList
            groups={groups}
            type={activeTab}
            expandedKeys={expandedKeys}
            onToggle={handleToggleCategory}
            categories={categories}
            accounts={accounts}
            onDeleteTx={handleDeleteTx}
            onUpdateTx={handleUpdateTx}
          />
        )}
      </SectionCard>
    </div>
  );
}

// `Transaction` and `TransactionCategory` are imported above as type-only;
// the actual `TransactionCard` component is rendered by `CategoryGroupList`.
