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
      {/* Ambient warm glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(184,134,11,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Paper texture overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "200px 200px",
        }}
      />

      {/* Navbar */}
      <header className="relative z-10 flex h-14 items-center justify-between border-b border-border px-6 backdrop-blur-sm sticky top-0 bg-background/90">
        <span
          className="text-xl font-normal tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
        >
          BudgetIn
        </span>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 flex-col">

        {/* ── Hero ── */}
        <section className="flex flex-col items-center justify-center gap-10 px-4 py-28 text-center">

          {/* Section label with rule lines */}
          <div className="flex items-center gap-4 w-full max-w-xs">
            <span className="h-px flex-1 bg-border" />
            <span className="label-serif">Catat. Pahami. Hemat.</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-6 max-w-2xl">
            <h1
              className="text-[2.5rem] sm:text-5xl lg:text-[3.5rem] leading-[1.1] tracking-[-0.02em] text-foreground"
              style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
            >
              Catat pengeluaran,{" "}
              <em className="not-italic" style={{ color: "var(--primary)" }}>
                pahami uangmu
              </em>
              {" "}—{" "}
              <br className="hidden sm:block" />
              cukup dengan ketik.
            </h1>

            {/* Decorative rule under headline */}
            <div className="flex items-center justify-center gap-4">
              <span className="h-px w-16 bg-border" />
              <span
                className="h-1.5 w-1.5 rounded-full opacity-50"
                style={{ backgroundColor: "var(--primary)" }}
              />
              <span className="h-px w-16 bg-border" />
            </div>

            <p
              className="text-lg max-w-md mx-auto leading-relaxed"
              style={{ color: "var(--muted-foreground)", lineHeight: "1.75" }}
            >
              Tulis seperti chat biasa. AI kami yang proses sisanya &mdash;
              kategori, budget, hingga laporan otomatis.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Link
              href="/auth"
              className={cn(
                buttonVariants({ size: "lg" }),
                "px-10 font-medium tracking-wide min-h-[44px] transition-all duration-200"
              )}
            >
              Mulai Gratis
            </Link>
            <p
              className="text-xs tracking-wide"
              style={{ color: "var(--muted-foreground)" }}
            >
              Gratis &middot; Tidak perlu kartu kredit &middot; Login dengan Google
            </p>
          </div>
        </section>

        {/* ── Features — Asymmetric Editorial Grid ── */}
        <section className="mx-auto w-full max-w-5xl px-4 pb-24">

          {/* Section label */}
          <div className="mb-12 flex items-center gap-4">
            <span className="h-px flex-1 bg-border" />
            <span className="label-serif">Cara Kerja</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Grid with shared 1px border between cells */}
          <div
            className="grid gap-px rounded-xl overflow-hidden"
            style={{ backgroundColor: "var(--border)" }}
          >

            {/* Row 1: wide left (1.4fr) + narrow right (1fr) */}
            <div
              className="grid md:grid-cols-[1.4fr_1fr] gap-px"
              style={{ backgroundColor: "var(--border)" }}
            >
              {/* Feature 01 — Catat Transaksi */}
              <div
                className="p-8 space-y-5 transition-colors duration-200 hover:bg-muted/50"
                style={{ backgroundColor: "var(--card)" }}
              >
                <div>
                  <span
                    className="block mb-3"
                    style={{
                      fontFamily: "var(--font-ibm-plex-mono), monospace",
                      fontSize: "0.75rem",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    01
                  </span>
                  <h3
                    className="text-xl font-semibold leading-snug"
                    style={{
                      fontFamily: "var(--font-playfair), Georgia, serif",
                      color: "var(--foreground)",
                    }}
                  >
                    Catat Transaksi
                  </h3>
                </div>

                {/* Chat preview */}
                <div
                  className="rounded-lg p-4 space-y-3 text-xs"
                  style={{
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest"
                      style={{
                        fontFamily: "var(--font-ibm-plex-mono), monospace",
                        backgroundColor: "rgba(184,134,11,0.1)",
                        color: "var(--primary)",
                      }}
                    >
                      Kamu
                    </span>
                    <span style={{ color: "var(--foreground)" }}>Makan siang warteg 18rb</span>
                  </div>
                  <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
                  <div className="flex items-start gap-2.5">
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest"
                      style={{
                        fontFamily: "var(--font-ibm-plex-mono), monospace",
                        backgroundColor: "var(--muted)",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      AI
                    </span>
                    <span style={{ color: "var(--muted-foreground)" }}>
                      ✓ Dicatat: Makan &mdash; Rp 18.000
                    </span>
                  </div>
                </div>

                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--muted-foreground)", lineHeight: "1.75" }}
                >
                  Tulis natural &mdash; AI otomatis ekstrak nominal, kategori, dan tanggal tanpa form apapun.
                </p>
              </div>

              {/* Feature 02 — Kelola Budget */}
              <div
                className="p-8 space-y-5 transition-colors duration-200 hover:bg-muted/50"
                style={{ backgroundColor: "var(--card)" }}
              >
                <div>
                  <span
                    className="block mb-3"
                    style={{
                      fontFamily: "var(--font-ibm-plex-mono), monospace",
                      fontSize: "0.75rem",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    02
                  </span>
                  <h3
                    className="text-xl font-semibold leading-snug"
                    style={{
                      fontFamily: "var(--font-playfair), Georgia, serif",
                      color: "var(--foreground)",
                    }}
                  >
                    Kelola Budget
                  </h3>
                </div>

                <div
                  className="rounded-lg p-4 space-y-3 text-xs"
                  style={{
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                >
                  {[
                    { label: "Makan", pct: 68 },
                    { label: "Transport", pct: 45 },
                    { label: "Hiburan", pct: 92 },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span style={{ color: "var(--foreground)" }}>{item.label}</span>
                        <span style={{ color: "var(--muted-foreground)" }}>{item.pct}%</span>
                      </div>
                      <div
                        className="h-1 w-full rounded-full"
                        style={{ backgroundColor: "var(--muted)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${item.pct}%`,
                            backgroundColor: "var(--primary)",
                            opacity: item.pct > 85 ? 1 : 0.65,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--muted-foreground)", lineHeight: "1.75" }}
                >
                  Set budget per kategori. Dapat peringatan saat mendekati batas.
                </p>
              </div>
            </div>

            {/* Row 2: narrow left (1fr) + wide right (1.4fr) */}
            <div
              className="grid md:grid-cols-[1fr_1.4fr] gap-px"
              style={{ backgroundColor: "var(--border)" }}
            >
              {/* Feature 03 — Google Sheets */}
              <div
                className="p-8 space-y-5 transition-colors duration-200 hover:bg-muted/50"
                style={{ backgroundColor: "var(--card)" }}
              >
                <div>
                  <span
                    className="block mb-3"
                    style={{
                      fontFamily: "var(--font-ibm-plex-mono), monospace",
                      fontSize: "0.75rem",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    03
                  </span>
                  <h3
                    className="text-xl font-semibold leading-snug"
                    style={{
                      fontFamily: "var(--font-playfair), Georgia, serif",
                      color: "var(--foreground)",
                    }}
                  >
                    Data di Google Sheets
                  </h3>
                </div>

                <div
                  className="flex items-center gap-3 rounded-lg p-4"
                  style={{
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                >
                  <div
                    className="h-9 w-9 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(34,197,94,0.1)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="4" y="3" width="16" height="18" rx="2" stroke="#16a34a" strokeWidth="1.5" />
                      <path d="M8 8h8M8 12h8M8 16h5" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      Spreadsheet milikmu
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      Data tidak meninggalkan Google Drive-mu
                    </p>
                  </div>
                </div>

                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--muted-foreground)", lineHeight: "1.75" }}
                >
                  Semua data tersimpan langsung di Google Sheets milikmu. Privasi terjaga penuh.
                </p>
              </div>

              {/* Feature 04 — Laporan AI */}
              <div
                className="p-8 space-y-5 transition-colors duration-200 hover:bg-muted/50"
                style={{ backgroundColor: "var(--card)" }}
              >
                <div>
                  <span
                    className="block mb-3"
                    style={{
                      fontFamily: "var(--font-ibm-plex-mono), monospace",
                      fontSize: "0.75rem",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    04
                  </span>
                  <h3
                    className="text-xl font-semibold leading-snug"
                    style={{
                      fontFamily: "var(--font-playfair), Georgia, serif",
                      color: "var(--foreground)",
                    }}
                  >
                    Laporan AI
                  </h3>
                </div>

                <div
                  className="rounded-lg p-4 space-y-3 text-xs"
                  style={{
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--background)",
                  }}
                >
                  <div className="flex justify-between font-medium">
                    <span style={{ color: "var(--foreground)" }}>Total bulan ini</span>
                    <span
                      className="text-base"
                      style={{
                        fontFamily: "var(--font-playfair), Georgia, serif",
                        color: "var(--foreground)",
                      }}
                    >
                      Rp 1.240.000
                    </span>
                  </div>
                  <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
                  {[
                    { cat: "Makan", w: "60%" },
                    { cat: "Transport", w: "25%" },
                    { cat: "Hiburan", w: "15%" },
                  ].map((r) => (
                    <div key={r.cat} className="flex items-center gap-3">
                      <span
                        className="w-16 text-[11px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {r.cat}
                      </span>
                      <div
                        className="flex-1 h-1 rounded-full"
                        style={{ backgroundColor: "var(--muted)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: r.w, backgroundColor: "var(--primary)", opacity: 0.7 }}
                        />
                      </div>
                      <span
                        className="text-[11px]"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {r.w}
                      </span>
                    </div>
                  ))}
                  <p
                    className="text-[11px] pt-2.5 leading-relaxed italic"
                    style={{
                      color: "var(--muted-foreground)",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    &ldquo;Pengeluaran terbesar di Makan (60%). Pertimbangkan masak di rumah...&rdquo;
                  </p>
                </div>

                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--muted-foreground)", lineHeight: "1.75" }}
                >
                  Minta rekap kapan saja. AI kasih analisis &amp; saran actionable.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="px-4 pb-32 text-center">
          <div className="mx-auto max-w-lg space-y-8">
            <div className="flex items-center gap-4">
              <span className="h-px flex-1 bg-border" />
              <span
                className="text-xs tracking-[0.15em] uppercase"
                style={{
                  fontFamily: "var(--font-ibm-plex-mono), monospace",
                  color: "var(--muted-foreground)",
                }}
              >
                Mulai Sekarang
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <h2
              className="text-3xl sm:text-4xl leading-tight"
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                color: "var(--foreground)",
              }}
            >
              Kontrol keuanganmu
              <br />
              <em className="not-italic" style={{ color: "var(--primary)" }}>
                mulai hari ini.
              </em>
            </h2>

            <Link
              href="/auth"
              className={cn(
                buttonVariants({ size: "lg" }),
                "px-10 min-h-[44px] font-medium tracking-wide transition-all duration-200"
              )}
            >
              Daftar Gratis
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="relative z-10 py-8 text-center space-y-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-center gap-4 mb-4">
          <span className="h-px w-12 bg-border" />
          <span
            className="text-base font-normal"
            style={{
              fontFamily: "var(--font-playfair), Georgia, serif",
              color: "var(--muted-foreground)",
            }}
          >
            BudgetIn
          </span>
          <span className="h-px w-12 bg-border" />
        </div>
        <p
          className="text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          &copy; 2026 BudgetIn &mdash; Aplikasi pencatat keuangan pribadi berbasis AI
        </p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Dirancang oleh{" "}
          <a
            href="https://amuharr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:underline underline-offset-4"
            style={{ color: "var(--primary)" }}
          >
            Akbar Muharram
          </a>
        </p>
        <p className="flex items-center justify-center gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <Link
            href="/privacy"
            className="transition-colors hover:underline underline-offset-4"
            style={{ color: "inherit" }}
          >
            Kebijakan Privasi
          </Link>
          <span style={{ color: "var(--border)" }}>&middot;</span>
          <Link
            href="/terms"
            className="transition-colors hover:underline underline-offset-4"
            style={{ color: "inherit" }}
          >
            Syarat &amp; Ketentuan
          </Link>
        </p>
      </footer>
    </div>
  );
}
