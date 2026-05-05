"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileJson, Loader2, RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackupSummary {
  categories: number;
  accountTypes: number;
  accounts: number;
  transactions: number;
  budgets: number;
  savingsGoals: number;
  savingsContributions: number;
  recurringBills: number;
  billPayments: number;
  totalRecords: number;
}

interface RestorePreview {
  sourceStorageMode: string;
  targetStorageMode: string;
  path: string;
  summary: BackupSummary;
  existing: BackupSummary;
  warnings: string[];
}

const summaryLabels: Array<[keyof BackupSummary, string]> = [
  ["categories", "Kategori"],
  ["accountTypes", "Tipe akun"],
  ["accounts", "Akun"],
  ["transactions", "Transaksi"],
  ["budgets", "Budget"],
  ["savingsGoals", "Goal tabungan"],
  ["savingsContributions", "Kontribusi tabungan"],
  ["recurringBills", "Tagihan rutin"],
  ["billPayments", "Riwayat bayar tagihan"],
];

function storageLabel(value: string) {
  if (value === "database") return "Database";
  if (value === "sheets") return "Google Sheets";
  if (value === "google_setup_required_db_fallback") return "Google setup fallback";
  return value;
}

function SummaryGrid({ summary }: { summary: BackupSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {summaryLabels.map(([key, label]) => (
        <div key={key} className="rounded-2xl border border-border bg-background px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{summary[key].toLocaleString("id-ID")}</p>
        </div>
      ))}
    </div>
  );
}

export default function BackupRestorePage() {
  const [fileName, setFileName] = useState("");
  const [backupPayload, setBackupPayload] = useState<unknown | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const canRestore = useMemo(() => !!backupPayload && !!preview && !loadingPreview && !restoring, [backupPayload, loadingPreview, preview, restoring]);

  async function handleDownload() {
    setMessage(null);
    const res = await fetch("/api/backup/export");
    if (!res.ok) {
      setMessage({ text: "Gagal membuat file backup.", ok: false });
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const downloadName = match?.[1] ?? `budgetin-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage({ text: "Backup berhasil dibuat dan diunduh.", ok: true });
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setBackupPayload(null);
    setMessage(null);
    setFileName(file?.name ?? "");
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      setBackupPayload(payload);
      await requestPreview(payload);
    } catch {
      setMessage({ text: "File JSON tidak valid.", ok: false });
    }
  }

  async function requestPreview(payload: unknown) {
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/backup/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Gagal membaca backup.", ok: false });
        return;
      }
      setPreview(data.preview);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleRestore() {
    if (!backupPayload) return;
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupPayload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "Restore gagal.", ok: false });
        return;
      }
      setPreview(data.result);
      setMessage({ text: "Restore selesai. Refresh dashboard untuk melihat data terbaru.", ok: true });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <div className="rounded-[32px] border border-border/70 bg-card/85 p-6 shadow-sm backdrop-blur md:p-8">
        <p className="label-mono text-primary">Data portability</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Backup & Restore</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Download backup JSON dari akun lama, lalu upload di akun baru untuk memulihkan data tanpa input ulang. Format backup kompatibel untuk user Database dan Google Sheets.
        </p>
      </div>

      {message && (
        <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${message.ok ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {message.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
          <span>{message.text}</span>
        </div>
      )}

      <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Download className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.18em]">Backup</p>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-foreground">Export data akun ini</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              File backup berisi data keuangan BudgetIn, tapi tidak menyertakan password, token Google, atau session.
            </p>
          </div>
          <Button onClick={handleDownload} className="rounded-2xl">
            <Download className="mr-2 h-4 w-4" /> Download backup JSON
          </Button>
        </div>
      </section>

      <section className="rounded-[28px] border border-border/70 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2 text-primary">
          <Upload className="h-5 w-5" />
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">Restore</p>
        </div>
        <h2 className="mt-2 text-xl font-semibold text-foreground">Restore ke akun aktif</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Upload file backup, cek preview source-to-target, lalu konfirmasi restore. Mode restore default adalah merge-safe.
        </p>

        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-border bg-background px-6 py-8 text-center transition hover:border-primary/60 hover:bg-primary/5">
          <FileJson className="h-9 w-9 text-muted-foreground" />
          <span className="mt-3 text-sm font-medium text-foreground">{fileName || "Pilih file backup JSON"}</span>
          <span className="mt-1 text-xs text-muted-foreground">Maksimal sesuai limit server backup.</span>
          <input type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />
        </label>

        {loadingPreview && (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Membaca preview backup...
          </div>
        )}

        {preview && (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-border bg-background p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Restore path</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {storageLabel(preview.sourceStorageMode)} → {storageLabel(preview.targetStorageMode)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Total {preview.summary.totalRecords.toLocaleString("id-ID")} record di file backup.</p>
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Perhatian
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            )}

            <SummaryGrid summary={preview.summary} />

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button disabled={!canRestore} onClick={handleRestore} className="rounded-2xl">
                {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Konfirmasi restore
              </Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh halaman
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
