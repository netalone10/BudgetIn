"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import BudgetStatus from "@/components/BudgetStatus";
import TransactionCard, { Transaction } from "@/components/TransactionCard";
import ReportView from "@/components/ReportView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { SendHorizonal, Loader2 } from "lucide-react";

type ResponseData =
  | { intent: "transaksi"; transaction: Transaction; message: string }
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Redirect kalau belum login
  useEffect(() => {
    if (status === "unauthenticated") redirect("/");
  }, [status]);

  // Load recent transactions
  useEffect(() => {
    if (status !== "authenticated") return;
    fetchTransactions();
  }, [status]);

  async function fetchTransactions() {
    setTxLoading(true);
    try {
      const res = await fetch("/api/record?period=bulan+ini");
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch {
      // skip — tampilkan kosong
    } finally {
      setTxLoading(false);
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

      // Kalau transaksi baru → prepend ke list
      if (data.intent === "transaksi" && data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev]);
      }

      setPrompt("");
      textareaRef.current?.focus();
    } catch {
      setResponse({ error: "Koneksi gagal. Coba lagi." });
    } finally {
      setLoading(false);
    }
  }

  // Keyboard shortcut: Enter kirim, Shift+Enter newline
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleDeleteTx(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  function handleUpdateTx(id: string, data: Partial<Transaction>) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...data } : t))
    );
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">
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
        <form onSubmit={handleSubmit} className="space-y-2">
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
              <Card className="border-destructive/50">
                <CardContent className="pt-4 text-sm text-destructive">
                  {response.error}
                </CardContent>
              </Card>
            ) : response.intent === "transaksi" ? (
              <Card className="border-green-500/30 bg-green-50/30 dark:bg-green-950/20">
                <CardContent className="pt-4 text-sm font-medium text-green-700 dark:text-green-400">
                  {response.message}
                </CardContent>
              </Card>
            ) : response.intent === "budget_setting" ? (
              <Card className="border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20">
                <CardContent className="pt-4 text-sm font-medium text-blue-700 dark:text-blue-400">
                  {response.message}
                </CardContent>
              </Card>
            ) : response.intent === "laporan" ? (
              <ReportView data={response} />
            ) : response.intent === "unknown" ? (
              <Card className="border-yellow-500/30 bg-yellow-50/30 dark:bg-yellow-950/20">
                <CardContent className="pt-4 text-sm text-yellow-700 dark:text-yellow-400">
                  🤔 {response.clarification}
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        {/* Budget Status */}
        <BudgetStatus />

        {/* Riwayat Transaksi */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Riwayat Transaksi
          </h3>
          {txLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg border bg-muted"
                />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="pt-4 text-sm text-muted-foreground">
                Belum ada transaksi. Mulai catat di atas!
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {transactions.slice(0, 20).map((t) => (
                <TransactionCard
                  key={t.id}
                  transaction={t}
                  onDelete={handleDeleteTx}
                  onUpdate={handleUpdateTx}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
