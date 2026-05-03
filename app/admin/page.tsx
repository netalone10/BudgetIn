"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Chrome,
  Clock,
  Database,
  Filter,
  KeyRound,
  Loader2,
  Mail,
  MailCheck,
  PiggyBank,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Stats {
  totalUsers: number;
  googleUsers: number;
  emailUsers: number;
  verifiedEmailUsers: number;
  unverifiedEmailUsers: number;
  sheetsUsers: number;
  dbOnlyUsers: number;
  newThisMonth: number;
  newLast7Days: number;
  activeLast7Days: number;
  activeLast30Days: number;
  totalTransactions: number;
  totalBudgets: number;
  totalAccounts: number;
  totalSavingsGoals: number;
  totalRecurringBills: number;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  type: "google" | "email";
  hasSheets: boolean;
  emailVerified: boolean;
  budgetCount: number;
  categoryCount: number;
  accountCount: number;
  transactionCount: number;
  savingsGoalCount: number;
  recurringBillCount: number;
  createdAt: string;
  lastActivityAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type DialogType = "delete" | "reset-password" | "resend-verification" | null;

type SelectOption = {
  value: string;
  label: string;
};

const providerOptions: SelectOption[] = [
  { value: "all", label: "Semua provider" },
  { value: "google", label: "Google" },
  { value: "email", label: "Email" },
];

const verifiedOptions: SelectOption[] = [
  { value: "all", label: "Semua status" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Unverified" },
];

const dataModeOptions: SelectOption[] = [
  { value: "all", label: "Semua mode data" },
  { value: "sheets", label: "Google Sheets" },
  { value: "db", label: "Database" },
];

const sortOptions: SelectOption[] = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "name", label: "Nama A-Z" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function pct(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.max(0, Math.floor(diff / 60000));
  if (d > 30) return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  if (d > 0) return `${d} hari lalu`;
  if (h > 0) return `${h} jam lalu`;
  return `${m} menit lalu`;
}

function dateShort(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [verified, setVerified] = useState("all");
  const [dataMode, setDataMode] = useState("all");
  const [sort, setSort] = useState("newest");
  const [statsLoading, setStatsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [dialog, setDialog] = useState<{ type: DialogType; user: UserRow | null }>({ type: null, user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const page = pagination.page;
  const pageSize = pagination.pageSize;

  const hasActiveFilters = useMemo(() => {
    return search.trim() || provider !== "all" || verified !== "all" || dataMode !== "all" || sort !== "newest";
  }, [dataMode, provider, search, sort, verified]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      setStats(data.stats);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
      if (search.trim()) params.set("search", search.trim());
      if (provider !== "all") params.set("provider", provider);
      if (verified !== "all") params.set("verified", verified);
      if (dataMode !== "all") params.set("dataMode", dataMode);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      setUsers(data.users ?? []);
      setPagination(data.pagination ?? { page, pageSize, total: 0, totalPages: 1 });
    } finally {
      setUsersLoading(false);
    }
  }, [dataMode, page, pageSize, provider, search, sort, verified]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchStats();
  }, [fetchStats, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchUsers();
  }, [fetchUsers, status]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function setPage(nextPage: number) {
    setPagination((prev) => ({ ...prev, page: Math.min(Math.max(nextPage, 1), prev.totalPages) }));
  }

  function resetFilters() {
    setSearch("");
    setProvider("all");
    setVerified("all");
    setDataMode("all");
    setSort("newest");
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  async function refreshAll() {
    await Promise.all([fetchStats(), fetchUsers()]);
  }

  async function handleDelete() {
    if (!dialog.user) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${dialog.user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal menghapus.", false);
        return;
      }
      showToast(`User "${dialog.user.name}" berhasil dihapus.`, true);
      setDialog({ type: null, user: null });
      await refreshAll();
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!dialog.user) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${dialog.user.id}?action=reset-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal reset.", false);
        return;
      }
      showToast(`Password berhasil direset & dikirim ke ${dialog.user.email}.`, true);
      setDialog({ type: null, user: null });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResendVerification() {
    if (!dialog.user) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${dialog.user.id}?action=resend-verification`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Gagal kirim.", false);
        return;
      }
      showToast(`Email verifikasi dikirim ke ${dialog.user.email}.`, true);
      setDialog({ type: null, user: null });
    } finally {
      setActionLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-col w-full">
        <div className="flex flex-1 items-center justify-center flex-col gap-3 min-h-[60vh]">
          <ShieldCheck className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">Akses Ditolak</p>
          <p className="text-sm text-muted-foreground">Kamu tidak memiliki izin untuk halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8 py-8 space-y-6">
        <div className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/12 via-card to-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Super Admin
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Admin Command Center</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Kelola user, pantau growth, dan cek aktivitas produk BudgetIn.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Logged in as <span className="font-medium text-foreground">{session?.user?.email}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              <HeroMetric label="User aktif 7 hari" value={stats ? fmt(stats.activeLast7Days) : "-"} sub={stats ? pct(stats.activeLast7Days, stats.totalUsers) : ""} />
              <HeroMetric label="User aktif 30 hari" value={stats ? fmt(stats.activeLast30Days) : "-"} sub={stats ? pct(stats.activeLast30Days, stats.totalUsers) : ""} />
              <HeroMetric label="Baru bulan ini" value={stats ? fmt(stats.newThisMonth) : "-"} sub={stats ? `${fmt(stats.newLast7Days)} minggu ini` : ""} />
              <HeroMetric label="Transaksi DB" value={stats ? fmt(stats.totalTransactions) : "-"} sub="Total ledger" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={<Users className="h-4 w-4" />} label="Total User" value={statsLoading ? "..." : fmt(stats?.totalUsers ?? 0)} sub={stats ? `${fmt(stats.newThisMonth)} baru bulan ini` : ""} />
          <StatCard icon={<Chrome className="h-4 w-4 text-blue-500" />} label="Google Users" value={statsLoading ? "..." : fmt(stats?.googleUsers ?? 0)} sub={stats ? pct(stats.googleUsers, stats.totalUsers) : ""} />
          <StatCard icon={<Mail className="h-4 w-4 text-purple-500" />} label="Email Users" value={statsLoading ? "..." : fmt(stats?.emailUsers ?? 0)} sub={stats ? `${fmt(stats.verifiedEmailUsers)} verified • ${fmt(stats.unverifiedEmailUsers)} pending` : ""} />
          <StatCard icon={<Database className="h-4 w-4 text-teal-500" />} label="Mode Data" value={statsLoading ? "..." : `${fmt(stats?.dbOnlyUsers ?? 0)} DB`} sub={stats ? `${fmt(stats.sheetsUsers)} pakai Sheets` : ""} />
          <StatCard icon={<Wallet className="h-4 w-4 text-emerald-500" />} label="Akun/Wallet" value={statsLoading ? "..." : fmt(stats?.totalAccounts ?? 0)} sub="Total account records" />
          <StatCard icon={<TrendingUp className="h-4 w-4 text-orange-500" />} label="Budget" value={statsLoading ? "..." : fmt(stats?.totalBudgets ?? 0)} sub="Budget aktif tersimpan" />
          <StatCard icon={<PiggyBank className="h-4 w-4 text-pink-500" />} label="Savings Goals" value={statsLoading ? "..." : fmt(stats?.totalSavingsGoals ?? 0)} sub="Target tabungan user" />
          <StatCard icon={<Calendar className="h-4 w-4 text-indigo-500" />} label="Recurring Bills" value={statsLoading ? "..." : fmt(stats?.totalRecurringBills ?? 0)} sub="Tagihan berulang" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b p-4 md:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="font-semibold">User Management</h2>
                  <p className="text-sm text-muted-foreground">
                    {fmt(pagination.total)} user ditemukan dari filter aktif.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      placeholder="Cari nama atau email"
                      className="h-9 pl-9"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={refreshAll} disabled={statsLoading || usersLoading}>
                    {statsLoading || usersLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <FilterSelect value={provider} onChange={setProvider} options={providerOptions} />
                <FilterSelect value={verified} onChange={setVerified} options={verifiedOptions} />
                <FilterSelect value={dataMode} onChange={setDataMode} options={dataModeOptions} />
                <FilterSelect value={sort} onChange={setSort} options={sortOptions} />
                <Button variant="ghost" size="sm" onClick={resetFilters} disabled={!hasActiveFilters} className="justify-start xl:justify-center">
                  <Filter className="h-3.5 w-3.5" />
                  Reset filter
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-3 pl-5 pr-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">User</th>
                    <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Data</th>
                    <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Usage</th>
                    <th className="px-3 py-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Activity</th>
                    <th className="py-3 pl-3 pr-5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                        Memuat user...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-sm text-muted-foreground">
                        Tidak ada user yang cocok dengan filter saat ini.
                      </td>
                    </tr>
                  ) : users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-4 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {u.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "U"}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{u.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                            <p className="text-[11px] text-muted-foreground">Daftar {dateShort(u.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-col gap-1.5">
                          <Badge className={u.type === "google" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}>
                            {u.type === "google" ? <Chrome className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                            {u.type === "google" ? "Google" : "Email"}
                          </Badge>
                          {u.type === "email" && (
                            <Badge className={u.emailVerified ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500"}>
                              {u.emailVerified ? <BadgeCheck className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {u.emailVerified ? "Verified" : "Unverified"}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Badge className={u.hasSheets ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300"}>
                          <Database className="h-3 w-3" />
                          {u.hasSheets ? "Sheets" : "DB"}
                        </Badge>
                      </td>
                      <td className="px-3 py-4">
                        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <MiniCount label="Trx" value={u.transactionCount} />
                          <MiniCount label="Budget" value={u.budgetCount} />
                          <MiniCount label="Akun" value={u.accountCount} />
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <p className="text-xs font-medium whitespace-nowrap">{timeAgo(u.lastActivityAt)}</p>
                        <p className="text-[11px] text-muted-foreground whitespace-nowrap">{dateShort(u.lastActivityAt)}</p>
                      </td>
                      <td className="py-4 pl-3 pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          {u.type === "email" && !u.emailVerified && (
                            <button
                              onClick={() => setDialog({ type: "resend-verification", user: u })}
                              title="Kirim ulang email verifikasi"
                              className="rounded-md p-1.5 text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                            >
                              <MailCheck className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {u.type === "email" && (
                            <button
                              onClick={() => setDialog({ type: "reset-password", user: u })}
                              title="Reset password"
                              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {u.id !== session?.userId && (
                            <button
                              onClick={() => setDialog({ type: "delete", user: u })}
                              title="Hapus user"
                              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Halaman {pagination.page} dari {pagination.totalPages} • {fmt(pagination.total)} user
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPagination((prev) => ({ ...prev, page: 1, pageSize: Number(e.target.value) }))}
                  className="h-8 rounded-lg border bg-background px-3 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <option value={10}>10 / halaman</option>
                  <option value={20}>20 / halaman</option>
                  <option value={50}>50 / halaman</option>
                </select>
                <Button variant="outline" size="icon-sm" onClick={() => setPage(pagination.page - 1)} disabled={usersLoading || pagination.page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon-sm" onClick={() => setPage(pagination.page + 1)} disabled={usersLoading || pagination.page >= pagination.totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <SidePanel icon={<Activity className="h-4 w-4 text-primary" />} title="Activation Snapshot">
              <SideMetric label="Active 7 hari" value={stats ? fmt(stats.activeLast7Days) : "-"} sub={stats ? pct(stats.activeLast7Days, stats.totalUsers) : ""} />
              <SideMetric label="Active 30 hari" value={stats ? fmt(stats.activeLast30Days) : "-"} sub={stats ? pct(stats.activeLast30Days, stats.totalUsers) : ""} />
              <SideMetric label="User baru minggu ini" value={stats ? fmt(stats.newLast7Days) : "-"} sub="Akuisisi terbaru" />
            </SidePanel>
            <SidePanel icon={<Sparkles className="h-4 w-4 text-primary" />} title="Ops Queue">
              <SideMetric label="Email belum verified" value={stats ? fmt(stats.unverifiedEmailUsers) : "-"} sub="Butuh follow-up" />
              <SideMetric label="DB-only users" value={stats ? fmt(stats.dbOnlyUsers) : "-"} sub="Tanpa Sheets sync" />
              <SideMetric label="Sheets users" value={stats ? fmt(stats.sheetsUsers) : "-"} sub="Google-connected" />
            </SidePanel>
          </div>
        </div>
      </div>

      {dialog.type && dialog.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "rounded-full p-2",
                  dialog.type === "delete" ? "bg-destructive/10" :
                  dialog.type === "resend-verification" ? "bg-blue-500/10" : "bg-yellow-500/10"
                )}>
                  {dialog.type === "delete"
                    ? <AlertTriangle className="h-5 w-5 text-destructive" />
                    : dialog.type === "resend-verification"
                    ? <MailCheck className="h-5 w-5 text-blue-500" />
                    : <KeyRound className="h-5 w-5 text-yellow-500" />
                  }
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {dialog.type === "delete" ? "Hapus User" :
                     dialog.type === "resend-verification" ? "Kirim Verifikasi" : "Reset Password"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{dialog.user.name}</p>
                </div>
              </div>
              <button onClick={() => setDialog({ type: null, user: null })} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {dialog.type === "delete"
                ? <>Hapus <span className="font-medium text-foreground">{dialog.user.email}</span> beserta semua transaksi, budget, dan kategorinya? <span className="text-destructive font-medium">Tidak bisa dibatalkan.</span></>
                : dialog.type === "resend-verification"
                ? <>Kirim ulang link verifikasi ke <span className="font-medium text-foreground">{dialog.user.email}</span>?</>
                : <>Generate password baru untuk <span className="font-medium text-foreground">{dialog.user.email}</span> dan kirim via email?</>
              }
            </p>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialog({ type: null, user: null })}
                disabled={actionLoading}
              >
                Batal
              </Button>
              <Button
                variant={dialog.type === "delete" ? "destructive" : "default"}
                className="flex-1"
                onClick={
                  dialog.type === "delete" ? handleDelete :
                  dialog.type === "resend-verification" ? handleResendVerification :
                  handleResetPassword
                }
                disabled={actionLoading}
              >
                {actionLoading
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : dialog.type === "delete" ? "Hapus"
                  : dialog.type === "resend-verification" ? "Kirim Email"
                  : "Reset & Kirim Email"
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg",
          toast.ok
            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/80 dark:text-green-400"
            : "border-destructive/30 bg-destructive/10 text-destructive"
        )}>
          {toast.ok
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertTriangle className="h-4 w-4 shrink-0" />
          }
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function HeroMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-background/70 p-3 shadow-sm backdrop-blur">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-2">
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", className)}>
      {children}
    </span>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1">
      <p className="font-semibold text-foreground tabular-nums">{fmt(value)}</p>
      <p className="text-[10px]">{label}</p>
    </div>
  );
}

function SidePanel({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SideMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
