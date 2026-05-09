"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

function AuthErrorInner() {
  const { get } = useSearchParams();
  const error = get("error");

  const isOnboardingFailed = error === "OnboardingFailed";
  const isGooglePermissionRequired = error === "GooglePermissionRequired";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold text-destructive">
          {isGooglePermissionRequired
            ? "Permission Google diperlukan"
            : isOnboardingFailed
              ? "Gagal menyiapkan akun"
              : "Terjadi kesalahan"}
        </h1>
        <p className="text-muted-foreground max-w-sm">
          {isGooglePermissionRequired
            ? "BudgetIn membutuhkan akses Google Sheets dan Drive file agar akun Google bisa menyimpan data dengan benar. Silakan login ulang dan izinkan semua permission."
            : isOnboardingFailed
            ? "Gagal membuat Google Sheets untuk akun kamu. Silakan coba login ulang."
            : "Terjadi kesalahan saat login. Silakan coba lagi."}
        </p>
      </div>

      <Button onClick={() => signIn("google", { callbackUrl: "/dashboard" })}>
        Coba Lagi
      </Button>
    </main>
  );
}

export default function AuthErrorContent() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Memuat…</p></div>}>
      <AuthErrorInner />
    </Suspense>
  );
}
