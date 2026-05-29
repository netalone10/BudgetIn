"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { BudgetData as DashboardTabsBudgetData } from "@/components/DashboardTabs";
import type { Transaction, TransactionCategory } from "@/components/TransactionCard";
import type { ManualTransactionCreated } from "@/components/ManualTransactionForm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  SendHorizonal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  MicVocal,
  LayoutGrid,
  Dices,
  X,
} from "lucide-react";
import NetWorthSummaryCard from "@/components/NetWorthSummaryCard";
import { cn } from "@/lib/utils";
import { format } from "date-fns/format";
import { toZonedTime } from "date-fns-tz";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import { isSavingsTransaction } from "@/lib/savings-utils";
import { formatSignedIDR, formatTanggalID } from "@/lib/format";
import type { DashboardInitialData } from "@/lib/dashboard-data";
import { measureTiming, checkThresholdBreach } from "@/lib/performance";
import DashboardGreeting from "@/components/dashboard/DashboardGreeting";
import KPICard from "@/components/dashboard/KPICard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import RunwayKasCard from "@/components/dashboard/RunwayKasCard";

// ---------------------------------------------------------------------------
// SWR (Stale-While-Revalidate) utilities for client-side fetching
// ---------------------------------------------------------------------------

/** Stored ETags per endpoint for conditional requests */
interface ETagStore {
  [endpoint: string]: string;
}

/**
 * Performs a fetch with SWR semantics:
 * - Sends If-None-Match header with last known ETag
 * - On 304 response, returns null (caller keeps current data)
 * - On success, extracts and stores the new ETag
 * - Never throws on network errors — returns null for graceful degradation
 */
async function swrFetch<T>(
  url: string,
  etagStore: React.MutableRefObject<ETagStore>
): Promise<{ data: T; etag: string | null } | null> {
  try {
    const headers: HeadersInit = { "Cache-Control": "no-cache" };
    const lastEtag = etagStore.current[url];
    if (lastEtag) {
      headers["If-None-Match"] = lastEtag;
    }

    const res = await fetch(url, { headers });

    // 304 Not Modified — current data is still fresh
    if (res.status === 304) {
      return null;
    }

    if (res.status === 401) {
      const data = await res.json();
      if (data.error === "token_expired") {
        return { data: data as T, etag: null };
      }
      return null;
    }

    if (!res.ok) return null;

    const etag = res.headers.get("etag");
    if (etag) {
      etagStore.current[url] = etag;
    }

    const data = (await res.json()) as T;
    return { data, etag };
  } catch {
    // Network error — graceful degradation, keep stale data
    return null;
  }
}

// Below-the-fold components: lazy loaded with skeleton placeholders to reduce initial bundle
const RecentTransactionsCard = dynamic(
  () => import("@/components/dashboard/RecentTransactionsCard"),
  {
    ssr: false,
    loading: () => <RecentTransactionsSkeleton />,
  }
);

const MiniCashflowCard = dynamic(
  () => import("@/components/dashboard/MiniCashflowCard"),
  {
    ssr: false,
    loading: () => <MiniCashflowSkeleton />,
  }
);

const BudgetMiniListCard = dynamic(
  () => import("@/components/dashboard/BudgetMiniListCard"),
  {
    ssr: false,
    loading: () => <BudgetMiniListSkeleton />,
  }
);

const SavingsGoalMiniCard = dynamic(
  () => import("@/components/dashboard/SavingsGoalMiniCard"),
  {
    ssr: false,
    loading: () => <SavingsGoalSkeleton />,
  }
);

// Modal/dialog components: dynamically imported only when user triggers the action.
// Preloaded on mount so the chunk is ready before the user clicks "Manual Form".
const ManualTransactionForm = dynamic(
  () => import("@/components/ManualTransactionForm"),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-[28px] bg-muted" /> }
);
// Kick off the chunk download immediately — no await, fire-and-forget.
(ManualTransactionForm as any).preload?.();

const ReportView = dynamic(
  () => import("@/components/ReportView"),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-[28px] bg-muted" /> }
);

// Skeleton placeholders matching expected component dimensions to prevent layout shift

function RecentTransactionsSkeleton() {
  return (
    <div className="rounded-[22px] border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="size-9 shrink-0 animate-pulse rounded-[10px] bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
            </div>
            <div className="space-y-1.5 text-right">
              <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-muted" />
              <div className="ml-auto h-2.5 w-12 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniCashflowSkeleton() {
  return (
    <div className="rounded-[22px] border border-border/60 bg-card p-4">
      <div className="mb-2 space-y-1">
        <div className="h-2.5 w-14 animate-pulse rounded bg-muted" />
        <div className="h-4 w-36 animate-pulse rounded bg-muted" />
      </div>
      <div className="mb-3.5 grid grid-cols-2 gap-2">
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="flex h-[72px] items-end gap-2 px-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-end justify-center gap-1 h-[58px]">
              <div className="w-[44%] animate-pulse rounded-t-md bg-muted" style={{ height: `${20 + i * 8}px` }} />
              <div className="w-[44%] animate-pulse rounded-t-md bg-muted" style={{ height: `${15 + i * 6}px` }} />
            </div>
            <div className="h-2 w-5 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="mt-3 h-10 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function BudgetMiniListSkeleton() {
  return (
    <div className="rounded-[22px] border border-border/60 bg-card p-4">
      <div className="mb-2 space-y-1">
        <div className="h-2.5 w-12 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
              <div className="h-4 w-14 animate-pulse rounded-full bg-muted" />
            </div>
            <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SavingsGoalSkeleton() {
  return (
    <div className="rounded-[22px] border border-border/60 bg-card p-4">
      <div className="mb-2 space-y-1">
        <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-center gap-4">
        <div className="size-[86px] shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="mt-3 h-9 animate-pulse rounded-xl border border-dashed border-border/70 bg-muted/40" />
    </div>
  );
}

type BudgetData = DashboardTabsBudgetData;

type TxDetails = { date: string; time?: string; category: string; amount: number; accountName?: string; note?: string; savingsGoalName?: string; contributionStatus?: string; accountCreated?: string };
type BulkDetails = { date: string; time?: string; accountName?: string; total: number; count: number; accountCreated?: string; failedCount?: number; failedItems?: { category: string; amount: number; error: string }[] };
type BudgetDetails = { category: string; amount: number; month: string };
type TransferDetails = { date: string; time?: string; amount: number; fee: number; fromAccountName: string; toAccountName: string; note?: string; accountCreated?: string };
type SavingsPendingAction = {
  type: "savings_contribution";
  amount: number;
  accountName?: string;
  date?: string;
  category?: string;
  note?: string;
};
type SavingsGoalOption = { id: string; label: string; description: string };

type ResponseData =
  | { intent: "transaksi"; transaction: Transaction; message: string; details?: TxDetails }
  | { intent: "transaksi_bulk"; transactions: Transaction[]; message: string; details?: BulkDetails }
  | { intent: "pemasukan"; transaction: Transaction; amount: number; category: string; message: string; details?: TxDetails }
  | { intent: "budget_setting"; category: string; amount: number; month: string; message: string; details?: BudgetDetails }
  | { intent: "laporan"; period: string; totalSpent: number; spentByCategory: Record<string, number>; budgets: { category: string; budget: number; spent: number }[]; summary: string; transactionCount: number }
  | { intent: "transfer"; message: string; details?: TransferDetails }
  | { intent: "unknown"; clarification: string; clarificationType?: string; pendingAction?: SavingsPendingAction; options?: SavingsGoalOption[] }
  | { error: string };

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );
}

function DetailsGrid({ children, tone }: { children: ReactNode; tone: "green" | "blue" }) {
  const colorClass =
    tone === "blue"
      ? "text-blue-700 dark:text-blue-400"
      : "text-green-700 dark:text-green-400";

  return (
    <dl className={cn("mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs", colorClass)}>
      {children}
    </dl>
  );
}

const PROMPT_EXAMPLES = [
  "beli makan siang 35rb dari BCA",
  "gaji 8jt masuk ke BNI",
  "bayar listrik 250rb cash",
  "transfer 1jt dari BCA ke BNI",
  "rekap bulan ini",
  "kopi dan pastry 42rb pakai GoPay",
  "isi bensin 150rb lalu tol 23rb dari BCA",
  "budget makan 1.2jt bulan ini",
  "berapa pengeluaran minggu ini",
  "bayar Spotify 69rb pakai kartu kredit",
  "top up dana darurat 500rb ke Jago",
  "freelance 2.5jt masuk ke BCA",
  "ringkas kategori pengeluaran terbesar bulan ini",
  "makan malam ramen 67rb pakai kartu kredit BNI",
  "belanja bulanan 315rb dari BCA",
  "parkir 10rb cash",
  "Grab ke kantor 28rb dari GoPay",
  "bayar internet 350rb dari BCA",
  "tagihan air 125rb cash",
  "transfer 500rb dari GoPay ke BCA",
  "pindahkan 3jt dari BCA ke Jago Savings",
  "bayar cicilan kartu kredit 450rb dari BCA",
  "tabungan liburan 750rb ke Jago",
  "investasi 2jt dari BCA",
  "set budget transport 750rb bulan ini",
  "set budget hiburan 400rb",
  "naikkan budget makan jadi 1.5jt",
  "berapa sisa budget makan bulan ini",
  "kategori mana yang paling boros minggu ini",
  "bandingkan pengeluaran minggu ini vs minggu lalu",
  "buat laporan cashflow bulan ini",
  "berapa total pemasukan hari ini",
  "pengeluaran terbesar bulan ini apa saja",
  "cek tagihan yang jatuh tempo minggu ini",
  "berapa saldo akun BCA sekarang",
  "berapa net worth saya saat ini",
  "koreksi saldo BCA jadi 12.5jt",
  "saldo awal GoPay 300rb",
  "THR 4jt masuk ke BCA",
  "bonus proyek 1.8jt masuk ke Jago",
  "obat dan vitamin 125rb dari BCA",
  "belanja hadiah 220rb pakai kartu kredit",
  "minta insight pengeluaran makan saya",
  "sarapan 18rb, kopi 22rb, parkir 5rb cash",
  "refund tiket 175rb masuk ke BCA",
  "bayar kos 1.8jt dari Mandiri",
  "top up e-wallet 300rb dari BNI",
  "tarik tunai 500rb dari BCA ke cash",
  "bayar pajak motor 425rb dari BCA",
  "beli pulsa 50rb pakai GoPay",
  "donasi 100rb dari Jago",
  "dividen 240rb masuk ke Mandiri Sekuritas",
  "berapa uang keluar hari ini",
  "buat ringkasan tabungan bulan ini",
  "cek budget transport minggu ini",
];

interface DashboardClientProps {
  initialData: DashboardInitialData;
  /** Controls which sections to render for streaming Suspense boundaries.
   * - "kpi-only": Renders KPI cards (net worth, income, expense, savings rate) — streams first
   * - "secondary-only": Renders greeting, input, transactions, budget sidebar — streams after
   * - undefined: Renders everything (fallback for non-streaming usage)
   */
  renderMode?: "kpi-only" | "secondary-only";
}

export default function DashboardClient({ initialData, renderMode }: DashboardClientProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>(initialData.transactions);
  const [txLoading, setTxLoading] = useState(false);

  const [budgetData, setBudgetData] = useState<BudgetData | null>(initialData.budgetData);
  const [budgetLoading, setBudgetLoading] = useState(false);

  // Background revalidation indicator — true only during silent SWR refetches
  const [isRevalidating, setIsRevalidating] = useState(false);
  // Track in-flight silent fetches to coordinate the shared indicator
  const revalidatingCountRef = useRef(0);

  const [transactionCategories, setTransactionCategories] = useState<TransactionCategory[]>(() =>
    initialData.categories.map((c) => ({ name: c.name, type: c.type }))
  );
  const [savingsCategoryNames, setSavingsCategoryNames] = useState<Set<string>>(() =>
    new Set(initialData.savingsCategoryNames)
  );
  const [accounts, setAccounts] = useState<
    {
      id: string;
      name: string;
      currency: string;
      accountType: { name: string; classification: string };
      currentBalance?: string | null;
    }[]
  >(initialData.accounts);
  const [accountVersion, setAccountVersion] = useState(0);
  const [promptExamples, setPromptExamples] = useState(() => PROMPT_EXAMPLES.slice(0, 8));
  const [inputMode, setInputMode] = useState<"ai" | "manual">("ai");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // SWR: ETag store for conditional requests across all endpoints
  const etagStoreRef = useRef<ETagStore>({});

  const todayStr = format(toZonedTime(new Date(), "Asia/Jakarta"), "yyyy-MM-dd");
  const todayStats = useMemo(() => {
    const todayTxs = transactions.filter((t) => t.date === todayStr);
    const expenseTxs = todayTxs.filter(isExpenseTransaction);
    const incomeTxs = todayTxs.filter((t) => t.type === "income");
    const expense = expenseTxs.reduce((s, t) => s + t.amount, 0);
    const income = incomeTxs.reduce((s, t) => s + t.amount, 0);
    const count = expenseTxs.length;
    const incomeCount = incomeTxs.length;
    return { expense, income, count, incomeCount };
  }, [transactions, todayStr]);

  const currentMonth = todayStr.slice(0, 7);
  const monthlyStats = useMemo(() => {
    const inMonth = transactions.filter((t) => t.date.startsWith(currentMonth));
    let income = 0;
    let expense = 0;
    for (const t of inMonth) {
      // Sejajar dengan reports/rincian: skip Saldo Awal & tabungan/investasi.
      if (t.category === "Saldo Awal") continue;
      if (t.type === "income") {
        income += t.amount;
        continue;
      }
      if (!isExpenseTransaction(t)) continue;
      if (isSavingsTransaction(t.category, savingsCategoryNames)) continue;
      expense += t.amount;
    }
    const surplus = income - expense;
    const savingsRate = income > 0 ? (surplus / income) * 100 : 0;
    return { income, expense, surplus, savingsRate };
  }, [transactions, currentMonth, savingsCategoryNames]);

  const categoryBreakdown = useMemo(() => {
    const inMonth = transactions.filter((t) => t.date.startsWith(currentMonth));
    const expenseByCat = new Map<string, number>();
    const incomeByCat = new Map<string, number>();
    for (const t of inMonth) {
      // Sejajar dengan reports/rincian: skip Saldo Awal & tabungan/investasi.
      if (t.category === "Saldo Awal") continue;
      if (t.type === "income") {
        incomeByCat.set(t.category, (incomeByCat.get(t.category) ?? 0) + t.amount);
        continue;
      }
      if (!isExpenseTransaction(t)) continue;
      if (isSavingsTransaction(t.category, savingsCategoryNames)) continue;
      expenseByCat.set(t.category, (expenseByCat.get(t.category) ?? 0) + t.amount);
    }
    const toSorted = (m: Map<string, number>) =>
      Array.from(m, ([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount);
    return {
      expense: toSorted(expenseByCat),
      income: toSorted(incomeByCat),
      totalExpense: monthlyStats.expense,
      totalIncome: monthlyStats.income,
    };
  }, [transactions, currentMonth, savingsCategoryNames, monthlyStats.expense, monthlyStats.income]);

  const runway = useMemo(() => {
    const liquid = accounts.reduce((sum, acc) => {
      if (acc.accountType?.classification !== "asset") return sum;
      const raw = acc.currentBalance;
      if (raw == null) return sum;
      const n = typeof raw === "number" ? raw : parseFloat(raw);
      if (!Number.isFinite(n)) return sum;
      return sum + n;
    }, 0);

    const currentExpense = monthlyStats.expense;
    const lastExpense = initialData.lastMonthTotals.expense;
    const avgBurn = (currentExpense + lastExpense) / 2;
    const months =
      avgBurn > 0 ? liquid / avgBurn : Number.POSITIVE_INFINITY;

    return { liquid, avgBurn, months };
  }, [accounts, monthlyStats.expense, initialData.lastMonthTotals.expense]);

  const incomeDelta = monthlyStats.income - initialData.lastMonthTotals.income;
  const expenseDelta = monthlyStats.expense - initialData.lastMonthTotals.expense;

  function focusAIWithIntent(kind: "expense" | "income" | "transfer") {
    const presets: Record<typeof kind, string> = {
      expense: "Pengeluaran ",
      income: "Pemasukan ",
      transfer: "Transfer ",
    };
    setPrompt(presets[kind]);
    textareaRef.current?.focus();
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  useEffect(() => {
    // Measure Dashboard Time to Interactive (TTI)
    // The component has mounted with initialData already rendered
    const stopTiming = measureTiming("dashboard-tti");
    // Use requestAnimationFrame to ensure the browser has painted
    requestAnimationFrame(() => {
      const duration = stopTiming();
      const breach = checkThresholdBreach("dashboard-tti", duration);
      if (breach) {
        console.warn(breach.message);
      }
    });
  }, []);

  useEffect(() => {
    const handleCategoryChange = () => fetchCategories();
    window.addEventListener("categoriesChanged", handleCategoryChange);
    return () => window.removeEventListener("categoriesChanged", handleCategoryChange);
  }, []);

  useDataEvent(["transactions", "budget", "accounts", "categories"], (topic) => {
    if (topic === "transactions") fetchTransactions(true);
    if (topic === "budget") fetchBudget(true);
    if (topic === "accounts") fetchAccounts(true);
    if (topic === "categories") fetchCategories();
  });

  async function fetchCategories() {
    try {
      const result = await swrFetch<{ categories?: { name: string; type: string; isSavings?: boolean }[] }>(
        "/api/categories",
        etagStoreRef
      );
      if (!result) return; // 304 or error — keep stale data
      const cats = result.data.categories ?? [];
      setTransactionCategories(
        cats.map((c) => ({ name: c.name, type: c.type }))
      );
      const savingsNames = new Set<string>(
        cats
          .filter((c) => c.isSavings)
          .map((c) => c.name.toLowerCase())
      );
      setSavingsCategoryNames(savingsNames);
    } catch {
      // ignore — keep stale data (SWR graceful degradation)
    }
  }

  /**
   * SWR-enhanced transaction fetch.
   * - Shows stale data immediately (already in state from initialData)
   * - Refetches in background without loading spinners
   * - Sends If-None-Match header; handles 304 by keeping current data
   * @param silent - When true (default for background refetches), no loading spinner shown
   */
  async function fetchTransactions(silent = true) {
    if (!silent) {
      setTxLoading(true);
    } else {
      revalidatingCountRef.current += 1;
      setIsRevalidating(true);
    }
    try {
      const result = await swrFetch<{ transactions?: Transaction[]; error?: string }>(
        "/api/record?period=bulan+ini",
        etagStoreRef
      );
      if (!result) return; // 304 or network error — keep stale data
      if (result.data.error === "token_expired") {
        setResponse({ error: "Sesi Google expired. Silakan logout lalu login ulang." });
        return;
      }
      setTransactions(result.data.transactions ?? []);
    } catch {
      // ignore — keep stale data
    } finally {
      if (!silent) {
        setTxLoading(false);
      } else {
        revalidatingCountRef.current -= 1;
        if (revalidatingCountRef.current <= 0) {
          revalidatingCountRef.current = 0;
          setIsRevalidating(false);
        }
      }
    }
  }

  /**
   * SWR-enhanced budget fetch.
   * Background refetch without loading spinners by default.
   */
  async function fetchBudget(silent = true) {
    if (!silent) {
      setBudgetLoading(true);
    } else {
      revalidatingCountRef.current += 1;
      setIsRevalidating(true);
    }
    try {
      const result = await swrFetch<BudgetData>("/api/budget", etagStoreRef);
      if (!result) return; // 304 or error — keep stale data
      setBudgetData(result.data);
    } catch {
      // ignore — keep stale data
    } finally {
      if (!silent) {
        setBudgetLoading(false);
      } else {
        revalidatingCountRef.current -= 1;
        if (revalidatingCountRef.current <= 0) {
          revalidatingCountRef.current = 0;
          setIsRevalidating(false);
        }
      }
    }
  }

  /**
   * SWR-enhanced accounts fetch.
   * Background refetch without loading spinners.
   */
  async function fetchAccounts(silent = true) {
    if (silent) {
      revalidatingCountRef.current += 1;
      setIsRevalidating(true);
    }
    try {
      const result = await swrFetch<{ accounts?: typeof accounts }>(
        "/api/accounts",
        etagStoreRef
      );
      if (!result) return; // 304 or error — keep stale data
      setAccounts(result.data.accounts ?? []);
      setAccountVersion((v) => v + 1);
    } catch {
      // ignore — keep stale data
    } finally {
      if (silent) {
        revalidatingCountRef.current -= 1;
        if (revalidatingCountRef.current <= 0) {
          revalidatingCountRef.current = 0;
          setIsRevalidating(false);
        }
      }
    }
  }

  async function handleManualRefresh() {
    await Promise.all([
      fetchTransactions(false),
      fetchBudget(false),
      fetchAccounts(false),
      fetchCategories(),
    ]);
  }

  async function submitRecord(body: { prompt: string; pendingAction?: SavingsPendingAction; selectedGoalId?: string }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch("/api/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setResponse(null);
    const stopTiming = measureTiming("transaction-create");

    // Snapshot current state for rollback on error (optimistic update support)
    const prevTransactions = transactions;
    const prevBudgetData = budgetData;
    const prevAccounts = accounts;

    try {
      const res = await submitRecord({ prompt: prompt.trim() });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMsg = "Server error. Coba lagi.";
        try {
          errMsg = JSON.parse(text)?.error ?? errMsg;
        } catch {
          // ignore
        }
        setResponse({ error: errMsg });
        return;
      }

      const data = await res.json();
      setResponse(data);

      if ((data.intent === "transaksi" || data.intent === "pemasukan") && data.transaction) {
        // Optimistic update: immediately add the transaction to local state
        setTransactions((prev) => [data.transaction, ...prev]);
        // Background refetch budget and accounts (SWR: no loading spinners)
        // These run in background — if they fail, stale data remains visible
        fetchBudget().catch(() => {
          // Rollback not needed for budget — stale data is acceptable
        });
        fetchAccounts().catch(() => {
          // Rollback not needed for accounts — stale data is acceptable
        });
        emitDataChanged(["transactions", "budget", "accounts"]);
      }

      if (data.intent === "transaksi_bulk" && data.transactions?.length) {
        // Optimistic update: immediately add all transactions to local state
        setTransactions((prev) => [...data.transactions, ...prev]);
        // Background refetch (SWR: silent, no loading spinners)
        fetchBudget().catch(() => {});
        fetchAccounts().catch(() => {});
        emitDataChanged(["transactions", "budget", "accounts"]);
      }

      if (data.intent === "transfer") {
        // For transfers, we need fresh data — refetch in background (SWR: silent)
        fetchTransactions().catch(() => {});
        fetchBudget().catch(() => {});
        fetchAccounts().catch(() => {});
        emitDataChanged(["transactions", "budget", "accounts"]);
      }

      if (data.intent === "budget_setting") {
        // Background refetch (SWR: silent, no loading spinners)
        fetchBudget().catch(() => {});
        emitDataChanged(["budget", "categories"]);
        fetchCategories();
      }

      if (data.intent !== "unknown") setPrompt("");
      textareaRef.current?.focus();
    } catch {
      // Network error — rollback optimistic updates
      setTransactions(prevTransactions);
      setBudgetData(prevBudgetData);
      setAccounts(prevAccounts);
      setResponse({ error: "Koneksi gagal. Coba lagi." });
    } finally {
      const duration = stopTiming();
      const breach = checkThresholdBreach("transaction-create", duration);
      if (breach) {
        console.warn(breach.message);
      }
      setLoading(false);
    }
  }

  async function handleSavingsGoalSelect(goalId: string) {
    if (!response || "error" in response || response.intent !== "unknown" || !response.pendingAction) return;
    setLoading(true);

    // Snapshot for rollback
    const prevTransactions = transactions;

    try {
      const res = await submitRecord({
        prompt: prompt.trim() || response.pendingAction.note || "nabung",
        pendingAction: response.pendingAction,
        selectedGoalId: goalId,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMsg = "Server error. Coba lagi.";
        try {
          errMsg = JSON.parse(text)?.error ?? errMsg;
        } catch {
          // ignore
        }
        setResponse({ error: errMsg });
        return;
      }

      const data = await res.json();
      setResponse(data);
      if ((data.intent === "transaksi" || data.intent === "pemasukan") && data.transaction) {
        // Optimistic update: immediately add transaction
        setTransactions((prev) => [data.transaction, ...prev]);
        // Background refetch (SWR: silent, no loading spinners)
        fetchBudget().catch(() => {});
        fetchAccounts().catch(() => {});
        emitDataChanged(["transactions", "budget", "accounts"]);
      }
      setPrompt("");
    } catch {
      // Rollback optimistic update on network error
      setTransactions(prevTransactions);
      setResponse({ error: "Koneksi gagal. Coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const handleDeleteTx = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    emitDataChanged(["transactions", "budget", "accounts"]);
  }, []);

  const handleUpdateTx = useCallback((id: string, data: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    emitDataChanged(["transactions", "budget", "accounts"]);
  }, []);

  // Ref to hold the pre-optimistic-update snapshot for rollback when POST fails.
  const manualTxRollbackRef = useRef<Transaction[] | null>(null);

  const handleManualTransactionCreated = useCallback((created?: ManualTransactionCreated) => {
    // No optimistic data — fall back to background refetch.
    if (!created) {
      fetchTransactions();
      fetchBudget();
      fetchAccounts();
      return;
    }

    const nowIso = new Date().toISOString();
    const tempStamp = Date.now();
    const fromName = accounts.find((a) => a.id === created.accountId)?.name ?? null;
    const toName = accounts.find((a) => a.id === created.toAccountId)?.name ?? null;
    const optimistic: Transaction[] = [];

    if (created.type === "expense" || created.type === "income") {
      optimistic.push({
        id: created.transactionId ?? `temp-${tempStamp}`,
        date: created.date,
        time: created.time,
        amount: created.amount,
        category: created.category,
        note: created.note,
        created_at: nowIso,
        type: created.type,
        accountId: created.accountId,
        fromAccountId: created.accountId,
        fromAccountName: fromName,
      });
    } else if (created.type === "transfer") {
      optimistic.push({
        id: created.transactionId ?? `temp-out-${tempStamp}`,
        date: created.date,
        time: created.time,
        amount: created.amount,
        category: "Transfer",
        note: created.note,
        created_at: nowIso,
        type: "transfer_out",
        accountId: created.accountId,
        fromAccountId: created.accountId,
        fromAccountName: fromName,
        toAccountId: created.toAccountId,
        toAccountName: toName,
      });
      optimistic.push({
        id: `temp-in-${tempStamp}`,
        date: created.date,
        time: created.time,
        amount: created.amount,
        category: "Transfer",
        note: created.note,
        created_at: nowIso,
        type: "transfer_in",
        accountId: created.toAccountId,
        fromAccountId: created.accountId,
        fromAccountName: fromName,
        toAccountId: created.toAccountId,
        toAccountName: toName,
      });
      if (created.fee > 0) {
        optimistic.push({
          id: created.feeTransactionId ?? `temp-fee-${tempStamp}`,
          date: created.date,
          time: created.time,
          amount: created.fee,
          category: "Biaya Admin",
          note: created.note,
          created_at: nowIso,
          type: "expense",
          accountId: created.accountId,
          fromAccountId: created.accountId,
          fromAccountName: fromName,
        });
      }
    }

    if (optimistic.length > 0) {
      // Snapshot current transactions BEFORE applying optimistic update so we
      // can roll back if the POST fails (see handleManualTransactionError below).
      manualTxRollbackRef.current = transactions;
      setTransactions((prev) => [...optimistic, ...prev]);
    }
    // Background refetch is triggered by the form's emitDataChanged() after
    // the POST resolves (see useDataEvent listener above). No need to refetch here.
  }, [accounts, transactions]);

  const handleManualTransactionError = useCallback((_message: string) => {
    // Roll back optimistic rows to the snapshot taken before the update.
    if (manualTxRollbackRef.current !== null) {
      setTransactions(manualTxRollbackRef.current);
      manualTxRollbackRef.current = null;
    }
  }, []);

  /**
   * Reconcile a temp ID with the real server ID after POST succeeds.
   * Replaces the optimistic row's temp ID so delete/edit operations use the valid ID.
   */
  const handleReconcile = useCallback((tempId: string, serverId: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === tempId ? { ...t, id: serverId } : t))
    );
  }, []);

  const dataLoading = txLoading || budgetLoading;

  function randomizePromptExamples() {
    const shuffled = [...PROMPT_EXAMPLES]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
    setPromptExamples(shuffled);
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 md:gap-8 lg:gap-10">
      {/* Greeting — always first for warm welcome */}
      {renderMode !== "secondary-only" && (
        <DashboardGreeting
          userName={initialData.user?.name}
          todayStats={todayStats}
          onQuickAction={focusAIWithIntent}
          onRefresh={handleManualRefresh}
          refreshing={dataLoading}
          isRevalidating={isRevalidating && !txLoading && !budgetLoading}
        />
      )}

      {/* KPI Section: KPI cards grid — streams first */}
      {renderMode !== "secondary-only" && (
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <NetWorthSummaryCard refreshTrigger={accountVersion} compact />
          <KPICard
            type="income"
            label="Pemasukan Bulan Ini"
            value={monthlyStats.income}
            delta={incomeDelta}
          />
          <KPICard
            type="expense"
            label="Pengeluaran Bulan Ini"
            value={monthlyStats.expense}
            delta={expenseDelta}
            expenseSemantics
          />
          <KPICard
            type="savings"
            label="Savings Rate"
            value={monthlyStats.savingsRate}
            suffix="%"
            trendLabel={`${formatSignedIDR(monthlyStats.surplus, "+")} surplus bulan ini`}
          />
        </div>
      )}

      {/* Secondary Section: Input + Transactions + Budget — streams progressively */}
      {renderMode !== "kpi-only" && (
        <>
          <div className="grid min-w-0 items-start gap-5 md:gap-6 lg:grid-cols-[1.62fr_1fr]">
            <div className="flex min-w-0 flex-col gap-5 md:gap-6">
              <SectionCard
                eyebrow="Input · AI Capture"
                title="Tulis seperti ngobrol"
              >
        <div className="mb-4 grid min-w-0 grid-cols-2 gap-1 rounded-[14px] bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setInputMode("ai")}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-all",
              inputMode === "ai"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span aria-hidden>🤖</span>
            AI Mode
          </button>
          <button
            type="button"
            onClick={() => setInputMode("manual")}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-all",
              inputMode === "manual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span aria-hidden>📝</span>
            Manual Form
          </button>
        </div>

        {inputMode === "ai" ? (
          <div className="space-y-4">
            <div className="rounded-[22px] border border-border/70 bg-background p-4">
              <div className="mb-3 flex min-w-0 items-center gap-2">
                <MicVocal className="size-4 shrink-0 text-primary" />
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                  AI Capture
                </p>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                  Enter untuk kirim
                </span>
              </div>

              <form onSubmit={handleSubmit} className="min-w-0 space-y-3">
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    placeholder='Contoh: "Makan siang 35rb" atau "Rekap bulan ini"'
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={5}
                    className="min-h-[132px] resize-y rounded-[18px] border-border/70 bg-card pr-14 pt-4 shadow-none focus-visible:ring-primary"
                    disabled={loading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!prompt.trim() || loading}
                    className="absolute bottom-3 right-3 size-11 rounded-lg shadow-md transition-transform hover:-translate-y-px"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <SendHorizonal className="size-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Coba:</span>
                    <button
                      type="button"
                      onClick={randomizePromptExamples}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Acak saran prompt"
                    >
                      <Dices className="size-3" />
                      Acak
                    </button>
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {promptExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setPrompt(example);
                        textareaRef.current?.focus();
                      }}
                      className="cursor-pointer rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {example}
                    </button>
                  ))}
                </div>

                <p className="px-1 text-[12px] font-medium text-muted-foreground">
                  Enter untuk kirim. Shift+Enter untuk baris baru.
                </p>
              </form>
            </div>

            {response && (
              <div className="relative rounded-[22px] border border-border/70 bg-background p-3 sm:rounded-[28px] sm:p-4">
                <button
                  type="button"
                  onClick={() => setResponse(null)}
                  aria-label="Tutup pesan"
                  className="absolute top-2 right-2 z-10 cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
                {"error" in response ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{response.error}</p>
                  </div>
                ) : response.intent === "transaksi" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {response.message || "Transaksi dicatat"}
                      </p>
                      {response.details && (
                        <DetailsGrid tone="green">
                          <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                          {response.details.time && (
                            <DetailRow label="Jam" value={response.details.time} />
                          )}
                          <DetailRow label="Kategori" value={response.details.category} />
                          <DetailRow label="Nominal" value={formatSignedIDR(response.details.amount)} />
                          {response.details.accountName && (
                            <DetailRow label="Akun" value={response.details.accountName} />
                          )}
                          {response.details.note && (
                            <DetailRow label="Catatan" value={response.details.note} />
                          )}
                          {response.details.savingsGoalName && (
                            <DetailRow label="Goal" value={response.details.savingsGoalName} />
                          )}
                          {response.details.contributionStatus && (
                            <DetailRow
                              label="Kontribusi"
                              value={response.details.contributionStatus === "allocated" ? "Teralokasi" : "Belum teralokasi"}
                            />
                          )}
                        </DetailsGrid>
                      )}
                      {response.details?.accountCreated && (
                        <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                          ⚠️ Akun &quot;{response.details.accountCreated}&quot; otomatis dibuat. Kalau bukan yang kamu maksud, edit transaksi atau hapus akun di menu Akun.
                        </p>
                      )}
                    </div>
                  </div>
                ) : response.intent === "transaksi_bulk" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {response.message || `${response.details?.count ?? response.transactions.length} transaksi dicatat`}
                      </p>
                      {response.details && (
                        <DetailsGrid tone="green">
                          <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                          {response.details.time && (
                            <DetailRow label="Jam" value={response.details.time} />
                          )}
                          {response.details.accountName && (
                            <DetailRow label="Akun" value={response.details.accountName} />
                          )}
                          <DetailRow label="Total" value={formatSignedIDR(response.details.total)} />
                        </DetailsGrid>
                      )}
                      {/* Per-item breakdown */}
                      {response.transactions.length > 0 && (
                        <div className="mt-2.5 space-y-1">
                          {response.transactions.map((t, i) => (
                            <div key={i} className="flex items-baseline justify-between gap-2 rounded-lg bg-emerald-500/8 px-2.5 py-1.5 text-xs">
                              <span className="font-medium text-emerald-800 dark:text-emerald-300 truncate">
                                ✓ {t.category}{t.note ? <span className="font-normal text-emerald-600 dark:text-emerald-500"> · {t.note}</span> : null}
                              </span>
                              <span className="shrink-0 tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                                {formatSignedIDR(t.amount)}
                              </span>
                            </div>
                          ))}
                          {response.details?.failedItems?.map((f, i) => (
                            <div key={`fail-${i}`} className="flex items-baseline justify-between gap-2 rounded-lg bg-destructive/8 px-2.5 py-1.5 text-xs">
                              <span className="font-medium text-destructive truncate">
                                ✗ {f.category} <span className="font-normal opacity-70">— gagal disimpan</span>
                              </span>
                              <span className="shrink-0 tabular-nums font-semibold text-destructive">
                                {formatSignedIDR(f.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {response.details?.accountCreated && (
                        <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                          ⚠️ Akun &quot;{response.details.accountCreated}&quot; otomatis dibuat. Cek menu Akun kalau bukan yang kamu maksud.
                        </p>
                      )}
                      {response.details?.failedCount && !response.details.failedItems ? (
                        <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                          ⚠️ {response.details.failedCount} item gagal disimpan. Coba ulang item yang gagal saja.
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : response.intent === "pemasukan" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {response.message || "Pemasukan dicatat"}
                      </p>
                      {response.details && (
                        <DetailsGrid tone="green">
                          <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                          {response.details.time && (
                            <DetailRow label="Jam" value={response.details.time} />
                          )}
                          <DetailRow label="Kategori" value={response.details.category} />
                          <DetailRow label="Nominal" value={formatSignedIDR(response.details.amount, "+")} />
                          {response.details.accountName && (
                            <DetailRow label="Akun" value={response.details.accountName} />
                          )}
                          {response.details.note && (
                            <DetailRow label="Catatan" value={response.details.note} />
                          )}
                        </DetailsGrid>
                      )}
                      {response.details?.accountCreated && (
                        <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                          ⚠️ Akun &quot;{response.details.accountCreated}&quot; otomatis dibuat. Cek menu Akun kalau bukan yang kamu maksud.
                        </p>
                      )}
                    </div>
                  </div>
                ) : response.intent === "budget_setting" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                        Budget tersimpan
                      </p>
                      {response.details && (
                        <DetailsGrid tone="blue">
                          <DetailRow label="Kategori" value={response.details.category} />
                          <DetailRow label="Nominal" value={`Rp ${response.details.amount.toLocaleString("id-ID")}`} />
                          <DetailRow label="Bulan" value={response.details.month} />
                        </DetailsGrid>
                      )}
                    </div>
                  </div>
                ) : response.intent === "laporan" ? (
                  <ReportView data={response} />
                ) : response.intent === "unknown" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/25 bg-yellow-500/5 px-4 py-3">
                    <Info className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">
                        {response.clarification}
                      </p>
                      {response.clarificationType === "savings_goal_selection" && response.options?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {response.options.map((option) => (
                            <Button
                              key={option.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={loading}
                              onClick={() => handleSavingsGoalSelect(option.id)}
                              className="rounded-full bg-background/80"
                              title={option.description}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : response.intent === "transfer" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {response.message || "Transfer berhasil diproses."}
                      </p>
                      {response.details && (
                        <DetailsGrid tone="green">
                          <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                          {response.details.time && (
                            <DetailRow label="Jam" value={response.details.time} />
                          )}
                          <DetailRow label="Dari" value={response.details.fromAccountName} />
                          <DetailRow label="Ke" value={response.details.toAccountName} />
                          <DetailRow label="Nominal" value={formatSignedIDR(response.details.amount)} />
                          {response.details.fee > 0 && (
                            <DetailRow label="Fee" value={formatSignedIDR(response.details.fee)} />
                          )}
                          {response.details.note && (
                            <DetailRow label="Catatan" value={response.details.note} />
                          )}
                        </DetailsGrid>
                      )}
                      {response.details?.accountCreated && (
                        <p className="mt-2 rounded-lg border border-amber-300/40 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                          ⚠️ Akun &quot;{response.details.accountCreated}&quot; otomatis dibuat. Cek menu Akun kalau bukan yang kamu maksud.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/25 bg-yellow-500/5 px-4 py-3">
                    <Info className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Tidak bisa memproses permintaan. Coba ulangi dengan kalimat yang berbeda.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[22px] border border-border/70 bg-background p-4">
            <div className="mb-4 flex items-center gap-2">
              <LayoutGrid className="size-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Input manual
              </p>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Kalau kamu ingin lebih presisi, form manual tetap siap untuk transaksi yang perlu detail tambahan.
            </p>
            <ManualTransactionForm
              accounts={accounts}
              categories={transactionCategories}
              onSuccess={handleManualTransactionCreated}
              onError={handleManualTransactionError}
              onReconcile={handleReconcile}
            />
          </div>
        )}
              </SectionCard>

              <RecentTransactionsCard
                transactions={transactions}
                categories={transactionCategories}
                accounts={accounts}
                onDelete={handleDeleteTx}
                onUpdate={handleUpdateTx}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-5 md:gap-6">
              <MiniCashflowCard
                transactions={transactions}
                monthlyIncome={monthlyStats.income}
                monthlyExpense={monthlyStats.expense}
                surplus={monthlyStats.surplus}
                month={currentMonth}
                today={todayStr}
              />
              <RunwayKasCard
                months={runway.months}
                liquid={runway.liquid}
                avgBurn={runway.avgBurn}
              />
              <BudgetMiniListCard
                budgets={budgetData?.budgets}
                loading={budgetLoading}
                categoryBreakdown={categoryBreakdown}
              />
              <SavingsGoalMiniCard goal={initialData.activeSavingsGoal} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
