"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AlertTriangle, KeyRound, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

function AuthErrorInner() {
  const { get } = useSearchParams();
  const error = get("error");

  const isOnboardingFailed = error === "OnboardingFailed";
  const isGooglePermissionRequired = error === "GooglePermissionRequired";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-md rounded-[32px] border bg-card p-8 shadow-sm space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="rounded-2xl bg-destructive/10 p-4 text-destructive">
            {isGooglePermissionRequired ? (
              <KeyRound className="size-7" />
            ) : (
              <ShieldAlert className="size-7" />
            )}
          </div>
        </div>

        {/* Heading */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isGooglePermissionRequired
              ? "Izin Google diperlukan"
              : isOnboardingFailed
                ? "Gagal menyiapkan akun"
                : "Terjadi kesalahan login"}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isGooglePermissionRequired
              ? "BudgetIn membutuhkan akses Google Drive file untuk menyimpan data transaksi di Google Sheets milikmu. Izin ini tidak digunakan untuk mengakses file lain."
              : isOnboardingFailed
                ? "Gagal membuat Google Sheets untuk akun kamu. Ini biasanya terjadi karena izin Drive belum diberikan. Silakan coba login ulang."
                : "Terjadi kesalahan saat login. Silakan coba lagi."}
          </p>
        </div>

        {/* Langkah-langkah untuk Google permission error */}
        {isGooglePermissionRequired && (
          <ol className="space-y-2 text-sm text-muted-foreground list-none">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-semibold mt-0.5">1</span>
              <span>Klik tombol di bawah untuk login ulang dengan Google.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-semibold mt-0.5">2</span>
              <span>Di layar izin Google, centang <strong className="text-foreground">semua permission</strong> yang diminta — termasuk akses Google Drive file.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-primary/10 text-primary text-xs font-semibold mt-0.5">3</span>
              <span>Klik <strong className="text-foreground">Lanjutkan</strong> untuk menyelesaikan setup akun.</span>
            </li>
          </ol>
        )}

        {/* Catatan keamanan */}
        {isGooglePermissionRequired && (
          <div className="rounded-xl bg-muted/60 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
            <AlertTriangle className="size-3.5 flex-shrink-0 mt-0.5" />
            <span>
              BudgetIn hanya membuat dan mengakses file Google Sheets yang dibuat oleh BudgetIn sendiri.
              Data file Google Drive lainnya tidak pernah dibaca atau dimodifikasi.
            </span>
          </div>
        )}

        {/* CTA */}
        <Button
          className="w-full"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        >
          <RefreshCw className="size-4" />
          {isGooglePermissionRequired || isOnboardingFailed
            ? "Login ulang dengan Google"
            : "Coba lagi"}
        </Button>
      </div>
    </main>
  );
}

export default function AuthErrorContent() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Memuat…</p>
      </div>
    }>
      <AuthErrorInner />
    </Suspense>
  );
}
