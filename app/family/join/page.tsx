"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Users, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InviteInfo {
  email: string;
  displayRole: string | null;
  familyName: string;
  inviterName: string;
}

function JoinInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const token = params.get("token") ?? "";

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setError("Token undangan tidak ada.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/family/invite/accept?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Undangan tidak valid");
      }
      const d = await res.json();
      setInvite(d.invite);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Undangan tidak valid");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function accept() {
    if (status !== "authenticated") {
      // Login dulu, lalu kembali ke halaman ini (token tetap di URL).
      signIn(undefined, { callbackUrl: `/family/join?token=${encodeURIComponent(token)}` });
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch("/api/family/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal bergabung");
      }
      router.push("/dashboard/family");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gagal bergabung");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Users className="size-6 text-primary" />
          <span className="text-lg font-semibold">Undangan Keluarga</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <AlertCircle className="size-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard")}>
              Ke Dashboard
            </Button>
          </div>
        ) : invite ? (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">{invite.inviterName}</strong> mengundangmu bergabung ke
              keluarga <strong className="text-foreground">{invite.familyName}</strong>
              {invite.displayRole ? ` sebagai ${invite.displayRole}` : ""}.
            </p>
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
              Dengan bergabung, transaksimu akan terlihat di tampilan Keluarga (kondisi keuangan
              gabungan) untuk anggota lain. Buku pribadimu tetap milikmu.
            </div>
            <p className="text-xs text-muted-foreground">
              Undangan untuk: <span className="font-medium">{invite.email}</span>
            </p>
            <Button onClick={accept} disabled={accepting} className="w-full">
              {accepting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : status === "authenticated" ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Terima &amp; Gabung
                </>
              ) : (
                "Login untuk Bergabung"
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function JoinFamilyPage() {
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}
