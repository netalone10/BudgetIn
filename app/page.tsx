import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { TrendingUp, ShieldCheck, BarChart3 } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session?.userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Navbar */}
      <header className="flex h-14 items-center justify-between border-b px-6 backdrop-blur-sm sticky top-0 bg-background/80 z-10">
        <span className="font-bold tracking-tight text-lg">Catatuang</span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center gap-8 px-4 py-20 text-center">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Data tersimpan langsung di Google Sheets milikmu
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl leading-tight">
              Catat pengeluaran,{" "}
              <span className="text-primary">pahami uangmu</span>
              {" "}— cukup dengan ketik.
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Tulis seperti chat biasa. AI kami yang proses sisanya — kategori, budget, hingga laporan otomatis.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Link href="/auth" className={buttonVariants({ size: "lg", className: "px-8" })}>
              Mulai Gratis
            </Link>
            <p className="text-xs text-muted-foreground">
              Gratis · Tidak perlu kartu kredit · Login dengan email atau Google
            </p>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="mx-auto w-full max-w-5xl px-4 pb-20">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Card 1: Expense */}
            <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium">Catat Transaksi</span>
              </div>
              <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-xs">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">Kamu</span>
                  <span className="text-foreground">Makan siang warteg 18rb</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">AI</span>
                  <span className="text-muted-foreground">✓ Dicatat: Makan — Rp 18.000</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tulis natural — AI otomatis ekstrak nominal, kategori, dan tanggal.
              </p>
            </div>

            {/* Card 2: Budget */}
            <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                </div>
                <span className="text-sm font-medium">Kelola Budget</span>
              </div>
              <div className="space-y-2.5 rounded-lg bg-muted/50 p-3 text-xs">
                {[
                  { label: "Makan", pct: 68, color: "bg-green-500" },
                  { label: "Transport", pct: 45, color: "bg-blue-500" },
                  { label: "Hiburan", pct: 92, color: "bg-yellow-500" },
                ].map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="font-medium">{item.label}</span>
                      <span className="text-muted-foreground">{item.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Set budget per kategori. Dapat peringatan saat mendekati batas.
              </p>
            </div>

            {/* Card 3: Report */}
            <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-purple-500/10 p-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                </div>
                <span className="text-sm font-medium">Laporan AI</span>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-xs">
                <div className="flex justify-between font-medium">
                  <span>Total bulan ini</span>
                  <span>Rp 1.240.000</span>
                </div>
                <div className="space-y-1">
                  {[
                    { cat: "Makan", w: "60%" },
                    { cat: "Transport", w: "25%" },
                    { cat: "Hiburan", w: "15%" },
                  ].map((r) => (
                    <div key={r.cat} className="flex items-center gap-2">
                      <span className="w-16 text-[10px] text-muted-foreground">{r.cat}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: r.w }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground border-t pt-2 leading-relaxed">
                  &quot;Pengeluaran terbesar di Makan (60%). Pertimbangkan masak di rumah...&quot;
                </p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Minta rekap kapan saja. AI kasih analisis + saran actionable.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © 2026 Catatuang · Dibuat dengan ❤️ untuk kantong Indonesia
      </footer>
    </div>
  );
}
