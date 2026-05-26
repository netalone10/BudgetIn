"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/ThemeToggle";
import PublicFooter from "@/components/PublicFooter";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Terjadi kesalahan. Coba lagi.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

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
        <div className="w-full max-w-sm space-y-6">
          {sent ? (
            <div className="rounded-xl border bg-card p-8 shadow-sm text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <MailCheck className="size-8 text-primary" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold">Cek email kamu!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Jika email <span className="font-medium text-foreground">{email}</span> terdaftar,
                  kami mengirimkan link untuk reset password.
                </p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 text-left">
                <p className="font-medium">Belum lihat email-nya?</p>
                <p className="leading-relaxed">
                  Cek folder <strong>Spam</strong> atau <strong>Promotions</strong>. Link berlaku 1 jam.
                </p>
              </div>
              <Link
                href="/auth"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline"
              >
                <ArrowLeft className="size-3.5" />
                Kembali ke halaman login
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Lupa Password?</h1>
                <p className="text-sm text-muted-foreground">
                  Masukkan email kamu dan kami akan mengirim link untuk reset password.
                </p>
              </div>

              <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
                {error && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Email</span>
                    <Input
                      type="email"
                      placeholder="kamu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                    Kirim Link Reset
                  </Button>
                </form>

                <div className="text-center">
                  <Link
                    href="/auth"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="size-3.5" />
                    Kembali ke login
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
