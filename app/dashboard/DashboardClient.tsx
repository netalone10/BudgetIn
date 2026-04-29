"use client";

import { useState, useRef, useEffect, useMemo, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { BudgetData as DashboardTabsBudgetData } from "@/components/DashboardTabs";
import TransactionCard, { Transaction } from "@/components/TransactionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizonal, Loader2, CheckCircle2, AlertCircle, Info, TrendingDown, TrendingUp } from "lucide-react";
import NetWorthSummaryCard from "@/components/NetWorthSummaryCard";
import { cn } from "@/lib/utils";
import { format } from "date-fns/format";
import { toZonedTime } from "date-fns-tz";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";
import type { DashboardInitialData } from "@/lib/dashboard-data";

// Dynamic imports for heavy components
// Skeleton heights matched to actual rendered content to minimize CLS.
const ManualTransactionForm = dynamic(
  () => import("@/components/ManualTransactionForm"),
  { ssr: false, loading: () => <div className="h-[280px] animate-pulse rounded-xl bg-muted" /> }
);

const ReportView = dynamic(
  () => import("@/components/ReportView"),
  { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-xl bg-muted" /> }
);

const DashboardTabs = dynamic(
  () => import("@/components/DashboardTabs"),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-muted" /> }
);

// Re-export BudgetData type to avoid naming conflict
type BudgetData = DashboardTabsBudgetData;

type TxDetails = { date: string; category: string; amount: number; accountName?: string };
type BulkDetails = { date: string; accountName?: string; total: number; count: number };
type BudgetDetails = { category: string; amount: number; month: string };

type ResponseData =
  | { intent: "transaksi"; transaction: Transaction; message: string; details?: TxDetails }
  | { intent: "transaksi_bulk"; transactions: Transaction[]; message: string; details?: BulkDetails }
  | { intent: "pemasukan"; transaction: Transaction; amount: number; category: string; message: string; details?: TxDetails }
  | { intent: "budget_setting"; category: string; amount: number; month: string; message: string; details?: BudgetDetails }
  | { intent: "laporan"; period: string; totalSpent: number; spentByCategory: Record<string, number>; budgets: { category: string; budget: number; spent: number }[]; summary: string; transactionCount: number }
  | { intent: "unknown"; clarification: string }
  | { error: string };

function formatTanggalID(iso: string): string {
  // Accept "YYYY-MM-DD" — render as "29 Apr 2026" in id-ID locale.
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(d);
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
  const colorClass = tone === "blue" ? "text-blue-700 dark:text-blue-400" : "text-green-700 dark:text-green-400";
  return (
    <dl className={`mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs ${colorClass}`}>
      {children}
    </dl>
  );
}

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

  // Memoize visible transactions to avoid re-slicing on every render
  const visibleTransactions = useMemo(() =>
    transactions.slice((page - 1) * pageSize, page * pageSize),
    [transactions, page, pageSize]
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hitung pengeluaran & pemasukan hari ini (WIB)
  const todayStr = format(toZonedTime(new Date(), "Asia/Jakarta"), "yyyy-MM-dd");
  const todayStats = useMemo(() => {
    const todayTxs = transactions.filter((t) => t.date === todayStr);
    const expense = todayTxs.filter((t) => t.type !== "income").reduce((s, t) => s + t.amount, 0);
    const income = todayTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const count = todayTxs.filter((t) => t.type !== "income").length;
    return { expense, income, count };
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
      // Build savings category names set
      const savingsNames = new Set<string>(
        cats
          .filter((c: { isSavings?: boolean }) => c.isSavings)
          .map((c: { name: string }) => c.name.toLowerCase())
      );
      setSavingsCategoryNames(savingsNames);
    } catch {
      // skip
    }
  }

  async function fetchTransactions(noStore = false) {
    setTxLoading(true);
    try {
      const res = await fetch("/api/record?period=bulan+ini", noStore ? { cache: "no-store" } : undefined);
      if (res.status === 401) {
        const data = await res.json();
        if (data.error === "token_expired") {
          setResponse({ error: "⚠️ Sesi Google expired. Silakan logout lalu login ulang." });
        }
        return;
      }
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch {
      // skip
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
      // skip
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
      // skip
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!prompt.trim() || loading) return;

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    setLoading(true);
    setResponse(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMsg = "Server error. Coba lagi.";
        try { errMsg = JSON.parse(text)?.error ?? errMsg; } catch {}
        setResponse({ error: errMsg });
        return;
      }

      const data = await res.json();
      setResponse(data);

      // Auto-dismiss success notification setelah 4 detik
      if (data.intent === "transaksi" || data.intent === "transaksi_bulk" || data.intent === "pemasukan" || data.intent === "budget_setting") {
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

      if (data.intent === "budget_setting") {
        fetchBudget();
        emitDataChanged(["budget", "categories"]);
        fetch("/api/categories")
          .then((r) => r.json())
          .then((d) => {
            const cats = d.categories ?? [];
            setCategories(cats.map((c: { name: string }) => c.name));
            setSavingsCategoryNames(new Set<string>(
              cats
                .filter((c: { isSavings?: boolean }) => c.isSavings)
                .map((c: { name: string }) => c.name.toLowerCase())
            ));
          })
          .catch(() => {});
      }

      setPrompt("");
      textareaRef.current?.focus();
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

  function handleDeleteTx(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    fetchBudget();
    fetchAccounts();
    emitDataChanged(["transactions", "budget", "accounts"]);
  }

  function handleUpdateTx(id: string, data: Partial<Transaction>) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
    fetchBudget();
    fetchAccounts();
    emitDataChanged(["transactions", "budget", "accounts"]);
  }

  const dataLoading = txLoading || budgetLoading;

  return (
    <>
        {/* Today's Summary — always render the shell to keep layout stable (avoid CLS) */}
        <div className="flex gap-4" style={{ minHeight: 96 }}>
          {txLoading ? (
            <>
              <div className="flex-1 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-2" />
                <div className="h-7 w-32 bg-muted rounded" />
              </div>
            </>
          ) : (
          <>
            {/* Pengeluaran hari ini */}
            <div className="flex-1 rounded-2xl border border-border bg-card px-5 py-4 flex items-center justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  <span className="text-[13px] font-medium text-muted-foreground">
                    Keluar hari ini
                  </span>
                </div>
                <p className="text-xl font-semibold tabular-nums text-foreground mt-1">
                  {todayStats.expense > 0
                    ? `Rp ${new Intl.NumberFormat("id-ID").format(todayStats.expense)}`
                    : <span className="text-muted-foreground text-base">Belum ada</span>
                  }
                </p>
                {todayStats.count > 0 && (
                  <p className="text-[12px] font-medium text-muted-foreground mt-1">
                    {todayStats.count} transaksi
                  </p>
                )}
              </div>
            </div>

            {/* Pemasukan hari ini */}
            {todayStats.income > 0 && (
              <div className="flex-1 rounded-2xl border border-border bg-card px-5 py-4 flex items-center justify-between shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-[#0fa76e]" />
                    <span className="text-[13px] font-medium text-muted-foreground">
                      Masuk hari ini
                    </span>
                  </div>
                  <p className="text-xl font-semibold tabular-nums text-[#0fa76e] mt-1">
                    +{new Intl.NumberFormat("id-ID").format(todayStats.income)}
                  </p>
                </div>
              </div>
            )}
          </>
          )}
        </div>

        {/* Net Worth Summary */}
        <NetWorthSummaryCard refreshTrigger={accountVersion} />

        {/* Prompt Input */}
        <form onSubmit={handleSubmit} className="space-y-2 mt-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder='Contoh: "Makan siang 35rb" atau "Rekap bulan ini"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="resize-none pr-12 rounded-[20px] shadow-sm py-3 px-4 focus-visible:ring-primary"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!prompt.trim() || loading}
              className="absolute bottom-2.5 right-2 h-9 w-9 rounded-full shadow-md hover:-translate-y-px transition-transform"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[12px] font-medium text-muted-foreground px-2">
            Enter untuk kirim &middot; Shift+Enter untuk baris baru
          </p>
        </form>

        {/* Manual Input */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">atau input manual</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <ManualTransactionForm
            accounts={accounts}
            categories={categories}
            onSuccess={() => { fetchTransactions(); fetchBudget(); fetchAccounts(); }}
          />
        </div>

        {/* Response Area */}
        {response && (
          <div>
            {"error" in response ? (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.05)" }}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--destructive)" }} />
                <p className="text-sm" style={{ color: "var(--destructive)" }}>{response.error}</p>
              </div>
            ) : response.intent === "transaksi" ? (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.05)" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">✓ Transaksi dicatat</p>
                  {response.details && (
                    <DetailsGrid tone="green">
                      <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                      <DetailRow label="Kategori" value={response.details.category} />
                      <DetailRow label="Nominal" value={`Rp ${response.details.amount.toLocaleString("id-ID")}`} />
                      {response.details.accountName && (
                        <DetailRow label="Akun" value={response.details.accountName} />
                      )}
                    </DetailsGrid>
                  )}
                </div>
              </div>
            ) : response.intent === "transaksi_bulk" ? (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.05)" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    ✓ {response.details?.count ?? response.transactions.length} transaksi dicatat
                  </p>
                  {response.details && (
                    <DetailsGrid tone="green">
                      <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                      {response.details.accountName && (
                        <DetailRow label="Akun" value={response.details.accountName} />
                      )}
                      <DetailRow label="Total" value={`Rp ${response.details.total.toLocaleString("id-ID")}`} />
                    </DetailsGrid>
                  )}
                  <ul className="mt-1.5 space-y-0.5">
                    {response.transactions.map((t, i) => (
                      <li key={i} className="text-xs text-green-600 dark:text-green-500">
                        &middot; {t.category} — Rp {t.amount.toLocaleString("id-ID")}
                        {t.note ? ` (${t.note})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : response.intent === "pemasukan" ? (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.05)" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">✓ Pemasukan dicatat</p>
                  {response.details && (
                    <DetailsGrid tone="green">
                      <DetailRow label="Tanggal" value={formatTanggalID(response.details.date)} />
                      <DetailRow label="Kategori" value={response.details.category} />
                      <DetailRow label="Nominal" value={`+Rp ${response.details.amount.toLocaleString("id-ID")}`} />
                      {response.details.accountName && (
                        <DetailRow label="Akun" value={response.details.accountName} />
                      )}
                    </DetailsGrid>
                  )}
                </div>
              </div>
            ) : response.intent === "budget_setting" ? (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(59,130,246,0.3)", backgroundColor: "rgba(59,130,246,0.05)" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">✓ Budget tersimpan</p>
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
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(234,179,8,0.3)", backgroundColor: "rgba(234,179,8,0.05)" }}>
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">{response.clarification}</p>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(234,179,8,0.3)", backgroundColor: "rgba(234,179,8,0.05)" }}>
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">Tidak bisa memproses permintaan. Coba ulangi dengan kalimat yang berbeda.</p>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Tabs */}
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

        {/* Riwayat Transaksi */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="label-mono text-muted-foreground">
              Riwayat Transaksi
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {txLoading ? (
            <div className="rounded-[24px] border border-border bg-card overflow-hidden shadow-sm">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border animate-pulse">
                  <div className="h-4 w-12 bg-muted rounded-md" />
                  <div className="h-4 flex-1 bg-muted rounded-md" />
                  <div className="h-6 w-20 bg-muted rounded-full" />
                  <div className="h-4 w-20 bg-muted rounded-md" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-[24px] border border-border bg-card px-5 py-10 text-center text-muted-foreground text-sm shadow-sm">
              Belum ada transaksi bulan ini.
            </div>
          ) : (
            <div className="rounded-[24px] border border-border bg-card shadow-sm">
              <div className="overflow-x-auto rounded-[24px]">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="py-3 px-5 text-left w-16 label-mono text-muted-foreground">Tgl</th>
                    <th className="py-3 pr-4 text-left label-mono text-muted-foreground">Deskripsi</th>
                    <th className="py-3 pr-4 text-left label-mono text-muted-foreground">Kategori</th>
                    <th className="py-3 pr-4 text-left label-mono text-muted-foreground hidden sm:table-cell">Akun</th>
                    <th className="py-3 pr-4 text-right label-mono text-muted-foreground">Jumlah</th>
                    <th className="py-3 pr-4 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((t) => (
                    <TransactionCard
                      key={t.id}
                      transaction={t}
                      categories={categories}
                      accounts={accounts}
                      onDelete={handleDeleteTx}
                      onUpdate={handleUpdateTx}
                    />
                  ))}
                </tbody>
              </table>
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/20 gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-muted-foreground">Tampilkan</span>
                  {([10, 20, 50] as const).map((n) => (
                    <button
                      key={n}
                      onClick={() => { setPageSize(n); setPage(1); }}
                      className={cn(
                        "text-[13px] px-2.5 py-1 rounded-md font-medium transition-colors border",
                        pageSize === n
                          ? "bg-foreground text-background border-foreground shadow-[rgba(0,0,0,0.06)_0px_1px_2px]"
                          : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-medium text-muted-foreground">
                    {Math.min((page - 1) * pageSize + 1, transactions.length)}&ndash;{Math.min(page * pageSize, transactions.length)} dari {transactions.length}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="text-[15px] px-2.5 py-0.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                      &lsaquo;
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(Math.ceil(transactions.length / pageSize), p + 1))}
                      disabled={page >= Math.ceil(transactions.length / pageSize)}
                      className="text-[15px] px-2.5 py-0.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                      &rsaquo;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </>
  );
}
