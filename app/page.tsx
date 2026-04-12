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
    <div className="texture-overlay flex min-h-screen flex-col bg-background">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3" aria-label="CatatUang — Home">
            <svg
              width="28" height="28" viewBox="0 0 28 28" fill="none"
              xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
              className="shrink-0"
            >
              <rect width="28" height="28" rx="4" fill="#1A1A1A" className="dark:fill-foreground" />
              <path d="M7 22 L12.5 7 L14 7 L19.5 22" stroke="#B8860B" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 16.5 L18 16.5" stroke="#B8860B" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M5.5 22 L8.5 22" stroke="#B8860B" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M18.5 22 L21.5 22" stroke="#B8860B" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span
              className="font-display text-lg font-medium tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              CatatUang
            </span>
          </a>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link
              href="/auth"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-[var(--gold)] text-white hover:bg-[var(--gold-light)] hover:shadow-md px-5 min-h-[40px]"
              )}
            >
              Mulai Gratis
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">

        {/* ── Hero ── */}
        <section
          className="relative flex flex-col items-center justify-center overflow-hidden px-4 py-24 text-center md:py-36"
          aria-labelledby="hero-heading"
        >
          {/* Ambient gold glow */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full opacity-[0.03]"
            style={{ background: 'radial-gradient(circle, #B8860B 0%, transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-3xl space-y-6">
            {/* Availability badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/5 px-4 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              <span
                className="small-caps text-[var(--gold)]"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', letterSpacing: '0.12em' }}
              >
                Data tersimpan langsung di Google Sheets milikmu
              </span>
            </div>

            {/* Main headline */}
            <h1
              id="hero-heading"
              className="text-[2.5rem] font-normal leading-[1.1] tracking-[-0.02em] sm:text-[3.5rem] lg:text-[4.5rem]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Catat pengeluaran,{" "}
              <em className="not-italic" style={{ color: 'var(--gold)' }}>pahami uangmu</em>
              {" "}&mdash;<br className="hidden sm:block" />
              cukup dengan ketik.
            </h1>

            <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground">
              Tulis seperti chat biasa. AI kami yang proses sisanya &mdash; kategori,
              budget, hingga laporan otomatis.
            </p>

            {/* CTAs */}
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/auth"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "min-h-[48px] bg-[var(--gold)] px-8 text-white hover:bg-[var(--gold-light)] hover:shadow-lg"
                )}
              >
                Mulai Gratis
              </Link>
              <Link
                href="#cara-kerja"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "min-h-[48px] border-foreground/30 px-8 hover:border-[var(--gold)] hover:text-[var(--gold)]"
                )}
              >
                Lihat cara kerja
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              Gratis &middot; Tidak perlu kartu kredit &middot; Login dengan email atau Google
            </p>

            {/* Decorative rule */}
            <div className="mx-auto h-px w-10 bg-[var(--gold)]/40" aria-hidden="true" />
          </div>
        </section>

        {/* ── How It Works ── */}
        <section
          id="cara-kerja"
          className="border-t border-border px-4 py-20 md:py-28"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto max-w-5xl">
            {/* Section label */}
            <div className="section-label" aria-hidden="true">
              <span className="section-label-line" />
              <span className="section-label-text">Cara Kerja</span>
              <span className="section-label-line" />
            </div>

            <div className="mb-12 text-center">
              <h2
                id="how-heading"
                className="text-[2rem] font-normal leading-[1.2] tracking-[-0.01em] md:text-[2.75rem]"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Tiga langkah,{" "}
                <em style={{ color: 'var(--gold)' }}>satu tujuan</em>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
                Dari catat transaksi sampai laporan keuangan — semua lewat satu kotak teks.
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid gap-6 md:grid-cols-3">

              {/* Card 1: Catat Transaksi */}
              <article
                className="fade-in group relative rounded-lg border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:border-[var(--gold)]/30 hover:shadow-md"
                style={{ boxShadow: '0 1px 2px rgba(26,26,26,0.04)' }}
              >
                <div
                  className="absolute left-0 right-0 top-0 h-0.5 rounded-t-lg bg-border transition-colors duration-200 group-hover:bg-[var(--gold)]"
                  aria-hidden="true"
                />
                <div
                  className="mb-4 font-display text-5xl font-normal leading-none text-[var(--gold)]/15"
                  style={{ fontFamily: 'var(--font-display)' }}
                  aria-hidden="true"
                >
                  01
                </div>
                <h3
                  className="mb-3 text-xl font-medium leading-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Catat Transaksi
                </h3>
                {/* Chat demo */}
                <div className="mb-4 space-y-2 rounded-md bg-muted/50 p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <span
                      className="shrink-0 rounded-full border border-[var(--gold)]/30 px-2 py-0.5 text-[10px] font-medium text-[var(--gold)]"
                      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
                    >
                      KAMU
                    </span>
                    <span className="text-foreground">Makan siang warteg 18rb</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span
                      className="shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400"
                      style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}
                    >
                      AI
                    </span>
                    <span className="text-muted-foreground">
                      &check; Dicatat: Makan &mdash; Rp&nbsp;18.000
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Tulis natural &mdash; AI otomatis ekstrak nominal, kategori, dan tanggal.
                </p>
              </article>

              {/* Card 2: Kelola Budget */}
              <article
                className="fade-in group relative rounded-lg border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:border-[var(--gold)]/30 hover:shadow-md"
                style={{ boxShadow: '0 1px 2px rgba(26,26,26,0.04)' }}
              >
                <div
                  className="absolute left-0 right-0 top-0 h-0.5 rounded-t-lg bg-border transition-colors duration-200 group-hover:bg-[var(--gold)]"
                  aria-hidden="true"
                />
                <div
                  className="mb-4 font-display text-5xl font-normal leading-none text-[var(--gold)]/15"
                  style={{ fontFamily: 'var(--font-display)' }}
                  aria-hidden="true"
                >
                  02
                </div>
                <h3
                  className="mb-3 text-xl font-medium leading-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Kelola Budget
                </h3>
                {/* Budget bars demo */}
                <div className="mb-4 space-y-2.5 rounded-md bg-muted/50 p-3 text-xs">
                  {[
                    { label: "Makan",     pct: 68, color: "#B8860B" },
                    { label: "Transport", pct: 45, color: "#D4A84B" },
                    { label: "Hiburan",   pct: 92, color: "#6B6B6B" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-medium">{item.label}</span>
                        <span
                          className="text-muted-foreground"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {item.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-border">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${item.pct}%`, background: item.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Set budget per kategori. Dapat peringatan saat mendekati batas.
                </p>
              </article>

              {/* Card 3: Laporan AI */}
              <article
                className="fade-in group relative rounded-lg border border-border bg-card p-8 shadow-sm transition-all duration-200 hover:border-[var(--gold)]/30 hover:shadow-md"
                style={{ boxShadow: '0 1px 2px rgba(26,26,26,0.04)' }}
              >
                <div
                  className="absolute left-0 right-0 top-0 h-0.5 rounded-t-lg bg-border transition-colors duration-200 group-hover:bg-[var(--gold)]"
                  aria-hidden="true"
                />
                <div
                  className="mb-4 font-display text-5xl font-normal leading-none text-[var(--gold)]/15"
                  style={{ fontFamily: 'var(--font-display)' }}
                  aria-hidden="true"
                >
                  03
                </div>
                <h3
                  className="mb-3 text-xl font-medium leading-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Laporan AI
                </h3>
                {/* Report demo */}
                <div className="mb-4 rounded-md bg-muted/50 p-3 text-xs space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Total bulan ini</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rp 1.240.000</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { cat: "Makan",     w: "60%" },
                      { cat: "Transport", w: "25%" },
                      { cat: "Hiburan",   w: "15%" },
                    ].map((r) => (
                      <div key={r.cat} className="flex items-center gap-2">
                        <span
                          className="w-16 text-[10px] text-muted-foreground"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {r.cat}
                        </span>
                        <div className="h-1.5 flex-1 rounded-full bg-border">
                          <div
                            className="h-full rounded-full"
                            style={{ width: r.w, background: 'var(--gold)' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
                    &ldquo;Pengeluaran terbesar di Makan (60%). Pertimbangkan masak di rumah...&rdquo;
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Minta rekap kapan saja. AI kasih analisis + saran actionable.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ── Stats Strip ── */}
        <section
          className="border-y border-border px-4 py-14"
          aria-label="Statistik aplikasi"
        >
          <div className="mx-auto max-w-5xl">
            <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { num: "1 Ketik",  label: "Untuk catat transaksi" },
                { num: "100%",     label: "Data milikmu sendiri" },
                { num: "< 2 dtk", label: "Respons AI" },
                { num: "Gratis",   label: "Selamanya, selalu" },
              ].map((s, i) => (
                <div key={i} className="fade-in relative text-center">
                  {i < 3 && (
                    <span
                      className="absolute right-0 top-1/4 hidden h-1/2 w-px bg-border md:block"
                      aria-hidden="true"
                    />
                  )}
                  <dt
                    className="text-[2rem] font-normal leading-none md:text-[2.75rem]"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--gold)' }}
                  >
                    {s.num}
                  </dt>
                  <dd
                    className="mt-2 text-xs text-muted-foreground"
                    style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                  >
                    {s.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── CTA Section ── */}
        <section
          className="px-4 py-24 text-center md:py-32"
          aria-labelledby="cta-heading"
        >
          <div className="mx-auto max-w-2xl">
            <div className="section-label" aria-hidden="true">
              <span className="section-label-line" />
              <span className="section-label-text">Mulai Sekarang</span>
              <span className="section-label-line" />
            </div>

            <h2
              id="cta-heading"
              className="mb-6 text-[2rem] font-normal leading-[1.15] tracking-[-0.01em] md:text-[3rem]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Kendalikan keuanganmu,{" "}
              <em style={{ color: 'var(--gold)' }}>mulai hari ini</em>
            </h2>

            <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Tidak perlu spreadsheet rumit. Tidak perlu aplikasi mahal.
              Cukup ketik &mdash; dan AI kami yang kerjakan sisanya.
            </p>

            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/auth"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "min-h-[52px] bg-[var(--gold)] px-10 text-base text-white hover:bg-[var(--gold-light)] hover:shadow-lg"
                )}
              >
                Daftar Gratis &mdash; Mulai Sekarang
              </Link>
            </div>

            <div className="mt-8 h-px w-12 mx-auto bg-[var(--gold)]/30" aria-hidden="true" />

            <p className="mt-4 text-xs text-muted-foreground">
              Gratis &middot; Tidak perlu kartu kredit &middot; Login dengan email atau Google
            </p>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border px-6 py-10" role="contentinfo">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect width="28" height="28" rx="4" fill="currentColor" className="text-foreground" />
                <path d="M7 22 L12.5 7 L14 7 L19.5 22" stroke="#B8860B" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9 16.5 L18 16.5" stroke="#B8860B" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span
                className="text-sm font-medium"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                CatatUang
              </span>
            </div>

            <p
              className="text-xs text-muted-foreground"
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}
            >
              &copy; 2026 CatatUang &mdash; Dirancang oleh{" "}
              <a
                href="https://amuharr.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--gold)] hover:opacity-70 transition-opacity"
              >
                Akbar Muharram
              </a>
            </p>

            <nav aria-label="Footer links">
              <ul
                className="flex gap-6 text-xs text-muted-foreground"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              >
                <li>
                  <Link href="/privacy" className="hover:text-[var(--gold)] transition-colors">
                    Privasi
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-[var(--gold)] transition-colors">
                    Syarat
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
