"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw } from "lucide-react";
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
          <div className="rounded-2xl bg-yellow-500/10 p-3 text-yellow-600 flex-shrink-0">
            {done ? <CheckCircle2 className="size-6" /> : <AlertTriangle className="size-6" />}
          </div>
          <div className="space-y-2">
            <p className="label-mono text-primary">Google Sheets Setup</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {mode === "reconnect"
                ? "Hubungkan ulang Google"
                : done
                  ? "Setup selesai"
                  : "Selesaikan setup Google Sheets"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === "reconnect"
                ? "Akun Google kamu belum terhubung ke Google Sheets. Ini terjadi karena izin Drive belum diberikan saat login. Login ulang dan izinkan akses Google Drive file untuk melanjutkan — data kamu tidak akan hilang."
                : done
                  ? "Google Sheets sudah siap. Dashboard kamu sekarang aktif."
                  : "Google Sheets baru sudah dibuat. Periksa ringkasan data di bawah, lalu pilih tindakan yang sesuai."}
            </p>
          </div>
        </div>

        {mode === "reconnect" ? (
          <div className="mt-6 space-y-4">
            {/* Langkah reconnect */}
            <div className="rounded-xl bg-muted/60 p-4 space-y-3">
              <p className="text-sm font-medium">Cara menghubungkan ulang:</p>
              <ol className="space-y-2 text-sm text-muted-foreground list-none">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-semibold mt-0.5">1</span>
                  <span>Klik tombol <strong className="text-foreground">Reconnect Google</strong> di bawah.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-semibold mt-0.5">2</span>
                  <span>Di layar izin Google, pastikan <strong className="text-foreground">semua permission dicentang</strong> — termasuk akses Google Drive file.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-semibold mt-0.5">3</span>
                  <span>Klik <strong className="text-foreground">Lanjutkan</strong> untuk menyelesaikan setup.</span>
                </li>
              </ol>
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-blue-500/10 px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
              <Info className="size-3.5 flex-shrink-0 mt-0.5" />
              <span>BudgetIn hanya mengakses file Google Sheets yang dibuat oleh BudgetIn sendiri. File Drive lainnya tidak pernah dibaca.</span>
            </div>
            <Button onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
              <RefreshCw className="size-4" /> Reconnect Google
            </Button>
          </div>
        ) : loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat preview data…
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {summary && (
              <div className="grid gap-2 sm:grid-cols-3">
                <Info2 label="Akun" value={summary.accounts} />
                <Info2 label="Transaksi" value={summary.transactions} />
                <Info2 label="Budget" value={summary.budgets} />
                <Info2 label="Kategori" value={summary.categories} />
                <Info2 label="Savings" value={summary.savingsGoals + summary.savingsContributions} />
                <Info2 label="Berulang" value={summary.recurringTransactions + summary.recurringOccurrences} />
              </div>
            )}

            {/* Penjelasan pilihan aksi */}
            {!done && preview && (
              <div className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground space-y-1">
                {preview.canMigrate && (
                  <p><strong className="text-foreground">Migrasikan data saya</strong> — salin data dari database BudgetIn ke Google Sheets kamu yang baru. Pilih ini jika kamu punya data lama yang ingin dipindahkan.</p>
                )}
                {preview.canMarkComplete && (
                  <p><strong className="text-foreground">Data di Sheets sudah sesuai</strong> — tandai setup selesai tanpa memindahkan data. Pilih ini jika Google Sheets kamu sudah berisi data yang benar.</p>
                )}
                {!preview.canMigrate && !preview.canMarkComplete && (
                  <p>Setup sudah selesai atau tidak ada tindakan yang diperlukan.</p>
                )}
              </div>
            )}

            {preview?.warnings.map((w) => (
              <p key={w} className="rounded-xl bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
                {w}
              </p>
            ))}
            {error && (
              <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={migrate} disabled={!preview?.canMigrate || busy || done}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Migrasikan data saya ke Google Sheets
              </Button>
              {preview?.canMarkComplete && (
                <Button variant="outline" onClick={markComplete} disabled={busy || done}>
                  Data di Sheets sudah sesuai
                </Button>
              )}
              {done && (
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Buka dashboard
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info2({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{fmt(value)}</p>
    </div>
  );
}
