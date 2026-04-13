"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Loader2, Users, TrendingUp, Calendar, ShieldCheck,
  Mail, Chrome, Trash2, KeyRound, AlertTriangle, X, CheckCircle2,
  BadgeCheck, Clock, MailCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Stats {
  totalUsers: number;
  googleUsers: number;
  emailUsers: number;
  newThisMonth: number;
  newLast7Days: number;
  totalTransactions: number;
  totalBudgets: number;
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
  createdAt: string;
}

type DialogType = "delete" | "reset-password" | "resend-verification" | null;

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 30) return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  if (d > 0) return `${d} hari lalu`;
  if (h > 0) return `${h} jam lalu`;
  return `${m} menit lalu`;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  // Dialog state
  const [dialog, setDialog] = useState<{ type: DialogType; user: UserRow | null }>({ type: null, user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") redirect("/auth");
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/admin/stats")
      .then((r) => {
        if (r.status === 403) { setForbidden(true); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setStats(d.stats);
        setUsers(d.recentUsers);
      })
      .finally(() => setLoading(false));
  }, [status]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDelete() {
    if (!dialog.user) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${dialog.user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? "Gagal menghapus.", false); return; }
      setUsers((prev) => prev.filter((u) => u.id !== dialog.user!.id));
      showToast(`User "${dialog.user.name}" berhasil dihapus.`, true);
      setDialog({ type: null, user: null });
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
      if (!res.ok) { showToast(data.error ?? "Gagal reset.", false); return; }
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
      if (!res.ok) { showToast(data.error ?? "Gagal kirim.", false); return; }
      showToast(`Email verifikasi dikirim ke ${dialog.user.email}.`, true);
      setDialog({ type: null, user: null });
    } finally {
      setActionLoading(false);
    }
  }

  if (status === "loading" || loading) {
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
      <div className="mx-auto w-full max-w-5xl px-4 md:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">
              Logged in as <span className="font-medium">{session?.user?.email}</span>
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Super Admin
          </span>
        </div>

        {/* Stat Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<Users className="h-4 w-4" />} label="Total User" value={fmt(stats.totalUsers)} />
            <StatCard icon={<Chrome className="h-4 w-4 text-blue-500" />} label="Via Google" value={fmt(stats.googleUsers)} sub={`${Math.round((stats.googleUsers / stats.totalUsers) * 100) || 0}%`} />
            <StatCard icon={<Mail className="h-4 w-4 text-purple-500" />} label="Via Email" value={fmt(stats.emailUsers)} sub={`${Math.round((stats.emailUsers / stats.totalUsers) * 100) || 0}%`} />
            <StatCard icon={<Calendar className="h-4 w-4 text-green-500" />} label="Baru Bulan Ini" value={fmt(stats.newThisMonth)} sub={`${fmt(stats.newLast7Days)} minggu ini`} />
            <StatCard icon={<TrendingUp className="h-4 w-4 text-orange-500" />} label="Transaksi (DB)" value={fmt(stats.totalTransactions)} />
            <StatCard icon={<ShieldCheck className="h-4 w-4 text-teal-500" />} label="Budget Aktif" value={fmt(stats.totalBudgets)} />
          </div>
        )}

        {/* User Table */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            20 User Terbaru
          </h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[11px] font-medium text-muted-foreground">Nama</th>
                  <th className="py-2.5 pr-3 text-left text-[11px] font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                  <th className="py-2.5 pr-3 text-left text-[11px] font-medium text-muted-foreground">Tipe</th>
                  <th className="py-2.5 pr-3 text-left text-[11px] font-medium text-muted-foreground hidden md:table-cell">Budget</th>
                  <th className="py-2.5 pr-3 text-right text-[11px] font-medium text-muted-foreground hidden sm:table-cell">Daftar</th>
                  <th className="py-2.5 pr-4 text-right text-[11px] font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 pl-4 pr-3">
                      <p className="text-sm font-medium truncate max-w-[140px]">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[140px] sm:hidden">{u.email}</p>
                    </td>
                    <td className="py-3 pr-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground truncate block max-w-[180px]">{u.email}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium w-fit",
                          u.type === "google"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        )}>
                          {u.type === "google" ? <Chrome className="h-2.5 w-2.5" /> : <Mail className="h-2.5 w-2.5" />}
                          {u.type === "google" ? "Google" : "Email"}
                        </span>
                        {u.type === "email" && (
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium w-fit",
                            u.emailVerified
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500"
                          )}>
                            {u.emailVerified
                              ? <><BadgeCheck className="h-2.5 w-2.5" />Verified</>
                              : <><Clock className="h-2.5 w-2.5" />Unverified</>
                            }
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{u.budgetCount} budget</span>
                    </td>
                    <td className="py-3 pr-3 hidden sm:table-cell text-right">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(u.createdAt)}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Resend verification — hanya email user yang belum verified */}
                        {u.type === "email" && !u.emailVerified && (
                          <button
                            onClick={() => setDialog({ type: "resend-verification", user: u })}
                            title="Kirim ulang email verifikasi"
                            className="rounded-md p-1.5 text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                          >
                            <MailCheck className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Reset password — hanya email user */}
                        {u.type === "email" && (
                          <button
                            onClick={() => setDialog({ type: "reset-password", user: u })}
                            title="Reset password"
                            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {/* Delete — semua user kecuali diri sendiri */}
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
        </div>
      </div>

      {/* ── Confirm Dialog ── */}
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
                className={cn(
                  "flex-1",
                  dialog.type === "delete" && "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                )}
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

      {/* ── Toast ── */}
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

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
