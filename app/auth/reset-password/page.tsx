"use client";

import { useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { evaluatePassword } from "@/lib/password-strength";
import ThemeToggle from "@/components/ThemeToggle";
import PublicFooter from "@/components/PublicFooter";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordStrength = useMemo(() => evaluatePassword(password), [password]);

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="size-8 text-destructive" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold">Link Tidak Valid</h2>
            <p className="text-sm text-muted-foreground">
              Link reset password tidak valid atau sudah kadaluarsa.
            </p>
          </div>
          <Link
            href="/auth/forgot-password"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Minta link baru →
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-500/10 p-4">
              <CheckCircle2 className="size-8 text-green-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold">Password Berhasil Direset!</h2>
            <p className="text-sm text-muted-foreground">
              Password baru kamu sudah aktif. Silakan login sekarang.
            </p>
          </div>
          <Button className="w-full" onClick={() => router.push("/auth")}>
            Ke Halaman Login
          </Button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordStrength.acceptable) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Terjadi kesalahan. Coba lagi.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Buat Password Baru</h1>
        <p className="text-sm text-muted-foreground">
          Masukkan password baru untuk akun kamu.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive space-y-1">
            <p>{error}</p>
            {error.includes("kadaluarsa") && (
              <Link
                href="/auth/forgot-password"
                className="font-medium hover:underline"
              >
                Minta link baru →
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Password Baru</span>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {password.length > 0 && (
              <PasswordStrengthMeter strength={passwordStrength} />
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !passwordStrength.acceptable}
          >
            {loading && <Loader2 className="size-4 animate-spin mr-2" />}
            Simpan Password Baru
          </Button>
        </form>
      </div>
    </div>
  );
}

function PasswordStrengthMeter({
  strength,
}: {
  strength: ReturnType<typeof evaluatePassword>;
}) {
  const barColor =
    strength.label === "Lemah"
      ? "bg-destructive"
      : strength.label === "Sedang"
      ? "bg-amber-500"
      : "bg-green-500";
  const labelColor =
    strength.label === "Lemah"
      ? "text-destructive"
      : strength.label === "Sedang"
      ? "text-amber-600 dark:text-amber-400"
      : "text-green-600 dark:text-green-400";
  const segmentsFilled = Math.max(1, Math.ceil((strength.score / 4) * 4));

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-1 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i < segmentsFilled ? barColor : "bg-muted"
              )}
            />
          ))}
        </div>
        <span className={cn("text-[11px] font-medium", labelColor)}>
          {strength.label}
        </span>
      </div>
      <ul className="space-y-0.5">
        {strength.checks.map((c) => (
          <li
            key={c.id}
            className={cn(
              "flex items-center gap-1.5 text-[11px]",
              c.passed
                ? "text-muted-foreground"
                : c.required
                ? "text-destructive/80"
                : "text-muted-foreground/60"
            )}
          >
            {c.passed ? (
              <Check className="size-3 shrink-0 text-green-600 dark:text-green-400" />
            ) : (
              <X className="size-3 shrink-0" />
            )}
            <span>
              {c.label}
              {!c.required && <span className="opacity-60"> (opsional)</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>
      <header className="flex h-14 items-center justify-between border-b px-6">
        <Link href="/" className="font-bold tracking-tight text-lg">
          BudgetIn
        </Link>
        <ThemeToggle />
      </header>

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-12"
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </main>
      <PublicFooter />
    </div>
  );
}
