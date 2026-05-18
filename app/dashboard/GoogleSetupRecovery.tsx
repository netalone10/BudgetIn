"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Summary = { accounts: number; transactions: number; budgets: number; categories: number; savingsGoals: number; savingsContributions: number; recurringTransactions: number; recurringOccurrences: number; totalRecords: number };
type Preview = { summary: Summary; existing: Summary; warnings: string[]; canMigrate: boolean; canMarkComplete: boolean; migratedAt: string | null };

const ID_NUMBER_FORMAT = new Intl.NumberFormat("id-ID");

function fmt(n: number) {
  return ID_NUMBER_FORMAT.format(n);
}

export default function GoogleSetupRecovery({ mode }: { mode: "reconnect" | "migrate" }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(mode === "migrate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (mode !== "migrate") return;
    fetch("/api/google-setup-migration")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal memuat preview.");
        setPreview(data.preview);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Gagal memuat preview."))
      .finally(() => setLoading(false));
  }, [mode]);

  async function migrate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/google-setup-migration", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal migrasi.");
      setPreview(data.preview);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal migrasi.");
    } finally {
      setBusy(false);
    }
  }

  async function markComplete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/google-setup-migration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-complete" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menandai setup selesai.");
      setPreview(data.preview);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menandai setup selesai.");
    } finally {
      setBusy(false);
    }
  }

  const summary = preview?.summary;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-3xl items-center px-4 py-10 md:px-8">
      <div className="w-full rounded-[32px] border bg-card p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-yellow-500/10 p-3 text-yellow-600">
            {done ? <CheckCircle2 className="size-6" /> : <AlertTriangle className="size-6" />}
          </div>
          <div className="space-y-2">
            <p className="label-mono text-primary">Google Sheets Setup</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {mode === "reconnect" ? "Hubungkan ulang Google" : done ? "Migrasi selesai" : "Migrasikan data fallback"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === "reconnect"
                ? "Akun Google kamu belum punya Google Sheet. Login ulang dan izinkan akses Drive file untuk melanjutkan."
                : "Sheet baru sudah siap. Periksa ringkasan data DB fallback, lalu migrasikan ke Google Sheets jika target masih kosong."}
            </p>
          </div>
        </div>

        {mode === "reconnect" ? (
          <Button className="mt-6" onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
            <RefreshCw className="size-4" /> Reconnect Google
          </Button>
        ) : loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat preview...</div>
        ) : (
          <div className="mt-6 space-y-4">
            {summary && (
              <div className="grid gap-2 sm:grid-cols-3">
                <Info label="Akun" value={summary.accounts} />
                <Info label="Transaksi" value={summary.transactions} />
                <Info label="Budget" value={summary.budgets} />
                <Info label="Kategori" value={summary.categories} />
                <Info label="Savings" value={summary.savingsGoals + summary.savingsContributions} />
                <Info label="Berulang" value={summary.recurringTransactions + summary.recurringOccurrences} />
              </div>
            )}
            {preview?.warnings.map((warning) => <p key={warning} className="rounded-xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">{warning}</p>)}
            {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={migrate} disabled={!preview?.canMigrate || busy || done}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Migrasikan data saya ke Google Sheets
              </Button>
              {preview?.canMarkComplete && (
                <Button variant="outline" onClick={markComplete} disabled={busy || done}>
                  Data di Sheets sudah sesuai
                </Button>
              )}
              {done && <Button variant="outline" onClick={() => window.location.reload()}>Buka dashboard</Button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{fmt(value)}</p></div>;
}
