"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Plus, Loader2, Wallet, AlertCircle, Tags, Edit2, Trash2,
  ChevronDown, ChevronRight, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountType {
  id: string;
  name: string;
  classification: "asset" | "liability";
  icon: string;
  color: string;
}

interface AccountData {
  id: string;
  name: string;
  currency: string;
  color: string | null;
  icon: string | null;
  note: string;
  currentBalance: string;
  transactionCount: number;
  accountType: AccountType;
  tanggalSettlement?: number | null;
  tanggalJatuhTempo?: number | null;
}

interface Summary {
  assets: string;
  liabilities: string;
  netWorth: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatIDR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

// ── Account Form Modal ────────────────────────────────────────────────────────

interface AccountFormModalProps {
  accountTypes: AccountType[];
  editAccount?: AccountData;
  isSheets?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function AccountFormModal({ accountTypes, editAccount, isSheets, onClose, onSaved }: AccountFormModalProps) {
  const [name, setName] = useState(editAccount?.name ?? "");
  const [accountTypeId, setAccountTypeId] = useState(editAccount?.accountType.id ?? (accountTypes[0]?.id ?? ""));
  const [initialBalance, setInitialBalance] = useState("");
  const [currency, setCurrency] = useState(editAccount?.currency ?? "IDR");
  const [note, setNote] = useState(editAccount?.note ?? "");
  const [tanggalSettlement, setTanggalSettlement] = useState<number | "">(editAccount?.tanggalSettlement ?? "");
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState<number | "">(editAccount?.tanggalJatuhTempo ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editAccount;
  const hasTransactions = editAccount ? editAccount.transactionCount > 0 : false;
  
  // Check if selected type is Kartu Kredit
  const selectedType = accountTypes.find(t => t.id === accountTypeId);
  const isKartuKredit = selectedType?.name === "Kartu Kredit";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Get the selected account type info
      const selectedType = accountTypes.find(t => t.id === accountTypeId);
      
      // For Sheets users, send accountTypeName and classification instead of accountTypeId
      const payload: Record<string, unknown> = isSheets ? { 
        name, 
        note, 
        currency,
        accountTypeName: selectedType?.name,
        classification: selectedType?.classification,
      } : { accountTypeId, name, note, currency };
      
      // Add credit card fields if Kartu Kredit
      if (isKartuKredit) {
        payload.tanggalSettlement = tanggalSettlement;
        payload.tanggalJatuhTempo = tanggalJatuhTempo;
      }

      const res = isEdit
        ? await fetch(`/api/accounts/${editAccount!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/accounts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, initialBalance: initialBalance || 0 }),
          });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal menyimpan akun."); return; }
      onSaved();
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">{isEdit ? "Edit Akun" : "Tambah Akun"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nama Akun *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
              placeholder="BCA Tabungan, OVO, Dompet Cash..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipe Akun *</label>
            <select
              value={accountTypeId}
              onChange={(e) => setAccountTypeId(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {accountTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.classification === "asset" ? "Aset" : "Liability"})</option>
              ))}
            </select>
            <Link href="/dashboard/settings/account-types" className="text-xs text-primary hover:underline mt-1 inline-block">
              + Tambah tipe baru
            </Link>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Saldo Awal (Rp)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground mt-1">Masukkan saldo yang ada saat ini di akun ini.</p>
            </div>
          )}

          {isEdit && hasTransactions && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Saldo awal & mata uang tidak bisa diubah karena sudah ada transaksi. Gunakan "Sesuaikan Saldo" untuk koreksi.
            </p>
          )}

          {!hasTransactions && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Mata Uang</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="IDR">IDR (Rupiah)</option>
                <option value="USD">USD (Dollar)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Catatan (opsional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Catatan tentang akun ini..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Kartu Kredit Fields */}
          {isKartuKredit && (
            <div className="space-y-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50">
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">Pengaturan Kartu Kredit</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tanggal Settlement *</label>
                  <select
                    value={tanggalSettlement}
                    onChange={(e) => setTanggalSettlement(e.target.value ? Number(e.target.value) : "")}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Pilih tanggal</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">Awal periode tagihan</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Tanggal Jatuh Tempo *</label>
                  <select
                    value={tanggalJatuhTempo}
                    onChange={(e) => setTanggalJatuhTempo(e.target.value ? Number(e.target.value) : "")}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Pilih tanggal</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">Batas maksimal pembayaran</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Contoh: Settlement 17, Jatuh Tempo 5 → Perioda 16 Des - 17 Jan, jatuh tempo 5 Feb
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? "Simpan" : "Tambah Akun"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Adjust Balance Modal ──────────────────────────────────────────────────────

function AdjustBalanceModal({ account, onClose, onSaved }: { account: AccountData; onClose: () => void; onSaved: () => void }) {
  const [targetBalance, setTargetBalance] = useState(parseFloat(account.currentBalance).toFixed(0));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`/api/accounts/${account.id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetBalance: Number(targetBalance), note }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Gagal."); setLoading(false); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-base font-semibold">Sesuaikan Saldo — {account.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Saldo Seharusnya (Rp)</label>
            <input
              type="number"
              step="1"
              value={targetBalance}
              onChange={(e) => setTargetBalance(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Saldo saat ini: {formatIDR(account.currentBalance)}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Catatan (opsional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alasan penyesuaian..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sesuaikan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Account Card ──────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onEdit,
  onAdjust,
  onDelete,
}: {
  account: AccountData;
  onEdit: (a: AccountData) => void;
  onAdjust: (a: AccountData) => void;
  onDelete: (a: AccountData) => void;
}) {
  const isLiability = account.accountType.classification === "liability";
  const balance = parseFloat(account.currentBalance);
  const color = account.color ?? account.accountType.color;

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4 hover:border-border/80 transition-colors gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-9 w-9 rounded-lg shrink-0 flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: color }}
        >
          {account.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{account.name}</span>
            {isLiability && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium shrink-0">
                Hutang
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{account.accountType.name}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            isLiability ? "text-red-500" : balance < 0 ? "text-amber-500" : "text-foreground"
          )}
        >
          {formatIDR(balance)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAdjust(account)}
            title="Sesuaikan Saldo"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(account)}
            title="Edit"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(account)}
            title={balance !== 0 ? "Saldo harus 0 untuk mengarsipkan" : "Arsipkan akun"}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              balance !== 0
                ? "text-muted-foreground/30 cursor-not-allowed"
                : "text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            )}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { status, data: session } = useSession({
    required: true,
    onUnauthenticated() { redirect("/"); },
  });

  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountData | null>(null);
  const [adjustAccount, setAdjustAccount] = useState<AccountData | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const isSheets = !!session?.sheetsId;

  const fetchData = useCallback(async (noStore = false) => {
    setLoading(true);
    setError(null);
    try {
      const opts = noStore ? { cache: "no-store" as const } : undefined;
      const [accRes, typeRes] = await Promise.all([
        fetch("/api/accounts", opts),
        fetch("/api/account-types", opts),
      ]);
      const accData = await accRes.json();
      const typeData = await typeRes.json();
      setAccounts(accData.accounts ?? []);
      setSummary(accData.summary ?? null);
      setAccountTypes(typeData.accountTypes ?? []);
    } catch {
      setError("Gagal memuat data akun.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchData();
  }, [status, fetchData]);

  useDataEvent(["accounts", "transactions"], () => {
    if (status === "authenticated") fetchData(true);
  });

  async function handleDelete(account: AccountData) {
    const balance = parseFloat(account.currentBalance);
    if (balance !== 0) {
      alert(`Saldo akun masih ${formatIDR(balance)}. Transfer atau sesuaikan saldo ke 0 sebelum mengarsipkan.`);
      return;
    }
    if (!confirm(`Arsipkan akun "${account.name}"? Transaksi tetap tersimpan.`)) return;
    const res = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchData();
      emitDataChanged(["accounts", "transactions"]);
    } else {
      const d = await res.json();
      alert(d.error || "Gagal mengarsipkan.");
    }
  }

  // Group by type
  const groupedAccounts = accounts.reduce<Record<string, AccountData[]>>((acc, a) => {
    const key = a.accountType.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const assetTotal = parseFloat(summary?.assets ?? "0");
  const liabTotal = parseFloat(summary?.liabilities ?? "0");
  const netWorth = parseFloat(summary?.netWorth ?? "0");
  const isPositive = netWorth >= 0;

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Akun & Dompet</h1>
            <p className="text-xs text-muted-foreground">Lacak saldo dan kekayaan bersih</p>
          </div>
        </div>
        <Button onClick={() => setShowAddModal(true)} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Tambah Akun
        </Button>
      </div>

      {/* Sheets banner */}
      {isSheets && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Kamu login via Google. Fitur Akun & Dompet disimpan di database terpisah dari Google Sheets.
            Transaksi baru melalui form manual akan dicatat di sini.
          </p>
        </div>
      )}

      {/* Net Worth Hero */}
      {summary && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Aset</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatIDR(assetTotal)}
              </p>
            </div>
            <div className="border-x border-border">
              <p className="text-xs text-muted-foreground mb-1">Kekayaan Bersih</p>
              <p className={cn(
                "text-xl font-bold tabular-nums",
                isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              )}>
                {formatIDR(netWorth)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Utang</p>
              <p className="text-lg font-bold text-red-500 tabular-nums">
                {formatIDR(liabTotal)}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl p-4">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Account list */}
      {accounts.length === 0 && !loading ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Wallet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Belum ada akun. Tambahkan akun pertamamu!</p>
          <Button onClick={() => setShowAddModal(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Tambah Akun
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedAccounts).map(([typeName, accs]) => (
            <div key={typeName}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{typeName}</h3>
                <span className="text-xs text-muted-foreground">
                  {formatIDR(accs.reduce((s, a) => s + parseFloat(a.currentBalance), 0))}
                </span>
              </div>
              <div className="space-y-2">
                {accs.map((a) => (
                  <AccountCard
                    key={a.id}
                    account={a}
                    onEdit={setEditAccount}
                    onAdjust={setAdjustAccount}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings link */}
      <div className="flex items-center justify-center pt-2">
        <Link
          href="/dashboard/settings/account-types"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Tags className="h-3.5 w-3.5" />
          Kelola tipe akun →
        </Link>
      </div>

      {/* Modals */}
      {showAddModal && (
        <AccountFormModal
          accountTypes={accountTypes}
          isSheets={isSheets}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchData(); emitDataChanged(["accounts"]); }}
        />
      )}
      {editAccount && (
        <AccountFormModal
          accountTypes={accountTypes}
          editAccount={editAccount}
          isSheets={isSheets}
          onClose={() => setEditAccount(null)}
          onSaved={() => { setEditAccount(null); fetchData(); emitDataChanged(["accounts"]); }}
        />
      )}
      {adjustAccount && (
        <AdjustBalanceModal
          account={adjustAccount}
          onClose={() => setAdjustAccount(null)}
          onSaved={() => { setAdjustAccount(null); fetchData(); emitDataChanged(["accounts", "transactions"]); }}
        />
      )}
    </div>
  );
}
