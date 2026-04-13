import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session?.userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-background relative overflow-hidden">
      {/* ── Mintlify Atmospheric Hero Gradient Wash ── */}
      <div className="hero-atmospheric-gradient pointer-events-none absolute inset-0 z-0 h-[800px] w-full" />

      {/* Navbar */}
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-border px-6 backdrop-blur-md sticky top-0 bg-background/80">
        <span className="text-[17px] font-semibold text-foreground tracking-tight">
          BudgetIn
        </span>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 flex-col">

        {/* ── Hero ── */}
        <section className="flex flex-col items-center justify-center gap-8 px-4 pt-32 pb-24 text-center">
          
          <div className="badge-mono border border-border bg-card shadow-sm text-foreground mb-4">
            Catat. Pahami. Hemat.
          </div>

          <div className="space-y-6 max-w-3xl">
            <h1 className="text-5xl sm:text-[64px] font-semibold leading-[1.15] tracking-tight-hero text-foreground">
              Catat pengeluaran,{" "}
              <em className="not-italic text-primary">
                pahami uangmu
              </em>
              {" "}—{" "}
              <br className="hidden sm:block" />
              cukup dengan ketik.
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
              Tulis seperti chat biasa. AI kami yang proses sisanya &mdash;
              kategori, budget, hingga laporan otomatis.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 mt-4">
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/auth"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "font-medium"
                )}
              >
                Mulai Gratis
              </Link>
            </div>
            <p className="text-[13px] text-muted-foreground font-medium">
              Gratis &middot; Tidak perlu kartu kredit &middot; Login dengan Google
            </p>
          </div>
        </section>

        {/* ── Features — Clean Flat Grid ── */}
        <section className="mx-auto w-full max-w-5xl px-4 pb-32 pt-12">
          
          <div className="mb-12 flex flex-col items-center gap-3 text-center">
            <span className="label-mono text-primary">Cara Kerja</span>
            <h2 className="text-[40px] font-semibold tracking-tight-h2 text-foreground">
              Sistem pencatatan termudah
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            
            {/* Feature 01 */}
            <div className="rounded-[24px] border border-border bg-card p-8 shadow-sm transition-all hover:border-[rgba(0,0,0,0.08)] dark:hover:border-[rgba(255,255,255,0.12)]">
              <span className="label-mono text-muted-foreground mb-4 block">01</span>
              <h3 className="text-[20px] font-semibold tracking-tight-h3 mb-4 text-foreground">
                Catat Transaksi
              </h3>
              
              <div className="rounded-2xl border border-border bg-background p-5 mb-5 space-y-4">
                <div className="flex items-start gap-3">
                  <span className="badge-mono bg-[#d4fae8] text-[#0fa76e] dark:bg-[#0fa76e]/20 dark:text-[#18E299]">Kamu</span>
                  <span className="text-sm">Makan siang warteg 18rb</span>
                </div>
                <div className="h-px bg-border" />
                <div className="flex items-start gap-3">
                  <span className="badge-mono bg-muted text-muted-foreground">AI</span>
                  <span className="text-sm text-muted-foreground">
                    ✓ Dicatat: Makan &mdash; Rp 18.000
                  </span>
                </div>
              </div>

              <p className="text-[16px] text-muted-foreground leading-relaxed">
                Tulis natural &mdash; AI otomatis ekstrak nominal, kategori, dan tanggal tanpa form apapun.
              </p>
            </div>

            {/* Feature 02 */}
            <div className="rounded-[24px] border border-border bg-card p-8 shadow-sm transition-all hover:border-[rgba(0,0,0,0.08)] dark:hover:border-[rgba(255,255,255,0.12)]">
              <span className="label-mono text-muted-foreground mb-4 block">02</span>
              <h3 className="text-[20px] font-semibold tracking-tight-h3 mb-4 text-foreground">
                Kelola Budget
              </h3>
              
              <div className="rounded-2xl border border-border bg-background p-5 mb-5 space-y-4">
                {[
                  { label: "Makan", pct: 68 },
                  { label: "Transport", pct: 45 },
                  { label: "Hiburan", pct: 92 },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold uppercase tracking-wide">
                      <span>{item.label}</span>
                      <span className="text-muted-foreground">{item.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${item.pct}%`, opacity: item.pct > 85 ? 1 : 0.7 }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[16px] text-muted-foreground leading-relaxed">
                Set budget per kategori. Dapatkan progres pengeluaran secara visual yang sangat akurat.
              </p>
            </div>

            {/* Feature 03 */}
            <div className="rounded-[24px] border border-border bg-card p-8 shadow-sm transition-all hover:border-[rgba(0,0,0,0.08)] dark:hover:border-[rgba(255,255,255,0.12)]">
              <span className="label-mono text-muted-foreground mb-4 block">03</span>
              <h3 className="text-[20px] font-semibold tracking-tight-h3 mb-4 text-foreground">
                Google Sheets Sync
              </h3>
              
              <div className="rounded-2xl border border-border bg-background p-5 mb-5 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-[#d4fae8] dark:bg-[#0fa76e]/20 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="3" width="16" height="18" rx="3" stroke="#0fa76e" strokeWidth="2" />
                    <path d="M8 8h8M8 12h8M8 16h5" stroke="#0fa76e" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold">Spreadsheet milikmu</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Tidak meninggalkan Google Drive-mu</p>
                </div>
              </div>

              <p className="text-[16px] text-muted-foreground leading-relaxed">
                Privasi terjaga penuh. Seluruh data transaksi disimpan di Spreadsheet pribadi milikmu.
              </p>
            </div>

            {/* Feature 04 */}
            <div className="rounded-[24px] border border-border bg-card p-8 shadow-sm transition-all hover:border-[rgba(0,0,0,0.08)] dark:hover:border-[rgba(255,255,255,0.12)]">
              <span className="label-mono text-muted-foreground mb-4 block">04</span>
              <h3 className="text-[20px] font-semibold tracking-tight-h3 mb-4 text-foreground">
                Laporan & Analisis AI
              </h3>
              
              <div className="rounded-2xl border border-border bg-background p-5 mb-5 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold">Total bulan ini</span>
                  <span className="text-lg font-semibold tracking-tight-h3 text-primary">Rp 1.240.000</span>
                </div>
                <div className="h-px bg-border" />
                <p className="text-sm leading-relaxed italic text-muted-foreground">
                  "Pengeluaran terbesar ada di kategori Makan. Coba untuk lebih sering memasak di rumah agar budget tidak bocor."
                </p>
              </div>

              <p className="text-[16px] text-muted-foreground leading-relaxed">
                Minta laporan kapan saja. AI selalu siap memberi saran yang langsung bisa dipraktikkan.
              </p>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="px-4 pb-32 pt-16 text-center border-t border-border bg-muted/30">
          <div className="mx-auto max-w-lg space-y-8">
            <h2 className="text-[40px] font-semibold tracking-tight-h2 leading-tight text-foreground">
              Jadikan keuanganmu <br />
              <span className="text-primary">winning advantage</span>
            </h2>

            <Link
              href="/auth"
              className={cn(
                buttonVariants({ size: "lg" }),
                "font-medium shadow-md hover:-translate-y-0.5 transition-transform"
              )}
            >
              Mulai Sekarang Gratis
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-10 text-center space-y-4 border-t border-border">
        <span className="block text-[15px] font-semibold text-foreground tracking-tight">
          BudgetIn
        </span>
        <p className="text-[13px] text-muted-foreground font-medium">
          &copy; 2026 BudgetIn &mdash; Aplikasi pencatat keuangan responsif & aman.
        </p>
        <div className="flex items-center justify-center gap-4 text-[13px] font-medium text-muted-foreground mt-4">
          <Link href="/privacy" className="hover:text-primary transition-colors">
            Kebijakan Privasi
          </Link>
          <span>&middot;</span>
          <Link href="/terms" className="hover:text-primary transition-colors">
            Syarat &amp; Ketentuan
          </Link>
        </div>
      </footer>
    </div>
  );
}
