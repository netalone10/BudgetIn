"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitDataChanged } from "@/lib/data-events";

interface Account {
  id: string;
  name: string;
  currency: string;
  accountType: { name: string; classification: string };
}

export interface ManualTransactionCreated {
  type: "expense" | "income" | "transfer";
  amount: number;
  fee: number;
  date: string;
  time: string;
  note: string;
  category: string;
  accountId: string;
  toAccountId: string;
  transactionId?: string;
  feeTransactionId?: string;
  transferId?: string;
}

interface ManualTransactionFormProps {
  accounts: Account[];
  categories: CategoryOption[];
  onSuccess: (created?: ManualTransactionCreated) => void;
  onError?: (message: string) => void;
  onReconcile?: (tempId: string, serverId: string) => void;
  defaultAccountId?: string;
}

type TabType = "expense" | "income" | "transfer";
type CategoryOption = string | { name: string; type?: string | null };

const FORM_CONTROL_CLS = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-none transition-colors placeholder:text-muted-foreground/65 focus:outline-none focus:ring-3 focus:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50";
const FORM_SELECT_CLS = `${FORM_CONTROL_CLS} min-w-0 truncate`;
const FORM_LABEL_CLS = "mb-1.5 block text-[12px] font-semibold text-muted-foreground";
const FORM_FIELD_CLS = "min-w-0";
const FORM_MESSAGE_CLS = "rounded-lg border px-3 py-2 text-xs leading-relaxed";
const FORM_ERROR_CLS = "border-destructive/30 bg-destructive/10 text-destructive";
const FORM_SUCCESS_CLS = "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-400";

function currentLocalTime() {
  return new Date().toTimeString().slice(0, 5);
}

export default function ManualTransactionForm({ accounts, categories, onSuccess, onError, onReconcile, defaultAccountId }: ManualTransactionFormProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("expense");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(currentLocalTime);
  const [timeManuallyEdited, setTimeManuallyEdited] = useState(false);
  const [note, setNote] = useState("");

  // Reset form on tab change
  useEffect(() => {
    setAmount("");
    setFee("");
    setAccountId(defaultAccountId ?? "");
    setToAccountId("");
    setCategory("");
    setTime(currentLocalTime());
    setTimeManuallyEdited(false);
    setNote("");
    setError(null);
    setSuccess(null);
  }, [tab, defaultAccountId]);

  const activeAccounts = accounts.filter((a) => a.id);

  // Check if user has multiple currencies
  const currencies = new Set(activeAccounts.map((a) => a.currency));
  const isMultiCurrency = currencies.size > 1;

  // Grouped accounts for optgroup, sorted alphabetically within each group
  const accountsByType = activeAccounts
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .reduce<Record<string, Account[]>>((acc, a) => {
      const typeName = a.accountType.name;
      if (!acc[typeName]) acc[typeName] = [];
      acc[typeName].push(a);
      return acc;
    }, {});

  // Cross-currency warning
  const fromAcc = activeAccounts.find((a) => a.id === accountId);
  const toAcc = activeAccounts.find((a) => a.id === toAccountId);
  const currencyMismatch =
    tab === "transfer" && fromAcc && toAcc && fromAcc.currency !== toAcc.currency;

  // Liability target label
  const isLiabilityTarget = tab === "transfer" && toAcc?.accountType.classification === "liability";

  const categoryOptions = categories.map((c) => typeof c === "string" ? { name: c } : c);
  const hasTypedCategories = categoryOptions.some((c) => c.type === "expense" || c.type === "income");
  const incomeNames = ["Gaji", "Freelance", "Bonus", "Investasi", "Bisnis", "THR", "Dividen", "Lainnya", "Pemasukan"];
  const expenseCategories = categoryOptions
    .filter((c) => hasTypedCategories ? c.type !== "income" : !incomeNames.includes(c.name))
    .map((c) => c.name);
  const incomeCategories = categoryOptions
    .filter((c) => hasTypedCategories ? c.type === "income" : incomeNames.includes(c.name))
    .map((c) => c.name);
  const currentCategories = tab === "income" ? incomeCategories : expenseCategories;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsedAmount = Number(amount);
    if (!amount || isNaN(parsedAmount)) {
      setError("Nominal tidak valid.");
      toast.error("Nominal tidak valid.");
      return;
    }
    if (tab === "transfer" && parsedAmount <= 0) {
      setError("Nominal transfer harus lebih dari 0.");
      toast.error("Nominal transfer harus lebih dari 0.");
      return;
    }
    if (tab !== "transfer" && parsedAmount === 0) {
      setError("Nominal tidak boleh 0.");
      toast.error("Nominal tidak boleh 0.");
      return;
    }
    const parsedFee = fee.trim() === "" ? 0 : Number(fee);
    if (tab === "transfer" && (!Number.isFinite(parsedFee) || parsedFee < 0)) {
      setError("Fee harus 0 atau lebih.");
      toast.error("Fee harus 0 atau lebih.");
      return;
    }

    const submitTime = timeManuallyEdited ? time : currentLocalTime();
    const payload: Record<string, unknown> = { type: tab, amount: parsedAmount, date, time: submitTime, note };

    if (tab === "transfer") {
      payload.accountId = accountId;
      payload.toAccountId = toAccountId;
      if (parsedFee > 0) payload.fee = parsedFee;
    } else {
      payload.accountId = accountId;
      payload.category = category;
    }

    // Snapshot all submit values BEFORE resetting form (so background fetch sees them
    // even if user starts typing another transaction).
    const submitTab = tab;
    const submitAccountId = accountId;
    const submitToAccountId = toAccountId;
    const submitCategory = category;
    const submitNote = note ?? "";
    const submitDate = date;

    // Build optimistic record with temp IDs — listeners (DashboardClient,
    // AccountDetailClient) push these into local state instantly. Real IDs
    // arrive on next refetch after server confirms.
    const tempStamp = Date.now();
    const optimisticCreated: ManualTransactionCreated = {
      type: submitTab,
      amount: parsedAmount,
      fee: parsedFee,
      date: submitDate,
      time: submitTime,
      note: submitNote,
      category: submitTab === "transfer" ? "Transfer" : submitCategory,
      accountId: submitAccountId,
      toAccountId: submitTab === "transfer" ? submitToAccountId : "",
      transactionId: `temp-${tempStamp}`,
      feeTransactionId: parsedFee > 0 ? `temp-fee-${tempStamp}` : undefined,
      transferId: submitTab === "transfer" ? `temp-tr-${tempStamp}` : undefined,
    };

    const successMessage =
      submitTab === "transfer" ? "Transfer berhasil dicatat." : "Transaksi berhasil dicatat.";

    // Optimistic UX: reset form, toast, and notify parent immediately —
    // BEFORE the network round-trip. Perceived latency drops to ~0.
    setSuccess(successMessage);
    toast.success(successMessage);
    setAmount("");
    setFee("");
    setNote("");
    setCategory("");
    setTime(currentLocalTime());
    setTimeManuallyEdited(false);
    onSuccess(optimisticCreated);
    setLoading(false);

    // Fire POST in background. On success, broadcast so listeners refetch
    // and reconcile (replacing temp IDs with real ones). On failure, toast
    // error AND broadcast — refetch then removes the orphaned temp row.
    try {
      const res = await fetch("/api/transactions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = data?.error || "Gagal menyimpan transaksi.";
        setError(message);
        toast.error(message);
        onError?.(message);
      } else if (onReconcile && data) {
        // Replace temp IDs with real server IDs so subsequent delete/edit use valid IDs.
        if (optimisticCreated.transactionId && data.transaction?.id) {
          onReconcile(optimisticCreated.transactionId, data.transaction.id);
        }
        if (optimisticCreated.feeTransactionId && data.feeTransaction?.id) {
          onReconcile(optimisticCreated.feeTransactionId, data.feeTransaction.id);
        }
        // For transfer (Prisma path): reconcile transferId with data.transferId
        if (optimisticCreated.transferId && data.transferId) {
          onReconcile(optimisticCreated.transferId, data.transferId);
        }
      }
    } catch {
      const message = "Terjadi kesalahan. Coba lagi.";
      setError(message);
      toast.error(message);
      onError?.(message);
    } finally {
      emitDataChanged(["transactions", "budget", "accounts"]);
    }
  }

  if (activeAccounts.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-border/70 bg-background/80 px-4 py-6 text-center">
        <p className="mb-3 text-sm text-muted-foreground">Belum ada akun. Buat akun dulu untuk mulai input manual.</p>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => router.push("/dashboard/accounts")}>
          Buat Akun Pertama →
        </Button>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; icon: React.ElementType; color: string }[] = [
    { key: "expense", label: "Pengeluaran", icon: ArrowDownCircle, color: "text-red-500" },
    { key: "income", label: "Pemasukan", icon: ArrowUpCircle, color: "text-emerald-500" },
    { key: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "text-blue-500" },
  ];

  return (
    <div className="overflow-hidden rounded-[22px] border border-border/70 bg-background">
      {/* Tab bar */}
      <div className="border-b border-border/70 bg-muted/25 p-2">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1">
        {tabs.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-lg p-2 text-[13px] font-semibold transition-all",
              tab === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            <Icon className={cn("size-4 shrink-0", tab === key ? "text-primary-foreground" : color)} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
        <div aria-live="polite" className="space-y-2">
          {error && (
            <p className={cn(FORM_MESSAGE_CLS, FORM_ERROR_CLS)}>{error}</p>
          )}
          {success && (
            <p className={cn(FORM_MESSAGE_CLS, FORM_SUCCESS_CLS)}>
              ✓ {success}
            </p>
          )}
        </div>

        {/* Amount */}
        <div className={FORM_FIELD_CLS}>
          <label htmlFor="manualtransactionform-field-1" className={FORM_LABEL_CLS}>Nominal (Rp)</label>
          <input id="manualtransactionform-field-1"
            type="number"
            min={tab === "transfer" ? "1" : "-1000000000"}
            max="1000000000"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            required
            className={cn(FORM_CONTROL_CLS, "text-base font-semibold tabular-nums")}
          />
        </div>

        {/* Account(s) */}
        {tab === "transfer" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className={FORM_FIELD_CLS}>
              <label htmlFor="manualtransactionform-field-2" className={FORM_LABEL_CLS}>Dari Akun</label>
              <select id="manualtransactionform-field-2"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className={FORM_SELECT_CLS}
              >
                <option value="">Pilih akun</option>
                {Object.entries(accountsByType).map(([typeName, accs]) => (
                  <optgroup key={typeName} label={typeName}>
                    {accs.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === toAccountId}>
                        {isMultiCurrency ? `${a.name} (${a.currency})` : a.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className={FORM_FIELD_CLS}>
              <label htmlFor="manualtransactionform-field-3" className={FORM_LABEL_CLS}>
                {isLiabilityTarget ? "Bayar ke" : "Ke Akun"}
              </label>
              <select id="manualtransactionform-field-3"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                required
                className={FORM_SELECT_CLS}
              >
                <option value="">Pilih akun</option>
                {Object.entries(accountsByType).map(([typeName, accs]) => (
                  <optgroup key={typeName} label={typeName}>
                    {accs.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === accountId}>
                        {isMultiCurrency ? `${a.name} (${a.currency})` : a.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            </div>
            <div className={FORM_FIELD_CLS}>
              <label htmlFor="manualtransactionform-field-4" className={FORM_LABEL_CLS}>Fee (opsional)</label>
              <input id="manualtransactionform-field-4"
                type="number"
                min="0"
                max="1000000000"
                step="1"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
                className={cn(FORM_CONTROL_CLS, "tabular-nums")}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Jika diisi, fee dicatat sebagai pengeluaran kategori Biaya Admin dari akun asal.</p>
            </div>
          </div>
        ) : (
          <div className={FORM_FIELD_CLS}>
            <label htmlFor="manualtransactionform-field-5" className={FORM_LABEL_CLS}>
              {tab === "income" ? "Masuk ke Akun" : "Dari Akun"}
            </label>
            <select id="manualtransactionform-field-5"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className={FORM_SELECT_CLS}
            >
              <option value="">Pilih akun</option>
              {Object.entries(accountsByType).map(([typeName, accs]) => (
                <optgroup key={typeName} label={typeName}>
                  {accs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {isMultiCurrency ? `${a.name} (${a.currency})` : a.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {/* Category (not for transfer) */}
        {tab !== "transfer" && (
          <div className={FORM_FIELD_CLS}>
            <label htmlFor="manualtransactionform-field-6" className={FORM_LABEL_CLS}>Kategori</label>
            <select id="manualtransactionform-field-6"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className={FORM_SELECT_CLS}
            >
              <option value="">Pilih kategori</option>
              {currentCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date + Note */}
        <div className="grid grid-cols-2 gap-3">
          <div className={FORM_FIELD_CLS}>
            <label htmlFor="manualtransactionform-field-7" className={FORM_LABEL_CLS}>Tanggal</label>
            <input id="manualtransactionform-field-7"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={FORM_CONTROL_CLS}
            />
          </div>
          <div className={FORM_FIELD_CLS}>
            <label htmlFor="manualtransactionform-field-8" className={FORM_LABEL_CLS}>Jam</label>
            <input id="manualtransactionform-field-8"
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setTimeManuallyEdited(true);
              }}
              required
              className={FORM_CONTROL_CLS}
            />
          </div>
        </div>
        <div className={FORM_FIELD_CLS}>
          <label htmlFor="manualtransactionform-field-9" className={FORM_LABEL_CLS}>Catatan (opsional)</label>
          <input id="manualtransactionform-field-9"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tulis catatan…"
            className={FORM_CONTROL_CLS}
          />
        </div>

        {/* Warnings */}
        {currencyMismatch && (
          <p className={cn(FORM_MESSAGE_CLS, "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-400")}>
            ⚠️ Transfer beda mata uang ({fromAcc?.currency} → {toAcc?.currency}) belum didukung. Catat sebagai pengeluaran dan pemasukan terpisah.
          </p>
        )}
        {isLiabilityTarget && !currencyMismatch && (
          <p className={cn(FORM_MESSAGE_CLS, "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-400")}>
            💡 Pembayaran cicilan/hutang: uang keluar dari akun asal, saldo hutang berkurang. Net worth tidak berubah.
          </p>
        )}
        <Button
          type="submit"
          disabled={loading || !!currencyMismatch}
          className="h-10 w-full rounded-lg"
          size="sm"
        >
          {loading ? (
            <><Loader2 className="size-4 animate-spin mr-2" /> Menyimpan…</>
          ) : tab === "transfer" ? (
            isLiabilityTarget ? "Catat Pembayaran Cicilan/Hutang" : "Catat Transfer"
          ) : tab === "income" ? (
            "Catat Pemasukan"
          ) : (
            "Catat Pengeluaran"
          )}
        </Button>
      </form>
    </div>
  );
}
