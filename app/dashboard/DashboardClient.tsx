"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { BudgetData as DashboardTabsBudgetData } from "@/components/DashboardTabs";
import type { Transaction, TransactionCategory } from "@/components/TransactionCard";
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
import { formatSignedIDR, formatTanggalID } from "@/lib/format";
import type { DashboardInitialData } from "@/lib/dashboard-data";
import DashboardGreeting from "@/components/dashboard/DashboardGreeting";
import KPICard from "@/components/dashboard/KPICard";
import MiniCashflowCard from "@/components/dashboard/MiniCashflowCard";
import BudgetMiniListCard from "@/components/dashboard/BudgetMiniListCard";
import SavingsGoalMiniCard from "@/components/dashboard/SavingsGoalMiniCard";
import { SectionCard } from "@/components/dashboard/SectionCard";
import RecentTransactionsCard from "@/components/dashboard/RecentTransactionsCard";

const ManualTransactionForm = dynamic(
  () => import("@/components/ManualTransactionForm"),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-[28px] bg-muted" /> }
);

const ReportView = dynamic(
  () => import("@/components/ReportView"),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-[28px] bg-muted" /> }
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
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>(initialData.transactions);
  const [txLoading, setTxLoading] = useState(false);

  const [budgetData, setBudgetData] = useState<BudgetData | null>(initialData.budgetData);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const [transactionCategories, setTransactionCategories] = useState<TransactionCategory[]>(() =>
    initialData.categories.map((c) => ({ name: c.name, type: c.type }))
  );
  const [savingsCategoryNames, setSavingsCategoryNames] = useState<Set<string>>(() =>
    new Set(initialData.savingsCategoryNames)
  );
  const [accounts, setAccounts] = useState<
    { id: string; name: string; currency: string; accountType: { name: string; classification: string } }[]
  >(initialData.accounts);
  const [accountVersion, setAccountVersion] = useState(0);
  const [promptExamples, setPromptExamples] = useState(() => PROMPT_EXAMPLES.slice(0, 8));
  const [inputMode, setInputMode] = useState<"ai" | "manual">("ai");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    const income = inMonth
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.amount, 0);
    const expense = inMonth
      .filter(isExpenseTransaction)
      .reduce((s, t) => s + t.amount, 0);
    const surplus = income - expense;
    const savingsRate = income > 0 ? (surplus / income) * 100 : 0;
    return { income, expense, surplus, savingsRate };
  }, [transactions, currentMonth]);

  const categoryBreakdown = useMemo(() => {
    const inMonth = transactions.filter((t) => t.date.startsWith(currentMonth));
    const expenseByCat = new Map<string, number>();
    const incomeByCat = new Map<string, number>();
    for (const t of inMonth) {
      if (isExpenseTransaction(t)) {
        expenseByCat.set(t.category, (expenseByCat.get(t.category) ?? 0) + t.amount);
      } else if (t.type === "income") {
        incomeByCat.set(t.category, (incomeByCat.get(t.category) ?? 0) + t.amount);
      }
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
  }, [transactions, currentMonth, monthlyStats.expense, monthlyStats.income]);

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
    const handleCategoryChange = () => fetchCategories();
    window.addEventListener("categoriesChanged", handleCategoryChange);
    return () => window.removeEventListener("categoriesChanged", handleCategoryChange);
  }, []);

  useDataEvent(["transactions", "budget", "accounts", "categories"], (topic) => {
    if (topic === "transactions") fetchTransactions(true, true);
    if (topic === "budget") fetchBudget(true, true);
    if (topic === "accounts") fetchAccounts(true);
    if (topic === "categories") fetchCategories();
  });

  async function fetchCategories() {
    try {
      const r = await fetch("/api/categories");
      const d = await r.json();
      const cats = d.categories ?? [];
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

  async function fetchTransactions(noStore = false, silent = false) {
    if (!silent) setTxLoading(true);
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
      if (!silent) setTxLoading(false);
    }
  }

  async function fetchBudget(noStore = false, silent = false) {
    if (!silent) setBudgetLoading(true);
    try {
      const res = await fetch("/api/budget", noStore ? { cache: "no-store" } : undefined);
      const data = await res.json();
      setBudgetData(data);
    } catch {
      // ignore
    } finally {
      if (!silent) setBudgetLoading(false);
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

      if ((data.intent === "transaksi" || data.intent === "pemasukan") && data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
        fetchBudget();
        fetchAccounts();
        emitDataChanged(["transactions", "budget", "accounts"]);
      }

      if (data.intent === "transaksi_bulk" && data.transactions?.length) {
        setTransactions((prev) => [...data.transactions, ...prev]);
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
        fetchBudget();
        fetchAccounts();
        emitDataChanged(["transactions", "budget", "accounts"]);
      }
      setPrompt("");
    } catch {
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

  const dataLoading = txLoading || budgetLoading;

  function randomizePromptExamples() {
    const shuffled = [...PROMPT_EXAMPLES]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
    setPromptExamples(shuffled);
  }

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <DashboardGreeting
        userName={initialData.user?.name}
        todayStats={todayStats}
        onQuickAction={focusAIWithIntent}
        onRefresh={handleManualRefresh}
        refreshing={dataLoading}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      <div className="grid items-start gap-5 lg:grid-cols-[1.62fr_1fr]">
        <div className="flex flex-col gap-5 md:gap-6">
      <SectionCard
        eyebrow="Input · AI Capture"
        title="Tulis seperti ngobrol"
      >
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-[14px] bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setInputMode("ai")}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-all",
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
              "flex items-center justify-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium transition-all",
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
              <div className="mb-3 flex items-center gap-2">
                <MicVocal className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  AI Capture
                </p>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  Enter untuk kirim
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
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
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      title="Acak saran prompt"
                    >
                      <Dices className="size-3" />
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
                      className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="absolute top-2 right-2 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {response.message || "Transfer berhasil diproses."}
                    </p>
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
              onSuccess={() => {
                fetchTransactions();
                fetchBudget();
                fetchAccounts();
              }}
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

        <div className="flex flex-col gap-4">
          <MiniCashflowCard
            transactions={transactions}
            monthlyIncome={monthlyStats.income}
            monthlyExpense={monthlyStats.expense}
            surplus={monthlyStats.surplus}
            month={currentMonth}
            today={todayStr}
          />
          <BudgetMiniListCard
            budgets={budgetData?.budgets}
            loading={budgetLoading}
            categoryBreakdown={categoryBreakdown}
          />
          <SavingsGoalMiniCard goal={initialData.activeSavingsGoal} />
        </div>
      </div>
    </div>
  );
}
