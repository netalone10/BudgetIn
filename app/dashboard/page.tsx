"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import DashboardTabs, { BudgetData } from "@/components/DashboardTabs";
import TransactionCard, { Transaction } from "@/components/TransactionCard";
import ReportView from "@/components/ReportView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizonal, Loader2, CheckCircle2, AlertCircle, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

type ResponseData =
  | { intent: "transaksi"; transaction: Transaction; message: string }
  | { intent: "pemasukan"; transaction: Transaction; amount: number; category: string; message: string }
  | { intent: "budget_setting"; category: string; amount: number; month: string; message: string }
  | { intent: "laporan"; period: string; totalSpent: number; spentByCategory: Record<string, number>; budgets: { category: string; budget: number; spent: number }[]; summary: string; transactionCount: number }
  | { intent: "unknown"; clarification: string }
  | { error: string };

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ResponseData | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const [budgetData, setBudgetData] = useState<BudgetData | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);

  const [categories, setCategories] = useState<string[]>([]);
  const [savingsCategoryNames, setSavingsCategoryNames] = useState<Set<string>>(new Set());
  const [customTransactions, setCustomTransactions] = useState<Transaction[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [page, setPage] = useState(1);

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
    if (status === "unauthenticated") redirect("/");
  }, [status]);

  useEffect(() => {
    const handleCategoryChange = () => fetchCategories();
    window.addEventListener("categoriesChanged", handleCategoryChange);
    return () => window.removeEventListener("categoriesChanged", handleCategoryChange);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchAll();
  }, [status]);

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

  async function fetchAll() {
    fetchTransactions();
    fetchBudget();
    fetchCategories();
  }

  async function fetchTransactions() {
    setTxLoading(true);
    try {
      const res = await fetch("/api/record?period=bulan+ini");
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch {
      // skip
    } finally {
      setTxLoading(false);
    }
  }

  async function fetchBudget() {
    setBudgetLoading(true);
    try {
      const res = await fetch("/api/budget");
      const data = await res.json();
      setBudgetData(data);
    } catch {
      // skip
    } finally {
      setBudgetLoading(false);
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
      if (data.intent === "transaksi" || data.intent === "pemasukan" || data.intent === "budget_setting") {
        dismissTimerRef.current = setTimeout(() => setResponse(null), 4000);
      }

      if ((data.intent === "transaksi" || data.intent === "pemasukan") && data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
        setPage(1);
        fetchBudget();
      }

      if (data.intent === "budget_setting") {
        fetchBudget();
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
  }

  function handleUpdateTx(id: string, data: Partial<Transaction>) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
    fetchBudget();
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  const dataLoading = txLoading || budgetLoading;

  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-8 space-y-6">

        {/* Greeting */}
        <div className="space-y-1 pb-2 mt-4 md:mt-2">
          <h2 className="text-3xl font-semibold tracking-tight-h2 text-foreground">
            Halo, {session?.user?.name?.split(" ")[0]}
          </h2>
          <p className="text-[15px] text-muted-foreground">
            Ketik transaksi, set budget, atau minta laporan.
          </p>
        </div>

        {/* Today's Summary */}
        {!txLoading && (
          <div className="flex gap-4">
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
          </div>
        )}

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
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{response.message}</p>
              </div>
            ) : response.intent === "pemasukan" ? (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(34,197,94,0.3)", backgroundColor: "rgba(34,197,94,0.05)" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{response.message}</p>
              </div>
            ) : response.intent === "budget_setting" ? (
              <div className="flex items-start gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid rgba(59,130,246,0.3)", backgroundColor: "rgba(59,130,246,0.05)" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{response.message}</p>
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
            <div className="rounded-[24px] border border-border bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="py-3 px-5 text-left w-16 label-mono text-muted-foreground">Tgl</th>
                    <th className="py-3 pr-4 text-left label-mono text-muted-foreground">Deskripsi</th>
                    <th className="py-3 pr-4 text-left label-mono text-muted-foreground">Kategori</th>
                    <th className="py-3 pr-4 text-right label-mono text-muted-foreground">Jumlah</th>
                    <th className="py-3 pr-4 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice((page - 1) * pageSize, page * pageSize).map((t) => (
                    <TransactionCard
                      key={t.id}
                      transaction={t}
                      categories={categories}
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
                    {Math.min((page - 1) * pageSize + 1, transactions.length)}–{Math.min(page * pageSize, transactions.length)} dari {transactions.length}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="text-[15px] px-2.5 py-0.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(Math.ceil(transactions.length / pageSize), p + 1))}
                      disabled={page >= Math.ceil(transactions.length / pageSize)}
                      className="text-[15px] px-2.5 py-0.5 rounded-md border border-border bg-background hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
