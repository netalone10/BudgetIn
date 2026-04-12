"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Loader2, Users, TrendingUp, Calendar, ShieldCheck, Mail, Chrome } from "lucide-react";
import Navbar from "@/components/Navbar";
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
  budgetCount: number;
  categoryCount: number;
  createdAt: string;
}

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

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center flex-col gap-3">
          <ShieldCheck className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">Akses Ditolak</p>
          <p className="text-sm text-muted-foreground">Kamu tidak memiliki izin untuk halaman ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6">

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
                  <th className="py-2.5 pr-4 text-right text-[11px] font-medium text-muted-foreground">Daftar</th>
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
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                        u.type === "google"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      )}>
                        {u.type === "google" ? <Chrome className="h-2.5 w-2.5" /> : <Mail className="h-2.5 w-2.5" />}
                        {u.type === "google" ? "Google" : "Email"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{u.budgetCount} budget</span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(u.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
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
