"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2, Database, Eraser, Loader2, RefreshCw, ShieldAlert, Trash2, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CONFIRMATIONS = {
  "reset-data": "RESET DATA",
  "reset-account": "RESET AKUN",
  "delete-account": "HAPUS AKUN",
} as const;

type ActionType = keyof typeof CONFIRMATIONS;

type UserProfile = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  sheetsId: string | null;
  createdAt: string;
};

type ActionConfig = {
  type: ActionType;
  title: string;
  label: string;
  description: string;
  impact: string[];
  endpoint: string;
  method: "POST" | "DELETE";
  icon: ReactNode;
  destructive?: boolean;
};

function storageLabel(user: UserProfile | null) {
  if (!user) return "Memuat...";
  return user.sheetsId ? "Google Sheets" : "Database";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function ActionCard({ action, onOpen }: { action: ActionConfig; onOpen: (type: ActionType) => void }) {
  return (
    <section className={`rounded-[28px] border p-5 shadow-sm md:p-6 ${action.destructive ? "border-destructive/30 bg-destructive/5" : "border-border/70 bg-card"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${action.destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
            {action.icon}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{action.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{action.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {action.impact.map((item) => (
                <li key={item} className="flex gap-2">
                  <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${action.destructive ? "text-destructive" : "text-amber-500"}`} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Button variant={action.destructive ? "destructive" : "outline"} onClick={() => onOpen(action.type)} className="rounded-2xl md:shrink-0">
          {action.label}
        </Button>
      </div>
    </section>
  );
}

function ConfirmationModal({
  action,
  loading,
  value,
  onValueChange,
  onClose,
  onConfirm,
}: {
  action: ActionConfig;
  loading: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const expected = CONFIRMATIONS[action.type];
  const canConfirm = value === expected && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-2.5 ${action.destructive ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600"}`}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Konfirmasi {action.title}</h2>
              <p className="text-xs text-muted-foreground">Aksi ini membutuhkan konfirmasi manual.</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {action.impact[0]} Pastikan kamu sudah membuat backup jika data masih dibutuhkan.
        </div>

        <label className="mt-5 block text-sm font-medium text-foreground">
          Ketik <span className="font-mono text-destructive">{expected}</span> untuk melanjutkan
        </label>
        <input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          autoFocus
          disabled={loading}
          className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
        />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" className="flex-1 rounded-2xl" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button variant={action.destructive ? "destructive" : "default"} className="flex-1 rounded-2xl" onClick={onConfirm} disabled={!canConfirm}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Konfirmasi
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountSettingsPage() {
  const { status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/"); },
  });
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [dialog, setDialog] = useState<ActionType | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const actions = useMemo<ActionConfig[]>(() => [
    {
      type: "reset-data",
      title: "Reset Data",
      label: "Reset data",
      description: "Hapus semua data finansial dan mulai ulang dengan kategori serta tipe akun default.",
      impact: [
        "Akun/dompet, transaksi, budget, goal tabungan, dan tagihan akan dihapus.",
        "Untuk Google Sheets, isi tab Transaksi, Budget, dan Akun dikosongkan tetapi header tetap ada.",
        "Akun login, email, password, dan koneksi Google tetap dipertahankan.",
      ],
      endpoint: "/api/user/reset-data",
      method: "POST",
      icon: <Eraser className="h-5 w-5" />,
    },
    {
      type: "reset-account",
      title: "Reset Akun",
      label: "Reset akun",
      description: "Reset data finansial dan konfigurasi setup aplikasi agar akun dapat disiapkan ulang dari awal.",
      impact: [
        "Semua data finansial akan dihapus seperti Reset Data.",
        "Koneksi Google Sheets dan marker setup akan direset dari akun BudgetIn.",
        "Kamu akan logout setelah proses selesai agar session dan setup baru bersih.",
      ],
      endpoint: "/api/user/reset-account",
      method: "POST",
      icon: <RefreshCw className="h-5 w-5" />,
      destructive: true,
    },
    {
      type: "delete-account",
      title: "Delete Account",
      label: "Hapus akun",
      description: "Hapus akun BudgetIn ini beserta seluruh data terkait secara permanen.",
      impact: [
        "User account akan dihapus permanen dari BudgetIn dan tidak bisa dibatalkan.",
        "Untuk Google Sheets, data Sheet akan dikosongkan lebih dulu jika token Google masih valid.",
        "File Google Sheet tidak dihapus dari Google Drive.",
      ],
      endpoint: "/api/user/account",
      method: "DELETE",
      icon: <Trash2 className="h-5 w-5" />,
      destructive: true,
    },
  ], []);

  const activeAction = actions.find((action) => action.type === dialog) ?? null;

  async function fetchUser() {
    setLoadingUser(true);
    try {
      const res = await fetch("/api/user", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setUser(data.user);
      else setMessage({ text: data.error ?? "Gagal memuat profil akun.", ok: false });
    } finally {
      setLoadingUser(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") void fetchUser();
  }, [status]);

  function openDialog(type: ActionType) {
    setDialog(type);
    setConfirmation("");
    setMessage(null);
  }

  async function handleConfirm() {
    if (!activeAction) return;
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(activeAction.endpoint, {
        method: activeAction.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Aksi gagal diproses.", ok: false });
        return;
      }

      setDialog(null);
      setConfirmation("");
      if (activeAction.type === "delete-account") {
        setMessage({ text: "Akun berhasil dihapus. Kamu akan keluar dari BudgetIn.", ok: true });
        setTimeout(() => void signOut({ callbackUrl: "/" }), 900);
        return;
      }
      if (activeAction.type === "reset-account") {
        setMessage({ text: "Reset akun selesai. Kamu akan logout untuk memulai setup baru.", ok: true });
        setTimeout(() => void signOut({ callbackUrl: "/" }), 1200);
        return;
      }

      setMessage({ text: "Reset data selesai. Data default sudah disiapkan kembali.", ok: true });
      await fetchUser();
    } finally {
      setActionLoading(false);
    }
  }

  if (status === "loading" || loadingUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <div className="rounded-[32px] border border-border/70 bg-card/85 p-6 shadow-sm backdrop-blur md:p-8">
        <p className="label-mono text-primary">Account controls</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Akun & Data</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Kelola reset data, reset setup akun, dan penghapusan akun BudgetIn. Semua aksi di halaman ini membutuhkan konfirmasi tambahan.
        </p>
      </div>

      {message && (
        <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${message.ok ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {message.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <section className="grid gap-4 rounded-[28px] border border-border/70 bg-card p-5 shadow-sm md:grid-cols-3 md:p-6">
        <div className="flex items-center gap-3 md:col-span-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserCog className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{user?.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
            {user?.createdAt && <p className="mt-1 text-xs text-muted-foreground">Terdaftar {formatDate(user.createdAt)}</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em]">Storage</p>
          </div>
          <p className="mt-2 text-lg font-semibold text-foreground">{storageLabel(user)}</p>
        </div>
      </section>

      <div className="space-y-4">
        {actions.map((action) => (
          <ActionCard key={action.type} action={action} onOpen={openDialog} />
        ))}
      </div>

      {activeAction && (
        <ConfirmationModal
          action={activeAction}
          loading={actionLoading}
          value={confirmation}
          onValueChange={setConfirmation}
          onClose={() => !actionLoading && setDialog(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
