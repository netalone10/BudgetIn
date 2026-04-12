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
import { SendHorizonal, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";

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
        // Update budget spent count locally lalu refresh dari server
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dataLoading = txLoading || budgetLoading;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-6">
        {/* Greeting */}
        <div>
          <h2 className="text-lg font-semibold">
            Halo, {session?.user?.name?.split(" ")[0]} 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            Ketik transaksi, set budget, atau minta laporan.
          </p>
        </div>

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
          <p className="text-xs text-muted-foreground">
            Enter untuk kirim · Shift+Enter untuk baris baru
          </p>
        </form>

        {/* Response Area */}
        {response && (
          <div>
            {"error" in response ? (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{response.error}</p>
              </div>
            ) : response.intent === "transaksi" ? (
              <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-50/40 dark:bg-green-950/20 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{response.message}</p>
              </div>
            ) : response.intent === "pemasukan" ? (
              <div className="flex items-start gap-3 rounded-xl border border-green-500/30 bg-green-50/40 dark:bg-green-950/20 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">{response.message}</p>
              </div>
            ) : response.intent === "budget_setting" ? (
              <div className="flex items-start gap-3 rounded-xl border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">{response.message}</p>
              </div>
            ) : response.intent === "laporan" ? (
              <ReportView data={response} />
            ) : response.intent === "unknown" ? (
              <div className="flex items-start gap-3 rounded-xl border border-yellow-500/30 bg-yellow-50/40 dark:bg-yellow-950/20 px-4 py-3">
                <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700 dark:text-yellow-400">{response.clarification}</p>
              </div>
            ) : null}
          </div>
        )}

        {/* Dashboard Tabs — Arus Kas & vs Budget */}
        <DashboardTabs
          transactions={transactions}
          budgetData={budgetData}
          loading={dataLoading}
        />

        {/* Riwayat Transaksi — edit & hapus */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Riwayat Transaksi</h3>
          {txLoading ? (
            <div className="rounded-xl border overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse border-b last:border-0">
                  <div className="h-3 w-12 rounded bg-muted" />
                  <div className="h-3 flex-1 rounded bg-muted" />
                  <div className="h-5 w-16 rounded-full bg-muted" />
                  <div className="h-3 w-16 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-xl border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada transaksi bulan ini.
            </div>
          ) : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-medium text-muted-foreground w-16">Tgl</th>
                    <th className="py-2.5 pr-3 text-left text-[11px] font-medium text-muted-foreground">Deskripsi</th>
                    <th className="py-2.5 pr-3 text-left text-[11px] font-medium text-muted-foreground">Kategori</th>
                    <th className="py-2.5 pr-2 text-right text-[11px] font-medium text-muted-foreground">Jumlah</th>
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
                <div className="border-t px-4 py-2.5 text-center text-xs text-muted-foreground">
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
