"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { TrendingUp, TrendingDown, Activity, Loader2, Plus, SendHorizonal, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import TransactionCard, { type TransactionCategory } from "@/components/TransactionCard";
import ManualTransactionForm from "@/components/ManualTransactionForm";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";
import type { AccountDetailData, AccountTransaction } from "@/lib/account-detail-data";

// ── Types ────────────────────────────────────────────────────────────────────

type Period = "bulan ini" | "bulan lalu" | "3 bulan" | "semua";

interface Props {
  initialData: AccountDetailData;
}

interface AccountOption {
  id: string;
  name: string;
  currency: string;
  accountType: { name: string; classification: string };
}

type PromptResult =
  | { error: string }
  | {
      intent?: string;
      message?: string;
      clarification?: string;
      clarificationType?: string;
      pendingAction?: {
        type: "savings_contribution";
        amount: number;
        accountName?: string;
        date?: string;
        category?: string;
        note?: string;
      };
      options?: { id: string; label: string; description: string }[];
      transaction?: unknown;
      transactions?: unknown[];
    };

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatIDR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

function promptMentionsAccount(prompt: string, accounts: AccountOption[]): boolean {
  const normalized = prompt.toLocaleLowerCase("id-ID");
  return accounts.some((a) => a.name && normalized.includes(a.name.toLocaleLowerCase("id-ID")));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AccountDetailClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState<Period>("bulan ini");
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [transactionCategories, setTransactionCategories] = useState<TransactionCategory[]>([]);
  const [modalDataLoading, setModalDataLoading] = useState(false);
  const [modalDataError, setModalDataError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptResult, setPromptResult] = useState<PromptResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { account, transactions, summary } = data;
  const isLiability = account.accountType.classification === "liability";
  const balance = parseFloat(account.currentBalance);
  const color = account.color ?? account.accountType.color ?? "#6366f1";

  const visibleTransactions = useMemo(
    () => transactions.slice((page - 1) * pageSize, page * pageSize),
    [transactions, page, pageSize]
  );
  const totalPages = Math.max(1, Math.ceil(transactions.length / pageSize));

  // ── Fetch on period change ──────────────────────────────────────────────

  const fetchData = useCallback(
    async (p: Period, opts?: { skipBalance?: boolean; skipAccount?: boolean }) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set("period", p);
        qs.set("limit", "500");
        if (opts?.skipBalance) qs.set("skipBalance", "1");
        if (opts?.skipAccount) qs.set("skipAccount", "1");

        const res = await fetch(`/api/accounts/${account.id}/transactions?${qs.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setData((prev) => ({
            ...prev,
            // On period change balance/account don't change; on data refresh we want updated values.
            account: json.account ?? prev.account,
            transactions: json.transactions,
            summary: json.summary,
          }));
          setPage(1);
        }
      } catch {
        // keep current data
      } finally {
        setLoading(false);
      }
    },
    [account.id]
  );

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    // Period change doesn't affect account metadata or balance — skip re-fetching them.
    fetchData(p, { skipBalance: true, skipAccount: true });
  }

  const fetchModalData = useCallback(async () => {
    setModalDataLoading(true);
    setModalDataError(null);
    try {
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch("/api/accounts", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
      ]);
      if (!accountsRes.ok || !categoriesRes.ok) {
        setModalDataError("Gagal memuat data akun/kategori.");
        return;
      }
      const [accountsJson, categoriesJson] = await Promise.all([
        accountsRes.json(),
        categoriesRes.json(),
      ]);
      setAccounts(accountsJson.accounts ?? []);
      setCategories((categoriesJson.categories ?? []).map((c: { name: string }) => c.name));
      setTransactionCategories((categoriesJson.categories ?? []).map((c: { name: string; type: string }) => ({ name: c.name, type: c.type })));
    } catch {
      setModalDataError("Gagal memuat data akun/kategori.");
    } finally {
      setModalDataLoading(false);
    }
  }, []);

  const handleTransactionCreated = useCallback(() => {
    emitDataChanged(["transactions", "budget", "accounts"]);
  }, []);

  const handleManualTransactionCreated = useCallback(() => {
    fetchData(period);
  }, [fetchData, period]);

  async function handlePromptSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!prompt.trim() || promptLoading) return;

    setPromptLoading(true);
    setPromptResult(null);

    const trimmedPrompt = prompt.trim();
    const effectivePrompt = promptMentionsAccount(trimmedPrompt, accounts)
      ? trimmedPrompt
      : `${trimmedPrompt} akun ${account.name}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: effectivePrompt }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMsg = "Server error. Coba lagi.";
        try { errMsg = JSON.parse(text)?.error ?? errMsg; } catch {}
        setPromptResult({ error: errMsg });
        return;
      }

      const result = await res.json();
      setPromptResult(result);

      if (
        result.intent === "transaksi" ||
        result.intent === "transaksi_bulk" ||
        result.intent === "pemasukan" ||
        result.intent === "transfer"
      ) {
        setPrompt("");
        handleTransactionCreated();
      }
    } catch {
      setPromptResult({ error: "Koneksi gagal. Coba lagi." });
    } finally {
      setPromptLoading(false);
    }
  }

  async function handleSavingsGoalSelect(goalId: string) {
    if (!promptResult || "error" in promptResult || !promptResult.pendingAction || promptLoading) return;

    setPromptLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim() || promptResult.pendingAction.note || "nabung",
          pendingAction: promptResult.pendingAction,
          selectedGoalId: goalId,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let errMsg = "Server error. Coba lagi.";
        try { errMsg = JSON.parse(text)?.error ?? errMsg; } catch {}
        setPromptResult({ error: errMsg });
        return;
      }

      const result = await res.json();
      setPromptResult(result);
      if (result.intent === "transaksi") {
        setPrompt("");
        handleTransactionCreated();
      }
    } catch {
      setPromptResult({ error: "Koneksi gagal. Coba lagi." });
    } finally {
      setPromptLoading(false);
    }
  }

  function handlePromptKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePromptSubmit();
    }
  }

  // Refresh when other tabs emit data changes — fetch everything since balance may have changed.
  useDataEvent(["transactions", "accounts"], () => {
    fetchData(period);
  });

  useDataEvent(["accounts", "categories"], () => {
    if (showAddModal) fetchModalData();
  });

  useEffect(() => {
    fetchModalData();
  }, [fetchModalData]);

  useEffect(() => {
    if (showAddModal) {
      fetchModalData();
      setPromptResult(null);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [showAddModal, fetchModalData]);

  // ── Transaction CRUD handlers ───────────────────────────────────────────

  const handleDeleteTx = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  }, []);

  const handleUpdateTx = useCallback((id: string, updates: Partial<AccountTransaction>) => {
    setData((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  const periods: { label: string; value: Period }[] = [
    { label: "Bulan Ini", value: "bulan ini" },
    { label: "Bulan Lalu", value: "bulan lalu" },
    { label: "3 Bulan", value: "3 bulan" },
    { label: "Semua", value: "semua" },
  ];

  return (
    <>
      {/* Account Header */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <div
            className="h-12 w-12 rounded-xl shrink-0 flex items-center justify-center text-white text-lg font-bold"
            style={{ backgroundColor: color }}
          >
            {account.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold truncate">{account.name}</h1>
              {isLiability && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium shrink-0">
                  Hutang
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{account.accountType.name}</p>
            {account.accountType.name === "Kartu Kredit" &&
              account.tanggalSettlement &&
              account.tanggalJatuhTempo && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Settlement tgl {account.tanggalSettlement} &middot; Jatuh tempo tgl{" "}
                  {account.tanggalJatuhTempo}
                </p>
              )}
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Tambah Transaksi
          </Button>
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground mb-0.5">Saldo Saat Ini</p>
            <p
              className={cn(
                "text-xl font-bold tabular-nums",
                isLiability
                  ? "text-red-500"
                  : balance < 0
                    ? "text-amber-500"
                    : "text-foreground"
              )}
            >
              {formatIDR(balance)}
            </p>
          </div>
        </div>
      </div>

      {/* Period Filter */}
      <div className="flex flex-wrap gap-2">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => handlePeriodChange(p.value)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Masuk</span>
          </div>
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {loading ? "..." : formatIDR(summary.totalIn)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs text-muted-foreground">Keluar</span>
          </div>
          <p className="text-base font-bold text-red-500 tabular-nums">
            {loading ? "..." : formatIDR(summary.totalOut)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">Net</span>
          </div>
          <p
            className={cn(
              "text-base font-bold tabular-nums",
              summary.net >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500"
            )}
          >
            {loading ? "..." : formatIDR(summary.net)}
          </p>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold">
            Riwayat Transaksi{" "}
            {!loading && (
              <span className="text-muted-foreground font-normal">({summary.count})</span>
            )}
          </h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {transactions.length === 0 && !loading ? (
          <div className="text-center py-12 border border-dashed border-border rounded-2xl">
            <p className="text-sm text-muted-foreground">
              Belum ada transaksi di akun ini untuk periode ini.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-2 pl-4 pr-3 text-xs font-medium text-muted-foreground w-20">
                      Tanggal
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground">
                      Deskripsi
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground">
                      Kategori
                    </th>
                    <th className="py-2 pr-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">
                      Akun
                    </th>
                    <th className="py-2 pr-2 text-xs font-medium text-muted-foreground text-right">
                      Jumlah
                    </th>
                    <th className="py-2 pr-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map((t) => (
                    <TransactionCard
                      key={t.id}
                      transaction={t}
                      categories={transactionCategories}
                      onDelete={handleDeleteTx}
                      onUpdate={handleUpdateTx}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {transactions.length > 10 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <div className="flex items-center gap-1">
                  {([10, 20, 50] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setPageSize(s);
                        setPage(1);
                      }}
                      className={cn(
                        "px-2 py-1 rounded-md transition-colors",
                        pageSize === s
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span>
                    {(page - 1) * pageSize + 1}-
                    {Math.min(page * pageSize, transactions.length)} dari{" "}
                    {transactions.length}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-30"
                  >
                    &lsaquo;
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-30"
                  >
                    &rsaquo;
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold">Tambah Transaksi</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Default akun: {account.name}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto">
              <form onSubmit={handlePromptSubmit} className="space-y-2">
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    placeholder={`Contoh: "Makan siang 35rb" akan dicatat di ${account.name}`}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handlePromptKeyDown}
                    rows={2}
                    className="resize-none pr-12 rounded-[20px] shadow-sm py-3 px-4 focus-visible:ring-primary"
                    disabled={promptLoading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!prompt.trim() || promptLoading}
                    className="absolute bottom-2.5 right-2 h-9 w-9 rounded-full shadow-md hover:-translate-y-px transition-transform"
                  >
                    {promptLoading ? (
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

              {promptResult && (
                "error" in promptResult ? (
                  <div className="flex items-start gap-3 rounded-xl px-4 py-3 border border-red-500/40 bg-red-500/5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                    <p className="text-sm text-destructive">{promptResult.error}</p>
                  </div>
                ) : promptResult.intent === "transaksi" || promptResult.intent === "transaksi_bulk" || promptResult.intent === "pemasukan" ? (
                  <div className="flex items-start gap-3 rounded-xl px-4 py-3 border border-green-500/30 bg-green-500/5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600 dark:text-green-400" />
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      {promptResult.message ?? "Transaksi berhasil dicatat."}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl px-4 py-3 border border-amber-500/30 bg-amber-500/5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1">
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        {promptResult.clarification ?? promptResult.message ?? "Tidak bisa memproses permintaan. Coba ulangi dengan kalimat yang berbeda."}
                      </p>
                      {promptResult.clarificationType === "savings_goal_selection" && promptResult.options?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {promptResult.options.map((option) => (
                            <Button
                              key={option.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={promptLoading}
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
                )
              )}

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">atau input manual</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {modalDataLoading ? (
                <div className="h-[280px] animate-pulse rounded-xl bg-muted" />
              ) : modalDataError ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4">
                  <p className="text-sm text-destructive">{modalDataError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchModalData}
                    className="mt-3"
                  >
                    Coba Lagi
                  </Button>
                </div>
              ) : (
                <ManualTransactionForm
                  accounts={accounts}
                  categories={categories}
                  defaultAccountId={account.id}
                  onSuccess={handleManualTransactionCreated}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
