"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Testi = {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatarBg: string;
  approved: boolean;
  approvedAt: string | null;
  createdAt: string;
  user: { email: string };
};

type Filter = "pending" | "approved" | "all";

export default function AdminTestimonialsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("pending");
  const [items, setItems] = useState<Testi[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filter === "all" ? "" : `?status=${filter}`;
      const res = await fetch(`/api/admin/testimonials${q}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      setItems(data.testimonials ?? []);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth");
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    load();
  }, [load, status]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function setApproved(id: string, approved: boolean) {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error ?? "Gagal update.", false);
        return;
      }
      showToast(approved ? "Testimoni di-approve." : "Approval dicabut.", true);
      await load();
    } finally {
      setActionId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus testimoni ini secara permanen?")) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data?.error ?? "Gagal hapus.", false);
        return;
      }
      showToast("Testimoni dihapus.", true);
      await load();
    } finally {
      setActionId(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex flex-col w-full">
        <div className="flex flex-1 items-center justify-center flex-col gap-3 min-h-[60vh]">
          <ShieldCheck className="size-12 text-muted-foreground" />
          <p className="text-lg font-semibold">Akses Ditolak</p>
          <p className="text-sm text-muted-foreground">Kamu tidak memiliki izin untuk halaman ini.</p>
        </div>
      </div>
    );
  }

  const pendingCount = items.filter((x) => !x.approved).length;
  const approvedCount = items.filter((x) => x.approved).length;

  return (
    <div className="flex flex-col w-full">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Kembali ke admin
          </Link>
        </div>

        <div className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/12 via-card to-card p-6 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <ShieldCheck className="size-3.5 text-primary" />
            Moderasi Testimoni
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
            Testimoni Submission
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve atau tolak testimoni yang dikirim user. Hanya yang approved yang tampil di landing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(["pending", "approved", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                filter === f
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {f === "pending"
                ? `Pending${filter === "pending" ? ` (${pendingCount})` : ""}`
                : f === "approved"
                  ? `Approved${filter === "approved" ? ` (${approvedCount})` : ""}`
                  : "Semua"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border bg-card p-12 text-center">
              <Loader2 className="mx-auto mb-2 size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Memuat testimoni...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center">
              <p className="text-sm text-muted-foreground">
                Belum ada testimoni{filter !== "all" ? ` ${filter === "pending" ? "pending" : "approved"}` : ""}.
              </p>
            </div>
          ) : (
            items.map((t) => (
              <div key={t.id} className="rounded-2xl border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
                    style={{ background: t.avatarBg }}
                  >
                    {t.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{t.name}</p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <p className="text-sm text-muted-foreground">{t.role}</p>
                      <div className="ml-auto flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <Star className="size-3 fill-amber-500 text-amber-500" />
                          {t.rating}
                        </span>
                        <StatusBadge approved={t.approved} />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t.user.email} · Dikirim {fmtDate(t.createdAt)}
                      {t.approved && t.approvedAt && ` · Approved ${fmtDate(t.approvedAt)}`}
                    </p>
                    <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">
                      “{t.quote}”
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {t.approved ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setApproved(t.id, false)}
                          disabled={actionId === t.id}
                        >
                          {actionId === t.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Undo2 className="size-3.5" />
                          )}
                          Cabut approval
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => setApproved(t.id, true)}
                          disabled={actionId === t.id}
                        >
                          {actionId === t.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(t.id)}
                        disabled={actionId === t.id}
                      >
                        <Trash2 className="size-3.5" />
                        Hapus
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {toast && (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm shadow-lg",
            toast.ok
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/80 dark:text-green-400"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {toast.ok ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertTriangle className="size-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      <CheckCircle2 className="size-3" />
      Approved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500">
      <Clock className="size-3" />
      Pending
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
