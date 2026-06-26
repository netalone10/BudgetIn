"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Loader2,
  AlertCircle,
  UserPlus,
  Trash2,
  LogOut,
  Wallet,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Crown,
  ArrowLeftRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Types (cermin response API) ──────────────────────────────────────────────

interface MemberInfo {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  displayRole: string | null;
  isSelf: boolean;
}

interface PendingInvite {
  id: string;
  email: string;
  displayRole: string | null;
  expiresAt: string;
}

interface FamilyInfo {
  family: { id: string; name: string; ownerId: string } | null;
  members?: MemberInfo[];
  self?: MemberInfo;
  pendingInvites?: PendingInvite[];
}

interface MemberNetWorth {
  userId: string;
  name: string;
  displayRole: string | null;
  assets: number;
  liabilities: number;
  netWorth: number;
  error: boolean;
}

interface MemberStatus {
  userId: string;
  name: string;
  displayRole: string | null;
  role: string;
  storage: "db" | "sheets";
  error: boolean;
}

interface DashboardData {
  family: { id: string; name: string } | null;
  members: MemberStatus[];
  netWorth: {
    totalAssets: number;
    totalLiabilities: number;
    totalNetWorth: number;
    perMember: MemberNetWorth[];
  };
  summary: {
    income: number;
    expense: number;
    net: number;
    byCategory: { category: string; spent: number }[];
    byMember: {
      userId: string;
      name: string;
      displayRole: string | null;
      income: number;
      expense: number;
    }[];
  };
  transactions: {
    id: string;
    ownerUserId: string;
    ownerName: string;
    ownerDisplayRole: string | null;
    date: string;
    amount: number;
    category: string;
    note: string;
    type: string;
  }[];
}

const rp = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;

export default function FamilyClient() {
  const [info, setInfo] = useState<FamilyInfo | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/family");
      if (!res.ok) throw new Error();
      const data: FamilyInfo = await res.json();
      setInfo(data);
      if (data.family) {
        const dres = await fetch("/api/family/dashboard");
        if (dres.ok) setDash(await dres.json());
      } else {
        setDash(null);
      }
    } catch {
      setError("Gagal memuat data keluarga. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-5" />
          <p className="text-sm">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
          Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3 pb-2 mt-4 md:mt-2">
        <Users className="size-7 text-primary" />
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Keluarga</h2>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Beta
        </span>
      </div>

      {!info?.family ? (
        <CreateFamily onCreated={loadAll} />
      ) : (
        <>
          {dash && <ConsolidatedView dash={dash} />}
          {(info.members?.length ?? 0) >= 2 && <TransferForm onDone={loadAll} />}
          <ManagePanel info={info} onChanged={loadAll} />
        </>
      )}
    </div>
  );
}

// ─── Create family ────────────────────────────────────────────────────────────

function CreateFamily({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [displayRole, setDisplayRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), displayRole: displayRole.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal membuat keluarga");
      }
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal membuat keluarga");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-1">Buat Keluarga</h3>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Konsolidasikan keuangan dengan pasanganmu. Tiap orang tetap mencatat di bukunya
        sendiri — tampilan Keluarga hanya menggabungkan net worth & pengeluaran. Transaksi
        antar anggota akan saling dieliminasi agar tidak terhitung ganda.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3 max-w-md">
        <Input
          placeholder="Nama keluarga (contoh: Keluarga Akbar)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
        />
        <Input
          placeholder="Peranmu (opsional, contoh: Suami)"
          value={displayRole}
          onChange={(e) => setDisplayRole(e.target.value)}
          disabled={submitting}
        />
        <Button type="submit" disabled={submitting} className="self-start">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : "Buat Keluarga"}
        </Button>
      </form>
    </div>
  );
}

// ─── Consolidated view ──────────────────────────────────────────────────────

function ConsolidatedView({ dash }: { dash: DashboardData }) {
  const erroredMembers = dash.members.filter((m) => m.error);

  return (
    <div className="space-y-6">
      {erroredMembers.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <ShieldAlert className="size-4 mt-0.5 shrink-0" />
          <span>
            Data{" "}
            {erroredMembers.map((m) => m.displayRole || m.name).join(", ")}{" "}
            belum bisa dimuat (mungkin perlu login ulang). Angka di bawah belum termasuk anggota tersebut.
          </span>
        </div>
      )}

      {/* Net worth */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Net Worth Keluarga</h3>
        </div>
        <p className="text-3xl font-semibold tracking-tight tabular-nums text-foreground">
          {rp(dash.netWorth.totalNetWorth)}
        </p>
        <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
          <span>Aset {rp(dash.netWorth.totalAssets)}</span>
          <span>Liabilitas {rp(dash.netWorth.totalLiabilities)}</span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {dash.netWorth.perMember.map((m) => (
            <div key={m.userId} className="rounded-xl border border-border/60 bg-background/50 p-3">
              <p className="text-xs text-muted-foreground">{m.displayRole || m.name}</p>
              <p className="text-lg font-semibold tabular-nums">{rp(m.netWorth)}</p>
              {m.error && <p className="text-[11px] text-amber-600">data belum termuat</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Income / Expense */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Pemasukan" value={dash.summary.income} icon={<TrendingUp className="size-4" />} tone="emerald" />
        <SummaryCard label="Pengeluaran" value={dash.summary.expense} icon={<TrendingDown className="size-4" />} tone="rose" />
        <SummaryCard label="Selisih" value={dash.summary.net} tone={dash.summary.net >= 0 ? "emerald" : "rose"} />
      </div>

      {/* Per member breakdown */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">Per Anggota</h3>
        <div className="space-y-3">
          {dash.summary.byMember.map((m) => (
            <div key={m.userId} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{m.displayRole || m.name}</span>
              <div className="flex gap-4 tabular-nums">
                <span className="text-emerald-600">+{rp(m.income)}</span>
                <span className="text-rose-600">-{rp(m.expense)}</span>
              </div>
            </div>
          ))}
          {dash.summary.byMember.length === 0 && (
            <p className="text-sm text-muted-foreground">Belum ada transaksi periode ini.</p>
          )}
        </div>
      </div>

      {/* Top categories */}
      {dash.summary.byCategory.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">Pengeluaran per Kategori</h3>
          <div className="space-y-2">
            {dash.summary.byCategory.slice(0, 10).map((c) => (
              <div key={c.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{c.category}</span>
                <span className="tabular-nums text-muted-foreground">{rp(c.spent)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-4">Transaksi Terbaru</h3>
        <div className="divide-y divide-border/60">
          {dash.transactions.slice(0, 30).map((t) => (
            <div key={`${t.ownerUserId}-${t.id}`} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">{rp(t.amount)}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(t.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{t.category}</span>
                  <span className="text-[11px] text-primary/80">{t.ownerDisplayRole || t.ownerName}</span>
                  {t.note && <span className="truncate text-xs text-muted-foreground">{t.note}</span>}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  t.type === "income" ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {t.type === "income" ? "masuk" : "keluar"}
              </span>
            </div>
          ))}
          {dash.transactions.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone: "emerald" | "rose";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          tone === "emerald" ? "text-emerald-600" : "text-rose-600"
        )}
      >
        {rp(value)}
      </p>
    </div>
  );
}

// ─── Transfer antar-anggota (Opsi A) ─────────────────────────────────────────

interface MemberAccounts {
  userId: string;
  name: string;
  displayRole: string | null;
  isSelf: boolean;
  accounts: { id: string; name: string }[];
  error: boolean;
}

function TransferForm({ onDone }: { onDone: () => void }) {
  const [members, setMembers] = useState<MemberAccounts[] | null>(null);
  const [toUserId, setToUserId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/family/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMembers(d.members))
      .catch(() => {});
  }, []);

  const self = members?.find((m) => m.isSelf);
  const others = members?.filter((m) => !m.isSelf) ?? [];
  const recipient = members?.find((m) => m.userId === toUserId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!toUserId || !fromAccountId || !toAccountId || !amt || amt <= 0) {
      alert("Lengkapi anggota tujuan, akun, dan nominal.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/family/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, fromAccountId, toAccountId, amount: amt, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal transfer");
      }
      setAmount("");
      setNote("");
      setToAccountId("");
      onDone();
      alert("Transfer tercatat. Di tampilan keluarga, transaksi ini saling dieliminasi.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal transfer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <ArrowLeftRight className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Transfer ke Anggota Keluarga</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Tercatat sebagai pengeluaranmu &amp; pemasukan penerima. Di tampilan keluarga, pasangan
        ini otomatis dieliminasi agar tidak terhitung ganda.
      </p>

      {!members ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3 max-w-md">
          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={toUserId}
            onChange={(e) => {
              setToUserId(e.target.value);
              setToAccountId("");
            }}
          >
            <option value="">Pilih anggota tujuan…</option>
            {others.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.displayRole || m.name}
              </option>
            ))}
          </select>

          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={fromAccountId}
            onChange={(e) => setFromAccountId(e.target.value)}
          >
            <option value="">Dari akun kamu…</option>
            {self?.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={toAccountId}
            onChange={(e) => setToAccountId(e.target.value)}
            disabled={!recipient}
          >
            <option value="">Ke akun penerima…</option>
            {recipient?.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <Input
            type="number"
            placeholder="Nominal (Rp)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={1}
            disabled={submitting}
          />
          <Input
            placeholder="Catatan (opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
          />
          <Button type="submit" disabled={submitting} className="self-start">
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <><ArrowLeftRight className="size-4" />Transfer</>}
          </Button>
        </form>
      )}
    </div>
  );
}

// ─── Manage panel ─────────────────────────────────────────────────────────────

function ManagePanel({ info, onChanged }: { info: FamilyInfo; onChanged: () => void }) {
  const isOwner = info.self?.role === "owner";
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviting, setInviting] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/family/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), displayRole: inviteRole.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal mengundang");
      }
      setInviteEmail("");
      setInviteRole("");
      onChanged();
      alert("Undangan terkirim.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal mengundang");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(userId: string, label: string) {
    if (!confirm(`Keluarkan ${label} dari keluarga?`)) return;
    try {
      const res = await fetch(`/api/family/member/${userId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal");
      }
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal");
    }
  }

  async function leaveOrDisband() {
    if (isOwner) {
      if (!confirm("Bubarkan keluarga? Semua anggota akan dilepas. Buku tiap orang tetap aman.")) return;
      const res = await fetch("/api/family", { method: "DELETE" });
      if (res.ok) onChanged();
      else alert("Gagal membubarkan keluarga");
    } else {
      if (!confirm("Keluar dari keluarga?")) return;
      const res = await fetch(`/api/family/member/${info.self!.userId}`, { method: "DELETE" });
      if (res.ok) onChanged();
      else alert("Gagal keluar dari keluarga");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{info.family!.name}</h3>
        <Button variant="outline" size="sm" onClick={leaveOrDisband}>
          <LogOut className="size-3.5" />
          {isOwner ? "Bubarkan" : "Keluar"}
        </Button>
      </div>

      {/* Members */}
      <div className="space-y-2">
        {info.members?.map((m) => (
          <div key={m.userId} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">{m.name}</span>
                {m.role === "owner" && <Crown className="size-3.5 text-amber-500" />}
                {m.displayRole && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{m.displayRole}</span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{m.email}</p>
            </div>
            {isOwner && !m.isSelf && m.role !== "owner" && (
              <button
                onClick={() => removeMember(m.userId, m.displayRole || m.name)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Keluarkan"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {isOwner && info.pendingInvites && info.pendingInvites.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Undangan Pending</p>
          {info.pendingInvites.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="truncate">{inv.email}{inv.displayRole ? ` (${inv.displayRole})` : ""}</span>
              <span className="text-[11px]">menunggu</span>
            </div>
          ))}
        </div>
      )}

      {/* Invite form */}
      {isOwner && (
        <form onSubmit={invite} className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Undang Anggota</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="email@contoh.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviting}
            />
            <Input
              placeholder="Peran (contoh: Istri)"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              disabled={inviting}
              className="sm:max-w-[160px]"
            />
            <Button type="submit" disabled={inviting} className="shrink-0">
              {inviting ? <Loader2 className="size-4 animate-spin" /> : <><UserPlus className="size-4" />Undang</>}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
