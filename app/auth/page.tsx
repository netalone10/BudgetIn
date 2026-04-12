"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";

type Tab = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (tab === "register") {
      // ── Register ─────────────────────────────────────────────────────────
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal mendaftar.");
        setLoading(false);
        return;
      }

      // Auto-login setelah register berhasil
      const loginRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginRes?.error) {
        setError("Akun dibuat, tapi gagal login. Coba login manual.");
        setTab("login");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } else {
      // ── Login ─────────────────────────────────────────────────────────────
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Email atau password salah.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <Link href="/" className="font-bold tracking-tight text-lg">
          Catatuang
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {tab === "login" ? "Masuk ke Catatuang" : "Buat akun baru"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tab === "login"
                ? "Belum punya akun? "
                : "Sudah punya akun? "}
              <button
                onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); }}
                className="font-medium text-primary hover:underline"
              >
                {tab === "login" ? "Daftar" : "Masuk"}
              </button>
            </p>
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

              <Button
                type="submit"
                className="w-full"
                disabled={loading || googleLoading}
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
      </main>
    </div>
  );
}
