"use client";

import { useState, useEffect, useCallback, useMemo, memo, createElement } from "react";
import { useSession } from "next-auth/react";
import { redirect, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus, Loader2, Wallet, AlertCircle, Tags, Edit2, Trash2,
  ChevronDown, ChevronRight, RefreshCw, Eye, Landmark, Smartphone,
  TrendingUp, Bitcoin, House, Car, HandCoins, CreditCard, Ellipsis, Sparkles,
  type LucideIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emitDataChanged, useDataEvent } from "@/lib/data-events";
import AccountsSkeleton from "./AccountsSkeleton";
import SetupAccountsModal from "@/components/SetupAccountsModal";
import { useIsDemo } from "@/lib/hooks/use-is-demo";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AccountType {
  id: string;
  name: string;
  classification: "asset" | "liability";
  icon: string;
  color: string;
  isActive?: boolean;
}

interface RecentTransaction {
  id: string;
  date: string;
  amount: number;
  note: string;
  type: "expense" | "income" | "transfer_out" | "transfer_in";
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
  recentTransactions?: RecentTransaction[];
}

interface Summary {
  assets: string;
  liabilities: string;
  netWorth: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const IDR_FORMAT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
const ID_NUMBER_FORMAT = new Intl.NumberFormat("id-ID");

function formatIDR(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return IDR_FORMAT.format(num);
}

function formatShortAmount(amount: number): string {
  return ID_NUMBER_FORMAT.format(amount);
}

function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

const ACCOUNT_TYPE_ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  landmark: Landmark,
  smartphone: Smartphone,
  "trending-up": TrendingUp,
  bitcoin: Bitcoin,
  home: House,
  car: Car,
  handshake: HandCoins,
  "credit-card": CreditCard,
  "more-horizontal": Ellipsis,
};

const ACCOUNT_TYPE_ICON_BY_NAME: Record<string, string> = {
  Kas: "wallet",
  Bank: "landmark",
  "E-Wallet": "smartphone",
  Investasi: "trending-up",
  Kripto: "bitcoin",
  Properti: "home",
  Kendaraan: "car",
  Piutang: "handshake",
  Hutang: "credit-card",
  "Kartu Kredit": "credit-card",
  Lainnya: "more-horizontal",
};

const ACCOUNT_TYPE_COLOR_BY_NAME: Record<string, string> = {
  Kas: "#10b981",
  Bank: "#3b82f6",
  "E-Wallet": "#8b5cf6",
  Investasi: "#f59e0b",
  Kripto: "#f97316",
  Properti: "#14b8a6",
  Kendaraan: "#06b6d4",
  Piutang: "#84cc16",
  Hutang: "#ef4444",
  "Kartu Kredit": "#dc2626",
  Lainnya: "#6b7280",
};

function getAccountIcon(iconName?: string | null, typeName?: string): LucideIcon {
  const resolvedIconName = iconName ?? (typeName ? ACCOUNT_TYPE_ICON_BY_NAME[typeName] : undefined);
  if (!resolvedIconName) return Wallet;
  return ACCOUNT_TYPE_ICONS[resolvedIconName] ?? Wallet;
}

function getAccountBadgeColor(account: Pick<AccountData, "color" | "accountType">): string {
  return account.color ?? account.accountType.color ?? ACCOUNT_TYPE_COLOR_BY_NAME[account.accountType.name] ?? "#6b7280";
}

function getAccountTypeValue(type?: Pick<AccountType, "id" | "name" | "classification">): string {
  if (!type) return "";
  return type.id || `${type.name}::${type.classification}`;
}

// Urutan likuiditas grup akun (asset → liability).
// Index lebih kecil = lebih liquid / lebih dahulu tampil.
const LIQUIDITY_ORDER: Record<string, number> = {
  // Aset (paling liquid → paling tidak liquid)
  "Kas": 10,
  "Bank": 20,
  "E-Wallet": 30,
  "Investasi": 40,
  "Kripto": 50,
  "Piutang": 60,
  "Properti": 70,
  "Kendaraan": 80,
  "Lainnya": 90,
  // Liabilitas (di-handle terpisah; nilai di sini hanya untuk antar-liability)
  "Kartu Kredit": 1000,
  "Hutang": 1010,
};

function liquidityRank(typeName: string, classification: "asset" | "liability"): number {
  const known = LIQUIDITY_ORDER[typeName];
  if (known !== undefined) return known;
  // Tipe custom: taruh di akhir kelompok klasifikasinya
  return classification === "liability" ? 9999 : 999;
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
  const [accountTypeId, setAccountTypeId] = useState(
    getAccountTypeValue(editAccount?.accountType) || getAccountTypeValue(accountTypes[0])
  );
  const [initialBalance, setInitialBalance] = useState("");
  const [currency, setCurrency] = useState(editAccount?.currency ?? "IDR");
  const [note, setNote] = useState(editAccount?.note ?? "");
  const [tanggalSettlement, setTanggalSettlement] = useState<number | "">(editAccount?.tanggalSettlement ?? "");
  const [tanggalJatuhTempo, setTanggalJatuhTempo] = useState<number | "">(editAccount?.tanggalJatuhTempo ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!editAccount;
  const hasTransactions = editAccount ? editAccount.transactionCount > 0 : false;
  const selectableAccountTypes = useMemo(
    () => accountTypes.filter((t) =>
      t.isActive !== false ||
      (editAccount && (t.id === editAccount.accountType.id || (t.name === editAccount.accountType.name && t.classification === editAccount.accountType.classification)))
    ),
    [accountTypes, editAccount]
  );
  
  // Check if selected type is Kartu Kredit
  const selectedType = selectableAccountTypes.find((t) => getAccountTypeValue(t) === accountTypeId);
  const isKartuKredit = selectedType?.name === "Kartu Kredit";

  // Keep accountTypeId valid as the available types change. Render-phase update
  // (converges to a stable value) instead of a setState-in-effect.
  if (selectableAccountTypes.length === 0) {
    if (accountTypeId !== "") setAccountTypeId("");
  } else if (
    !(accountTypeId && selectableAccountTypes.some((t) => getAccountTypeValue(t) === accountTypeId))
  ) {
    const editType = editAccount
      ? selectableAccountTypes.find(
          (t) =>
            t.id === editAccount.accountType.id ||
            (t.name === editAccount.accountType.name &&
              t.classification === editAccount.accountType.classification),
        )
      : undefined;
    const nextTypeId = getAccountTypeValue(editType ?? selectableAccountTypes[0]);
    if (nextTypeId !== accountTypeId) setAccountTypeId(nextTypeId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selectedType = selectableAccountTypes.find((t) => getAccountTypeValue(t) === accountTypeId);
    if (!selectedType || (!isSheets && !selectedType.id)) {
      setError("Tipe akun harus dipilih.");
      return;
    }

    setLoading(true);

    try {
      // For Sheets users, send accountTypeName and classification instead of accountTypeId
      const payload: Record<string, unknown> = isSheets ? { 
        name, 
        note, 
        currency,
        accountTypeName: selectedType.name,
        classification: selectedType.classification,
      } : { accountTypeId: selectedType.id, name, note, currency };
      
      // Add credit card fields if Kartu Kredit
      if (isKartuKredit) {
        payload.tanggalSettlement = tanggalSettlement;
        payload.tanggalJatuhTempo = tanggalJatuhTempo;
      } else if (isEdit) {
        payload.tanggalSettlement = null;
        payload.tanggalJatuhTempo = null;
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
            <label htmlFor="accountsclient-field-1" className="block text-xs font-medium text-muted-foreground mb-1">Nama Akun *</label>
            <input id="accountsclient-field-1"
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
            <label htmlFor="accountsclient-field-2" className="block text-xs font-medium text-muted-foreground mb-1">Tipe Akun *</label>
            <select id="accountsclient-field-2"
              value={accountTypeId}
              onChange={(e) => setAccountTypeId(e.target.value)}
              required
              disabled={loading || selectableAccountTypes.length === 0}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {selectableAccountTypes.length === 0 && <option value="">Tipe akun belum tersedia</option>}
              {selectableAccountTypes.map((t) => (
                <option key={getAccountTypeValue(t)} value={getAccountTypeValue(t)}>{t.name} ({t.classification === "asset" ? "Aset" : "Liability"})</option>
              ))}
            </select>
            <Link href="/dashboard/settings/account-types" className="text-xs text-primary hover:underline mt-1 inline-block">
              + Tambah tipe baru
            </Link>
          </div>

          {!isEdit && (
            <div>
              <label htmlFor="accountsclient-field-3" className="block text-xs font-medium text-muted-foreground mb-1">Saldo Awal (Rp)</label>
              <input id="accountsclient-field-3"
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
              Saldo awal & mata uang tidak bisa diubah karena sudah ada transaksi. Gunakan &quot;Sesuaikan Saldo&quot; untuk koreksi.
            </p>
          )}

          {!hasTransactions && (
            <div>
              <label htmlFor="accountsclient-field-4" className="block text-xs font-medium text-muted-foreground mb-1">Mata Uang</label>
              <select id="accountsclient-field-4"
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
            <label htmlFor="accountsclient-field-5" className="block text-xs font-medium text-muted-foreground mb-1">Catatan (opsional)</label>
            <input id="accountsclient-field-5"
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
                  <label htmlFor="accountsclient-field-6" className="block text-xs font-medium text-muted-foreground mb-1">Tanggal Settlement *</label>
                  <select id="accountsclient-field-6"
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
                  <label htmlFor="accountsclient-field-7" className="block text-xs font-medium text-muted-foreground mb-1">Tanggal Jatuh Tempo *</label>
                  <select id="accountsclient-field-7"
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
            <Button type="submit" className="flex-1" disabled={loading || !selectedType}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Simpan" : "Tambah Akun"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Adjust Balance Modal ──────────────────────────────────────────────────────

function AdjustBalanceModal({ account, onClose, onSaved }: { account: AccountData; onClose: () => void; onSaved: () => void }) {
  const [targetBalance, setTargetBalance] = useState(() => parseFloat(account.currentBalance).toFixed(0));
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
            <label htmlFor="accountsclient-field-8" className="block text-xs font-medium text-muted-foreground mb-1">Saldo Seharusnya (Rp)</label>
            <input id="accountsclient-field-8"
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
            <label htmlFor="accountsclient-field-9" className="block text-xs font-medium text-muted-foreground mb-1">Catatan (opsional)</label>
            <input id="accountsclient-field-9"
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
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Sesuaikan"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Account Card ──────────────────────────────────────────────────────────────

const AccountCard = memo(function AccountCard({
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
  const isDemo = useIsDemo();
  const router = useRouter();
  const isLiability = account.accountType.classification === "liability";
  const balance = parseFloat(account.currentBalance);
  const color = getAccountBadgeColor(account);
  const recent = account.recentTransactions ?? [];
  const accountIcon = getAccountIcon(account.icon ?? account.accountType.icon, account.accountType.name);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background transition-colors hover:border-border/80">
      {/* Header row */}
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="size-9 rounded-lg shrink-0 flex items-center justify-center text-white"
            style={{ backgroundColor: color }}
          >
            {createElement(accountIcon, { className: "size-4" })}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium leading-snug">{account.name}</span>
              {isLiability && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium shrink-0">
                  Hutang
                </span>
              )}
            </div>
            <span className="block text-xs text-muted-foreground truncate">{account.accountType.name}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:shrink-0 sm:justify-end sm:gap-3">
          <span
            className={cn(
              "text-base font-semibold tabular-nums whitespace-nowrap sm:text-sm",
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
              <RefreshCw className="size-3.5" />
            </button>
            {!isDemo && (
            <>
            <button
              onClick={() => onEdit(account)}
              title="Edit"
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <Edit2 className="size-3.5" />
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
              <Trash2 className="size-3.5" />
            </button>
            </>
            )}
          </div>
        </div>
      </div>

      {/* Recent transactions preview */}
      {recent.length > 0 && (
        <div className="space-y-1 border-t border-border px-4 py-2.5">
          {recent.map((t) => {
            const isIn = t.type === "income" || t.type === "transfer_in";
            return (
              <div key={t.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-2 text-xs">
                <>
                  <span className="text-muted-foreground w-12 shrink-0">{formatShortDate(t.date)}</span>
                  <span className="break-words leading-snug">{t.note || "—"}</span>
                </>
                <span className={cn("shrink-0 tabular-nums", isIn ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                  {isIn ? "+" : "-"}{formatShortAmount(t.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* View all link */}
      <button
        onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-border px-4 py-2 text-xs text-primary transition-all hover:bg-muted/40 hover:text-primary/80 active:scale-[0.98] active:bg-muted/60"
      >
        <Eye className="size-3" />
        Lihat semua transaksi
        <ChevronRight className="size-3" />
      </button>
    </div>
  );
});
AccountCard.displayName = "AccountCard";

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { status, data: session } = useSession({
    required: true,
    onUnauthenticated() { redirect("/"); },
  });
  const isDemo = session?.isDemo === true;

  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [editAccount, setEditAccount] = useState<AccountData | null>(null);
  const [adjustAccount, setAdjustAccount] = useState<AccountData | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const isSheets = !!session?.sheetsId;

  const fetchData = useCallback(
    async (opts?: { noStore?: boolean; silent?: boolean }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const fetchOpts = { cache: "no-store" as const };
        const [accRes, typeRes, recentRes] = await Promise.all([
          fetch("/api/accounts", fetchOpts),
          fetch("/api/account-types", fetchOpts),
          fetch("/api/accounts/recent-transactions?limit=5", fetchOpts),
        ]);
        if (!accRes.ok) {
          const errData = await accRes.json().catch(() => ({}));
          if (!opts?.silent) setError((errData as { error?: string }).error || "Gagal memuat data akun.");
          return;
        }
        if (!typeRes.ok) {
          const errData = await typeRes.json().catch(() => ({}));
          if (!opts?.silent) setError((errData as { error?: string }).error || "Gagal memuat tipe akun.");
          return;
        }
        const accData = await accRes.json();
        const typeData = await typeRes.json();
        const recentData = recentRes.ok ? await recentRes.json() : { byAccount: {} };
        const recentMap: Record<string, RecentTransaction[]> = recentData.byAccount ?? {};
        const accs: AccountData[] = (accData.accounts ?? []).map((a: AccountData) => ({
          ...a,
          recentTransactions: recentMap[a.id] ?? [],
        }));
        setSummary(accData.summary ?? null);
        setAccountTypes(typeData.accountTypes ?? []);
        setAccounts(accs);
      } catch {
        if (!opts?.silent) setError("Gagal memuat data akun.");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (status !== "authenticated") return;
    // Defer off the synchronous effect path: setState happens in the promise
    // callback, not during the effect body (avoids cascading renders).
    let active = true;
    Promise.resolve().then(() => {
      if (active) fetchData();
    });
    return () => {
      active = false;
    };
  }, [status, fetchData]);

  useDataEvent(["accounts", "transactions"], () => {
    if (status === "authenticated") fetchData({ noStore: true, silent: true });
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

  // Group by type, lalu pisahkan asset vs liability dan urutkan berdasarkan likuiditas.
  type AccountGroup = {
    typeName: string;
    classification: "asset" | "liability";
    accounts: AccountData[];
  };
  const { assetGroups, liabilityGroups, assetTotal, liabTotal, netWorth, isPositive } = useMemo(() => {
    const groupMap = accounts.reduce<Record<string, AccountGroup>>((acc, a) => {
      const key = a.accountType.name;
      if (!acc[key]) {
        acc[key] = {
          typeName: key,
          classification: a.accountType.classification,
          accounts: [],
        };
      }
      acc[key].accounts.push(a);
      return acc;
    }, {});
    const allGroups = Object.values(groupMap).sort((a, b) => {
      const rankA = liquidityRank(a.typeName, a.classification);
      const rankB = liquidityRank(b.typeName, b.classification);
      if (rankA !== rankB) return rankA - rankB;
      return a.typeName.localeCompare(b.typeName);
    });
    const assetGroups = allGroups.filter((g) => g.classification === "asset");
    const liabilityGroups = allGroups.filter((g) => g.classification === "liability");

    const assetTotal = parseFloat(summary?.assets ?? "0");
    const liabTotal = parseFloat(summary?.liabilities ?? "0");
    const netWorth = parseFloat(summary?.netWorth ?? "0");
    const isPositive = netWorth >= 0;

    return { assetGroups, liabilityGroups, assetTotal, liabTotal, netWorth, isPositive };
  }, [accounts, summary]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Action bar (Tambah Akun) — heading dirender di server shell */}
      {!isDemo && (
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowAddModal(true)} size="sm" className="gap-1.5">
          <Plus className="size-4" /> Tambah Akun
        </Button>
      </div>
      )}

      {/* Sheets banner */}
      {isSheets && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-3">
          <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Kamu login via Google. Fitur Akun & Dompet disimpan di database terpisah dari Google Sheets.
            Transaksi baru melalui form manual akan dicatat di sini.
          </p>
        </div>
      )}

      {/* Net Worth Hero */}
      {loading && !summary ? (
        <AccountsSkeleton />
      ) : summary ? (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2 text-center sm:gap-4">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">Total Aset</p>
              <p className="truncate text-[clamp(0.65rem,2.8vw,1.125rem)] font-bold leading-tight text-emerald-600 tabular-nums dark:text-emerald-400">
                {formatIDR(assetTotal)}
              </p>
            </div>
            <div className="min-w-0 border-x border-border px-1 sm:px-2">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">Kekayaan Bersih</p>
              <p className={cn(
                "truncate text-[clamp(0.65rem,2.8vw,1.25rem)] font-bold leading-tight tabular-nums",
                isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
              )}>
                {formatIDR(netWorth)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 truncate">Total Utang</p>
              <p className="truncate text-[clamp(0.65rem,2.8vw,1.125rem)] font-bold leading-tight text-red-500 tabular-nums">
                {formatIDR(liabTotal)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl p-4">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </div>
      )}

      {/* Account list */}
      {loading && accounts.length === 0 ? (
        <AccountsSkeleton />
      ) : accounts.length === 0 && !loading ? (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Wallet className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Belum ada akun. Tambahkan akun pertamamu!</p>
          {!isDemo && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => setShowSetupModal(true)} size="sm" className="gap-1.5">
              <Sparkles className="size-4" /> Setup cepat dengan AI
            </Button>
            <Button onClick={() => setShowAddModal(true)} size="sm" variant="outline" className="gap-1.5">
              <Plus className="size-4" /> Tambah Akun
            </Button>
          </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {assetGroups.length > 0 && (
            <section>
              <div className="mb-3 flex items-start justify-between gap-3 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                  Aset
                </h2>
                <span className="shrink-0 text-right text-xs font-semibold text-emerald-600 tabular-nums whitespace-nowrap dark:text-emerald-400">
                  {formatIDR(assetTotal)}
                </span>
              </div>
              <div className="space-y-4">
                {assetGroups.map((g) => (
                  <div key={g.typeName}>
                    <div className="mb-2 flex items-start justify-between gap-3 px-1">
                      <h3 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.typeName}</h3>
                      <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatIDR(g.accounts.reduce((s, a) => s + parseFloat(a.currentBalance), 0))}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {g.accounts.map((a) => (
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
            </section>
          )}

          {liabilityGroups.length > 0 && (
            <section>
              <div className="mb-3 flex items-start justify-between gap-3 px-1">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-red-500">
                  Liabilitas
                </h2>
                <span className="shrink-0 text-right text-xs font-semibold text-red-500 tabular-nums whitespace-nowrap">
                  {formatIDR(liabTotal)}
                </span>
              </div>
              <div className="space-y-4">
                {liabilityGroups.map((g) => (
                  <div key={g.typeName}>
                    <div className="mb-2 flex items-start justify-between gap-3 px-1">
                      <h3 className="min-w-0 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.typeName}</h3>
                      <span className="shrink-0 text-right text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatIDR(g.accounts.reduce((s, a) => s + parseFloat(a.currentBalance), 0))}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {g.accounts.map((a) => (
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
            </section>
          )}
        </div>
      )}

      {/* Settings link */}
      <div className="flex items-center justify-center pt-2">
        <Link
          href="/dashboard/settings/account-types"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <Tags className="size-3.5" />
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
      {showSetupModal && (
        <SetupAccountsModal
          onClose={() => setShowSetupModal(false)}
          onSaved={() => { setShowSetupModal(false); fetchData(); emitDataChanged(["accounts", "transactions"]); }}
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
    </>
  );
}
