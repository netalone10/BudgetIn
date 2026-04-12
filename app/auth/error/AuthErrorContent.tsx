"use client";

import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const isOnboardingFailed = error === "OnboardingFailed";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-destructive">
          {isOnboardingFailed ? "Gagal menyiapkan akun" : "Terjadi kesalahan"}
        </h1>
        <p className="text-muted-foreground max-w-sm">
          {isOnboardingFailed
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
