"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import DashboardTabs, { BudgetData } from "@/components/DashboardTabs";
import TransactionCard, { Transaction } from "@/components/TransactionCard";
import ReportView from "@/components/ReportView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SendHorizonal, Loader2, CheckCircle2, AlertCircle, Info, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo } from "react";
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (status !== "authenticated") return;
    fetchAll();
  }, [status]);

  async function fetchAll() {
    fetchTransactions();
    fetchBudget();
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => setCategories((d.categories ?? []).map((c: { name: string }) => c.name)))
      .catch(() => {});
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

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await res.json();
      setResponse(data);

      if ((data.intent === "transaksi" || data.intent === "pemasukan") && data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
        fetchBudget();
      }

      if (data.intent === "budget_setting") {
        fetchBudget();
        fetch("/api/categories")
          .then((r) => r.json())
          .then((d) => setCategories((d.categories ?? []).map((c: { name: string }) => c.name)))
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
    <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--background)" }}>
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">

        {/* Greeting — Playfair Display */}
        <div className="space-y-1 pb-1">
          <h2
            className="text-2xl font-normal"
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              color: "var(--foreground)",
            }}
          >
            Halo, {session?.user?.name?.split(" ")[0]}
          </h2>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Ketik transaksi, set budget, atau minta laporan.
          </p>
        </div>

        {/* Today's Summary */}
        {!txLoading && (
          <div className="flex gap-3">
            {/* Pengeluaran hari ini */}
            <div
              className="flex-1 rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
            >
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    Keluar hari ini
                  </span>
                </div>
                <p className="text-lg font-semibold tabular-nums" style={{ color: "var(--foreground)" }}>
                  {todayStats.expense > 0
                    ? `Rp ${new Intl.NumberFormat("id-ID").format(todayStats.expense)}`
                    : <span style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>Belum ada</span>
                  }
                </p>
                {todayStats.count > 0 && (
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                    {todayStats.count} transaksi
                  </p>
                )}
              </div>
            </div>

            {/* Pemasukan hari ini — hanya tampil kalau ada */}
            {todayStats.income > 0 && (
              <div
                className="flex-1 rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
              >
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                      Masuk hari ini
                    </span>
                  </div>
                  <p className="text-lg font-semibold tabular-nums text-green-600 dark:text-green-400">
                    +{new Intl.NumberFormat("id-ID").format(todayStats.income)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Prompt Input */}
        <form onSubmit={handleSubmit} className="space-y-1.5">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder='Contoh: "Makan siang 35rb" atau "Rekap bulan ini"'
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="resize-none pr-12"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!prompt.trim() || loading}
              className="absolute bottom-2 right-2 h-8 w-8"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
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
            ) : null}
          </div>
        )}

        {/* Dashboard Tabs */}
        <DashboardTabs
          transactions={transactions}
          budgetData={budgetData}
          loading={dataLoading}
        />

        {/* Riwayat Transaksi */}
        <div className="space-y-3">
          {/* Section label with rule lines */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
            <h3
              style={{
                fontFamily: "var(--font-ibm-plex-mono), monospace",
                fontSize: "0.75rem",
                fontWeight: 500,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--muted-foreground)",
              }}
            >
              Riwayat Transaksi
            </h3>
            <span className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
          </div>

          {txLoading ? (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="h-3 w-12 rounded" style={{ backgroundColor: "var(--muted)" }} />
                  <div className="h-3 flex-1 rounded" style={{ backgroundColor: "var(--muted)" }} />
                  <div className="h-5 w-16 rounded-full" style={{ backgroundColor: "var(--muted)" }} />
                  <div className="h-3 w-16 rounded" style={{ backgroundColor: "var(--muted)" }} />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div
              className="rounded-xl px-4 py-8 text-center text-sm"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--muted-foreground)",
              }}
            >
              Belum ada transaksi bulan ini.
            </div>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
              }}
            >
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--muted) 30%, transparent)" }}>
                    <th className="py-2.5 pl-4 pr-3 text-left w-16" style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted-foreground)", fontFamily: "var(--font-ibm-plex-mono), monospace", letterSpacing: "0.05em" }}>Tgl</th>
                    <th className="py-2.5 pr-3 text-left" style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted-foreground)", fontFamily: "var(--font-ibm-plex-mono), monospace", letterSpacing: "0.05em" }}>Deskripsi</th>
                    <th className="py-2.5 pr-3 text-left" style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted-foreground)", fontFamily: "var(--font-ibm-plex-mono), monospace", letterSpacing: "0.05em" }}>Kategori</th>
                    <th className="py-2.5 pr-2 text-right" style={{ fontSize: "11px", fontWeight: 500, color: "var(--muted-foreground)", fontFamily: "var(--font-ibm-plex-mono), monospace", letterSpacing: "0.05em" }}>Jumlah</th>
                    <th className="py-2.5 pr-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 20).map((t) => (
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
              {transactions.length > 20 && (
                <div
                  className="px-4 py-2.5 text-center text-xs"
                  style={{
                    borderTop: "1px solid var(--border)",
                    color: "var(--muted-foreground)",
                  }}
                >
                  Menampilkan 20 dari {transactions.length} transaksi
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
