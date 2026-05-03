"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Eye, EyeOff, MailCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEMO_ACCOUNT } from "@/lib/demo-account";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";
import type { TurnstileInstance } from "@marsidev/react-turnstile";

type Tab = "login" | "register";

// ── Inner component (needs useSearchParams) ──────────────────────────────────
function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demoLoginAttemptedRef = useRef(false);

  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  // UI special states
  const [verificationSentEmail, setVerificationSentEmail] = useState(""); // post-register state
  const [unverifiedEmail, setUnverifiedEmail] = useState(""); // login block state
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Turnstile CAPTCHA
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const captchaEnabled = process.env.NODE_ENV === "production" && !!siteKey;

  // Query param banners
  const verifiedParam = searchParams.get("verified");
  const errorParam = searchParams.get("error");
  const demoParam = searchParams.get("demo");

  useEffect(() => {
    if (demoParam !== "1") return;
    if (loading || googleLoading || verificationSentEmail || unverifiedEmail) return;
    if (demoLoginAttemptedRef.current) return;

    let cancelled = false;

    async function autoLoginDemo() {
      demoLoginAttemptedRef.current = true;
      setTab("login");
      setEmail(DEMO_ACCOUNT.email);
      setPassword(DEMO_ACCOUNT.password);
      setError("");
      setLoading(true);

      const res = await signIn("credentials", {
        email: DEMO_ACCOUNT.email,
        password: DEMO_ACCOUNT.password,
        turnstileToken: turnstileToken ?? "",
        redirect: false,
      });

      if (cancelled) return;

      if (res?.error) {
        if (res.error.includes("CAPTCHA_FAILED")) {
          setError("Login demo gagal karena verifikasi keamanan belum siap.");
        } else {
          setError("Akun demo belum tersedia. Jalankan seed akun demo dulu.");
        }
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    }

    void autoLoginDemo();

    return () => {
      cancelled = true;
    };
  }, [
    demoParam,
    googleLoading,
    loading,
    router,
    turnstileToken,
    unverifiedEmail,
    verificationSentEmail,
  ]);

  // ── Helper: kirim ulang email verifikasi ─────────────────────────────────
  async function handleResend(targetEmail: string) {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengirim email.");
      } else {
        setResendSuccess(true);
        setError("");
      }
    } catch {
      setError("Gagal mengirim email. Coba lagi.");
    } finally {
      setResendLoading(false);
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  // ── Form Submit ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (tab === "register") {
      // ── Register ───────────────────────────────────────────────────────
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, turnstileToken }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal mendaftar.");
        if (captchaEnabled) {
          turnstileRef.current?.reset();
          setTurnstileToken(null);
        }
        setLoading(false);
        return;
      }

      // Server returns verification_sent — tampilkan "cek email" screen
      setVerificationSentEmail(email);
      setLoading(false);
      return;
    } else {
      // ── Login ──────────────────────────────────────────────────────────
      const res = await signIn("credentials", {
        email,
        password,
        turnstileToken: turnstileToken ?? "",
        redirect: false,
      });

      if (res?.error) {
        if (captchaEnabled) {
          turnstileRef.current?.reset();
          setTurnstileToken(null);
        }
        // Cek apakah email belum diverifikasi
        if (res.error.includes("EMAIL_NOT_VERIFIED")) {
          setUnverifiedEmail(email);
        } else if (res.error.includes("CAPTCHA_FAILED")) {
          setError("Verifikasi CAPTCHA gagal. Coba lagi.");
        } else {
          setError("Email atau password salah.");
        }
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    }

    setLoading(false);
  }

  // ── POST-REGISTER: "Cek email kamu!" screen ──────────────────────────────
  if (verificationSentEmail) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <MailCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold">Cek email kamu!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Kami mengirim link verifikasi ke{" "}
              <span className="font-medium text-foreground">{verificationSentEmail}</span>.
              Klik link tersebut untuk mengaktifkan akun.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Link berlaku 24 jam.</p>
          {resendSuccess ? (
            <div className="flex items-center justify-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Email terkirim ulang!
            </div>
          ) : (
            <div className="space-y-2">
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Tidak dapat email?{" "}
                <button
                  onClick={() => handleResend(verificationSentEmail)}
                  disabled={resendLoading}
                  className="font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {resendLoading ? "Mengirim…" : "Kirim ulang"}
                </button>
              </p>
            </div>
          )}
          <button
            onClick={() => {
              setVerificationSentEmail("");
              setTab("login");
              setEmail(verificationSentEmail);
              setPassword("");
              setError("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Kembali ke halaman login
          </button>
        </div>
      </div>
    );
  }

  // ── EMAIL BELUM DIVERIFIKASI screen ───────────────────────────────────────
  if (unverifiedEmail) {
    return (
      <div className="w-full max-w-sm space-y-6">
        <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-yellow-500/10 p-4">
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold">Email belum diverifikasi</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Kamu perlu memverifikasi email{" "}
              <span className="font-medium text-foreground">{unverifiedEmail}</span>{" "}
              sebelum bisa login.
            </p>
          </div>
          {resendSuccess ? (
            <div className="flex items-center justify-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Email verifikasi terkirim!
            </div>
          ) : (
            <div className="space-y-2">
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleResend(unverifiedEmail)}
                disabled={resendLoading}
              >
                {resendLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Kirim ulang email verifikasi
              </Button>
            </div>
          )}
          <button
            onClick={() => {
              setUnverifiedEmail("");
              setError("");
              setResendSuccess(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Kembali ke halaman login
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN AUTH FORM ─────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Banner: email berhasil diverifikasi */}
      {verifiedParam === "true" && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40 px-3 py-2.5 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Email berhasil diverifikasi! Silakan login.
        </div>
      )}
      {verifiedParam === "already" && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-3 py-2.5 text-sm text-blue-700 dark:text-blue-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Email sudah diverifikasi sebelumnya. Silakan login.
        </div>
      )}
      {errorParam === "token_expired" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Link verifikasi sudah kadaluarsa.
          </div>
          <button
            onClick={() => {
              router.replace("/auth");
              setUnverifiedEmail(email);
            }}
            className="text-xs font-medium hover:underline"
          >
            Minta link baru →
          </button>
        </div>
      )}
      {errorParam === "invalid_token" && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Link verifikasi tidak valid atau sudah digunakan.
        </div>
      )}

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {tab === "login" ? "Masuk ke BudgetIn" : "Buat akun baru"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tab === "login" ? "Belum punya akun? " : "Sudah punya akun? "}
          <button
            onClick={() => {
              setTab(tab === "login" ? "register" : "login");
              setError("");
              setTurnstileToken(null);
              if (captchaEnabled) turnstileRef.current?.reset();
            }}
            className="font-medium text-primary hover:underline"
          >
            {tab === "login" ? "Daftar" : "Masuk"}
          </button>
        </p>
        {demoParam === "1" && (
          <p className="text-xs text-primary">
            Menyiapkan login otomatis ke akun demo...
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
        {/* Google button */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Lanjutkan dengan Google
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">atau</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {tab === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nama</label>
              <Input
                placeholder="Nama lengkap"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input
              type="email"
              placeholder="kamu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Password</label>
            <div className="relative">
              <Input
                type={showPass ? "text" : "password"}
                placeholder={tab === "register" ? "Minimal 8 karakter" : "Password"}
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
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Cloudflare Turnstile CAPTCHA */}
          {captchaEnabled && (
            <div className="flex justify-center">
              <Turnstile
                ref={turnstileRef}
                siteKey={siteKey}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken(null)}
                onError={() => setTurnstileToken(null)}
                options={{ theme: "auto", size: "normal" }}
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || googleLoading || (captchaEnabled && !turnstileToken)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {tab === "login" ? "Masuk" : "Buat Akun"}
          </Button>
        </form>

        {tab === "register" && (
          <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
            Dengan mendaftar kamu setuju dengan syarat penggunaan.
            Data transaksi disimpan di database kami (bukan Google Sheets).
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page wrapper (Suspense untuk useSearchParams) ─────────────────────────────
export default function AuthPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <Link href="/" className="font-bold tracking-tight text-lg">
          BudgetIn
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Suspense fallback={
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }>
          <AuthForm />
        </Suspense>
      </main>
    </div>
  );
}
