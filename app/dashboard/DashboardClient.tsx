"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { BudgetData as DashboardTabsBudgetData } from "@/components/DashboardTabs";
import TransactionCard, {
  Transaction,
  type TransactionCategory,
} from "@/components/TransactionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  SendHorizonal,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  MicVocal,
  LayoutGrid,
  Dices,
} from "lucide-react";
import NetWorthSummaryCard from "@/components/NetWorthSummaryCard";
import { cn } from "@/lib/utils";
import { format } from "date-fns/format";
import { toZonedTime } from "date-fns-tz";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";
import { isExpenseTransaction } from "@/lib/transaction-classification";
import type { DashboardInitialData } from "@/lib/dashboard-data";

const ManualTransactionForm = dynamic(
  () => import("@/components/ManualTransactionForm"),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-[28px] bg-muted" /> }
);

const ReportView = dynamic(
  () => import("@/components/ReportView"),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-[28px] bg-muted" /> }
);

const DashboardTabs = dynamic(
  () => import("@/components/DashboardTabs"),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-[28px] bg-muted" /> }
);

type BudgetData = DashboardTabsBudgetData;

type TxDetails = { date: string; category: string; amount: number; accountName?: string; savingsGoalName?: string; contributionStatus?: string };
type BulkDetails = { date: string; accountName?: string; total: number; count: number };
type BudgetDetails = { category: string; amount: number; month: string };
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
  | { intent: "transfer"; message: string }
  | { intent: "unknown"; clarification: string; clarificationType?: string; pendingAction?: SavingsPendingAction; options?: SavingsGoalOption[] }
  | { error: string };

function formatTanggalID(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatSignedIDR(amount: number, positivePrefix = ""): string {
  const sign = amount < 0 ? "-" : positivePrefix;
  return `${sign}Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
}

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

function SectionCard({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-border/70 bg-card/90 p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h3>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
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
];

interface DashboardClientProps {
  initialData: DashboardInitialData;
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>(initialData.transactions);
  const [txLoading, setTxLoading] = useState(false);

  const [budgetData, setBudgetData] = useState<BudgetData | null>(initialData.budgetData);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const [categories, setCategories] = useState<string[]>(
    initialData.categories.map((c) => c.name)
  );
  const [transactionCategories, setTransactionCategories] = useState<TransactionCategory[]>(
    initialData.categories.map((c) => ({ name: c.name, type: c.type }))
  );
  const [savingsCategoryNames, setSavingsCategoryNames] = useState<Set<string>>(
    new Set(initialData.savingsCategoryNames)
  );
  const [customTransactions, setCustomTransactions] = useState<Transaction[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [accounts, setAccounts] = useState<
    { id: string; name: string; currency: string; accountType: { name: string; classification: string } }[]
  >(initialData.accounts);
  const [accountVersion, setAccountVersion] = useState(0);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [page, setPage] = useState(1);
  const [promptExamples, setPromptExamples] = useState(() => PROMPT_EXAMPLES.slice(0, 6));

  const visibleTransactions = useMemo(
    () => transactions.slice((page - 1) * pageSize, page * pageSize),
    [transactions, page, pageSize]
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const r = await fetch("/api/categories");
      const d = await r.json();
      const cats = d.categories ?? [];
      setCategories(cats.map((c: { name: string }) => c.name));
      setTransactionCategories(
        cats.map((c: { name: string; type: string }) => ({ name: c.name, type: c.type }))
      );
      const savingsNames = new Set<string>(
        cats
          .filter((c: { isSavings?: boolean }) => c.isSavings)
          .map((c: { name: string }) => c.name.toLowerCase())
      );
      setSavingsCategoryNames(savingsNames);
    } catch {
      // ignore
    }
  }

  async function fetchTransactions(noStore = false) {
    setTxLoading(true);
    try {
      const res = await fetch(
        "/api/record?period=bulan+ini",
        noStore ? { cache: "no-store" } : undefined
      );
      if (res.status === 401) {
        const data = await res.json();
        if (data.error === "token_expired") {
          setResponse({ error: "Sesi Google expired. Silakan logout lalu login ulang." });
        }
        return;
      }
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch {
      // ignore
    } finally {
      setTxLoading(false);
    }
  }

  async function fetchBudget(noStore = false) {
    setBudgetLoading(true);
    try {
      const res = await fetch("/api/budget", noStore ? { cache: "no-store" } : undefined);
      const data = await res.json();
      setBudgetData(data);
    } catch {
      // ignore
    } finally {
      setBudgetLoading(false);
    }
  }

  async function fetchAccounts(noStore = false) {
    try {
      const res = await fetch("/api/accounts", noStore ? { cache: "no-store" } : undefined);
      const data = await res.json();
      setAccounts(data.accounts ?? []);
      setAccountVersion((v) => v + 1);
    } catch {
      // ignore
    }
  }

  async function handleManualRefresh() {
    await Promise.all([
      fetchTransactions(true),
      fetchBudget(true),
      fetchAccounts(true),
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

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setLoading(true);
    setResponse(null);

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

      if (
        data.intent === "transaksi" ||
        data.intent === "transaksi_bulk" ||
        data.intent === "pemasukan" ||
        data.intent === "transfer" ||
        data.intent === "budget_setting"
      ) {
        dismissTimerRef.current = setTimeout(() => setResponse(null), 4000);
      }

      if ((data.intent === "transaksi" || data.intent === "pemasukan") && data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
        setPage(1);
        fetchBudget();
        fetchAccounts();
        emitDataChanged(["transactions", "budget", "accounts"]);
      }

      if (data.intent === "transaksi_bulk" && data.transactions?.length) {
        setTransactions((prev) => [...data.transactions, ...prev]);
        setPage(1);
        fetchBudget();
        fetchAccounts();
        emitDataChanged(["transactions", "budget", "accounts"]);
      }

      if (data.intent === "transfer") {
        fetchTransactions(true);
        fetchBudget();
        fetchAccounts();
        emitDataChanged(["transactions", "budget", "accounts"]);
      }

      if (data.intent === "budget_setting") {
        fetchBudget();
        emitDataChanged(["budget", "categories"]);
        fetchCategories();
      }

      if (data.intent !== "unknown") setPrompt("");
      textareaRef.current?.focus();
    } catch {
      setResponse({ error: "Koneksi gagal. Coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  async function handleSavingsGoalSelect(goalId: string) {
    if (!response || "error" in response || response.intent !== "unknown" || !response.pendingAction) return;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setLoading(true);

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
        setTransactions((prev) => [data.transaction, ...prev]);
        setPage(1);
        fetchBudget();
        fetchAccounts();
        emitDataChanged(["transactions", "budget", "accounts"]);
      }
      setPrompt("");
      dismissTimerRef.current = setTimeout(() => setResponse(null), 4000);
    } catch {
      setResponse({ error: "Koneksi gagal. Coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchPeriod(from: string, to: string) {
    setCustomLoading(true);
    try {
      const res = await fetch(`/api/record?period=custom&from=${from}&to=${to}`);
      const data = await res.json();
      setCustomTransactions(data.transactions ?? []);
    } catch {
      setCustomTransactions([]);
    } finally {
      setCustomLoading(false);
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

  const dataLoading = txLoading || budgetLoading;
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));

  function randomizePromptExamples() {
    const shuffled = [...PROMPT_EXAMPLES]
      .sort(() => Math.random() - 0.5)
      .slice(0, 6);
    setPromptExamples(shuffled);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        eyebrow="Overview"
        title="Kontrol harian"
        description="Lihat ritme pengeluaran hari ini, status data terakhir, dan lompat langsung ke aksi yang kamu butuhkan."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={dataLoading}
            className="rounded-full"
          >
            <RefreshCw className={cn("h-4 w-4", dataLoading && "animate-spin")} />
            Refresh data
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[0.88fr_1.12fr] lg:items-stretch">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[26px] border border-border/70 bg-background p-5">
              <div className="mb-2 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                <span className="text-[13px] font-medium text-muted-foreground">
                  Keluar hari ini
                </span>
              </div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {todayStats.expense !== 0 ? (
                  formatSignedIDR(todayStats.expense)
                ) : (
                  <span className="text-lg text-muted-foreground">Belum ada</span>
                )}
              </p>
              <p className="mt-2 text-[12px] text-muted-foreground">
                {todayStats.count > 0 ? `${todayStats.count} transaksi tercatat` : "Masih sepi untuk hari ini"}
              </p>
            </div>

            <div className="rounded-[26px] border border-border/70 bg-background p-5">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp
                  className={cn(
                    "h-4 w-4",
                    todayStats.income >= 0 ? "text-emerald-500" : "text-destructive"
                  )}
                />
                <span className="text-[13px] font-medium text-muted-foreground">
                  Masuk hari ini
                </span>
              </div>
              <p
                className={cn(
                  "text-2xl font-semibold tracking-tight",
                  todayStats.income >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
                )}
              >
                {todayStats.income !== 0 ? (
                  formatSignedIDR(todayStats.income, "+")
                ) : (
                  <span className="text-lg text-muted-foreground">Belum ada</span>
                )}
              </p>
              <p className="mt-2 text-[12px] text-muted-foreground">
                {todayStats.incomeCount > 0
                  ? `${todayStats.incomeCount} transaksi pemasukan tercatat`
                  : "Belum ada pemasukan hari ini"}
              </p>
            </div>
          </div>

          <NetWorthSummaryCard refreshTrigger={accountVersion} />
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Input"
        title="Tulis seperti ngobrol"
        description="Area ini didesain untuk jadi pintu masuk tercepat: satu kotak untuk transaksi, budget, transfer, dan laporan."
      >
        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-border/70 bg-background p-4">
              <div className="mb-3 flex items-center gap-2">
                <MicVocal className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  AI capture box
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    placeholder='Contoh: "Makan siang 35rb" atau "Rekap bulan ini"'
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={4}
                    className="resize-none rounded-[24px] border-border/70 bg-card pr-12 pt-4 shadow-none focus-visible:ring-primary"
                    disabled={loading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!prompt.trim() || loading}
                    className="absolute bottom-3 right-3 h-10 w-10 rounded-full shadow-md transition-transform hover:-translate-y-px"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizonal className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Coba:</span>
                    <button
                      type="button"
                      onClick={randomizePromptExamples}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Acak saran prompt"
                    >
                      <Dices className="h-3 w-3" />
                      Acak
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {promptExamples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setPrompt(example);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
              <div className="rounded-[28px] border border-border/70 bg-background p-4">
                {"error" in response ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">{response.error}</p>
                  </div>
                ) : response.intent === "transaksi" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Transaksi dicatat
                      </p>
                      {response.details && (
                        <DetailsGrid tone="green">
                          <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                          <DetailRow label="Kategori" value={response.details.category} />
                          <DetailRow label="Nominal" value={formatSignedIDR(response.details.amount)} />
                          {response.details.accountName && (
                            <DetailRow label="Akun" value={response.details.accountName} />
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
                    </div>
                  </div>
                ) : response.intent === "transaksi_bulk" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {response.details?.count ?? response.transactions.length} transaksi dicatat
                      </p>
                      {response.details && (
                        <DetailsGrid tone="green">
                          <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                          {response.details.accountName && (
                            <DetailRow label="Akun" value={response.details.accountName} />
                          )}
                          <DetailRow label="Total" value={formatSignedIDR(response.details.total)} />
                        </DetailsGrid>
                      )}
                      <ul className="mt-2 space-y-1">
                        {response.transactions.map((t, i) => (
                          <li
                            key={i}
                            className="text-xs text-emerald-700 dark:text-emerald-400"
                          >
                            - {t.category}: {formatSignedIDR(t.amount)}
                            {t.note ? ` (${t.note})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : response.intent === "pemasukan" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Pemasukan dicatat
                      </p>
                      {response.details && (
                        <DetailsGrid tone="green">
                          <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                          <DetailRow label="Kategori" value={response.details.category} />
                          <DetailRow label="Nominal" value={formatSignedIDR(response.details.amount, "+")} />
                          {response.details.accountName && (
                            <DetailRow label="Akun" value={response.details.accountName} />
                          )}
                        </DetailsGrid>
                      )}
                    </div>
                  </div>
                ) : response.intent === "budget_setting" ? (
                  <div className="flex items-start gap-3 rounded-2xl border border-blue-500/25 bg-blue-500/5 px-4 py-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
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
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
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
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {response.message || "Transfer berhasil diproses."}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-2xl border border-yellow-500/25 bg-yellow-500/5 px-4 py-3">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Tidak bisa memproses permintaan. Coba ulangi dengan kalimat yang berbeda.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-border/70 bg-background p-4">
            <div className="mb-4 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">
                Input manual
              </p>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
              Kalau kamu ingin lebih presisi, form manual tetap siap untuk transaksi yang perlu detail tambahan.
            </p>
            <ManualTransactionForm
              accounts={accounts}
              categories={categories}
              onSuccess={() => {
                fetchTransactions();
                fetchBudget();
                fetchAccounts();
              }}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Analytics"
        title="Cashflow dan budget"
        description="Area baca utama untuk melihat distribusi transaksi, progres budget, dan pola pengeluaran."
      >
        <DashboardTabs
          transactions={transactions}
          budgetData={budgetData}
          loading={dataLoading}
          onFetchPeriod={handleFetchPeriod}
          customTransactions={customTransactions}
          customLoading={customLoading}
          savingsCategoryNames={savingsCategoryNames}
          onBudgetChange={fetchBudget}
        />
      </SectionCard>

      <SectionCard
        eyebrow="Ledger"
        title="Riwayat transaksi"
        description="Riwayat lengkap dengan table yang lebih bersih dan kontrol paging yang lebih mudah dipindai."
      >
        {txLoading ? (
          <div className="rounded-[28px] border border-border/70 bg-background overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-4 border-b border-border px-5 py-4 last:border-0"
              >
                <div className="h-4 w-12 rounded-md bg-muted" />
                <div className="h-4 flex-1 rounded-md bg-muted" />
                <div className="h-6 w-20 rounded-full bg-muted" />
                <div className="h-4 w-20 rounded-md bg-muted" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-[28px] border border-border/70 bg-background px-5 py-12 text-center text-sm text-muted-foreground">
            Belum ada transaksi bulan ini.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-border bg-muted/35">
                    <th className="label-mono w-16 px-5 py-3 text-left text-muted-foreground">
                      Tgl
                    </th>
                    <th className="label-mono py-3 pr-4 text-left text-muted-foreground">
                      Deskripsi
                    </th>
                    <th className="label-mono py-3 pr-4 text-left text-muted-foreground">
                      Kategori
                    </th>
                    <th className="label-mono hidden py-3 pr-4 text-left text-muted-foreground sm:table-cell">
                      Akun
                    </th>
                    <th className="label-mono py-3 pr-4 text-right text-muted-foreground">
                      Jumlah
                    </th>
                    <th className="w-16 py-3 pr-4" />
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((t) => (
                    <TransactionCard
                      key={t.id}
                      transaction={t}
                      categories={transactionCategories}
                      accounts={accounts}
                      onDelete={handleDeleteTx}
                      onUpdate={handleUpdateTx}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-border bg-muted/20 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-muted-foreground">
                  Tampilkan
                </span>
                {([10, 20, 50] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      setPageSize(n);
                      setPage(1);
                    }}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
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
                <span className="text-[13px] font-medium text-muted-foreground">
                  {Math.min((page - 1) * pageSize + 1, transactions.length)}-
                  {Math.min(page * pageSize, transactions.length)} dari {transactions.length}
                </span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-full border border-border bg-background px-3 py-1 text-[15px] transition-colors hover:bg-muted disabled:opacity-40"
                  >
                    {"<"}
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-full border border-border bg-background px-3 py-1 text-[15px] transition-colors hover:bg-muted disabled:opacity-40"
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
  );
}
