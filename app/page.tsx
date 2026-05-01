import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const quickEntries = [
  {
    from: "Kamu",
    tone: "bg-primary/12 text-primary ring-1 ring-primary/20",
    text: "Ngopi dan croissant 42rb sebelum meeting",
  },
  {
    from: "AI",
    tone: "bg-muted text-muted-foreground",
    text: "Siap. Tersimpan ke Makan & Minum - Rp 42.000 - Hari ini",
  },
  {
    from: "Kamu",
    tone: "bg-primary/12 text-primary ring-1 ring-primary/20",
    text: "Isi bensin 150rb, sekalian tol 23rb",
  },
  {
    from: "AI",
    tone: "bg-muted text-muted-foreground",
    text: "Dua transaksi dicatat: Transport - Rp 150.000 dan Rp 23.000",
  },
];

const signalCards = [
  {
    eyebrow: "Baca pola",
    title: "Budget yang terasa hidup",
    body:
      "Lihat kategori mana yang mulai memanas sebelum total bulanan telanjur bocor.",
  },
  {
    eyebrow: "Tetap privat",
    title: "Data tetap milikmu",
    body:
      "BudgetIn bekerja di atas spreadsheet Google milikmu sendiri, bukan database tertutup yang sulit dipindahkan.",
  },
  {
    eyebrow: "Minta insight",
    title: "AI yang memberi tindakan",
    body:
      "Bukan cuma angka. Kamu dapat ringkasan singkat dan saran yang langsung bisa dipakai.",
  },
];

const budgetBars = [
  { label: "Makan", pct: 68 },
  { label: "Transport", pct: 45 },
  { label: "Tagihan", pct: 82 },
];

// Auth-aware redirect ditangani di edge oleh `middleware.ts`.
// Halaman ini fully static agar LCP optimal (CDN cache, no DB hit).
export const dynamic = "force-static";

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="hero-atmospheric-gradient pointer-events-none absolute inset-0 z-0 h-[800px] w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-24 z-0 mx-auto h-[520px] w-[min(92vw,1100px)] rounded-full bg-primary/8 blur-3xl" />

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">
          BudgetIn
        </span>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-6xl gap-16 px-4 pb-24 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:px-6 lg:pt-24">
          <div className="text-center lg:text-left">
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-border bg-card/85 px-4 py-2 text-sm shadow-sm backdrop-blur">
              <span className="badge-mono border border-primary/20 bg-primary/12 text-primary">
                AI-first
              </span>
              <span className="text-muted-foreground">
                Catat. Pahami. Hemat.
              </span>
            </div>

            <div className="max-w-3xl space-y-6">
              <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight-hero text-foreground sm:text-[64px]">
                Budget tracker yang terasa
                <span className="text-primary"> seperti ngobrol</span>, bukan isi
                spreadsheet.
              </h1>

              <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground lg:max-w-xl">
                Tulis pengeluaran seperti chat biasa. BudgetIn membaca nominal,
                kategori, dan konteksnya, lalu menyusunnya jadi sistem keuangan
                yang rapi.
              </p>
            </div>

            <div className="mt-8 flex flex-col items-center gap-4 lg:items-start">
              <div className="flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link
                  href="/auth"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "min-w-44 font-medium shadow-lg shadow-primary/20"
                  )}
                >
                  Mulai Gratis
                </Link>
                <a
                  href="#cara-kerja"
                  className="inline-flex min-w-44 items-center justify-center rounded-full border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Lihat Cara Kerja
                </a>
              </div>
              <p className="text-[13px] font-medium text-muted-foreground">
                Gratis - Tidak perlu kartu kredit - Login dengan Google
              </p>
            </div>

            <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
                  Input
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  Bahasa natural
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
                  Output
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  Budget, laporan, insight
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card/85 p-4 shadow-sm backdrop-blur">
                <p className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
                  Storage
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  Google Sheets milikmu
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-8 top-8 hidden h-24 w-24 rounded-full bg-primary/15 blur-2xl lg:block" />
            <div className="absolute -right-6 bottom-8 hidden h-28 w-28 rounded-full bg-foreground/8 blur-3xl dark:bg-white/8 lg:block" />
            <div className="relative overflow-hidden rounded-[32px] border border-border bg-card/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur dark:shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <div className="flex items-center justify-between rounded-[24px] border border-border bg-background/90 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Inbox transaksi
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Semua terasa seperti percakapan
                  </p>
                </div>
                <div className="rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                  Live parsing
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-[24px] border border-border bg-background p-4">
                {quickEntries.map((entry, index) => (
                  <div
                    key={`${entry.from}-${index}`}
                    className={cn(
                      "landing-reveal rounded-2xl px-4 py-3",
                      entry.from === "Kamu"
                        ? "ml-auto max-w-[85%]"
                        : "mr-auto max-w-[92%]",
                      entry.tone
                    )}
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                      {entry.from}
                    </p>
                    <p className="text-sm leading-relaxed">{entry.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[24px] border border-border bg-background p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      Status budget
                    </p>
                    <p className="text-xs text-muted-foreground">Mei 2026</p>
                  </div>
                  <div className="space-y-4">
                    {budgetBars.map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold uppercase tracking-wide">
                          <span>{item.label}</span>
                          <span className="text-muted-foreground">{item.pct}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width]"
                            style={{
                              width: `${item.pct}%`,
                              opacity: item.pct > 75 ? 1 : 0.72,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[24px] border border-border bg-primary/[0.08] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Insight hari ini
                  </p>
                  <p className="mt-3 text-xl font-semibold leading-tight text-foreground">
                    Pengeluaran makan naik lebih cepat dari ritme normal mingguan.
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Coba batasi jajan siang sampai Jumat. Potensinya hemat sekitar
                    Rp 120.000 minggu ini.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/35 py-4">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 text-center text-sm text-muted-foreground lg:justify-between lg:px-6">
            <span>Input natural tanpa form kaku</span>
            <span>Budget kategori yang mudah dibaca</span>
            <span>AI summary yang langsung actionable</span>
            <span>Spreadsheet tetap di akun Google-mu</span>
          </div>
        </section>

        <section
          id="cara-kerja"
          className="mx-auto w-full max-w-6xl px-4 pb-28 pt-16 lg:px-6"
        >
          <div className="mb-12 flex flex-col items-center gap-3 text-center">
            <span className="label-mono text-primary">Cara Kerja</span>
            <h2 className="text-[40px] font-semibold tracking-tight-h2 text-foreground">
              Dari catatan singkat jadi sistem keuangan yang rapi
            </h2>
            <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
              Kamu cukup menulis. BudgetIn mengubah potongan aktivitas harian
              menjadi pencatatan yang konsisten, mudah dianalisis, dan tetap
              terasa ringan dipakai.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-4 md:grid-cols-2">
              {signalCards.map((card, index) => (
                <div
                  key={card.title}
                  className={cn(
                    "rounded-[24px] border border-border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-foreground/10",
                    index === 0 ? "md:col-span-2" : ""
                  )}
                >
                  <span className="label-mono mb-4 block text-muted-foreground">
                    {card.eyebrow}
                  </span>
                  <h3 className="mb-4 text-[22px] font-semibold tracking-tight-h3 text-foreground">
                    {card.title}
                  </h3>
                  <p className="text-[16px] leading-relaxed text-muted-foreground">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-[28px] border border-border bg-card p-8 shadow-sm">
              <span className="label-mono mb-4 block text-muted-foreground">
                Contoh ringkasan
              </span>
              <h3 className="text-[24px] font-semibold tracking-tight-h3 text-foreground">
                "Bulan ini kamu stabil, tapi akhir pekan selalu jadi titik bocor."
              </h3>
              <div className="my-6 h-px bg-border" />
              <div className="space-y-5 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Pengeluaran terbesar masih berada di kategori Makan, tetapi
                  lonjakan paling tajam muncul setiap Sabtu dan Minggu.
                </p>
                <p>
                  Kalau kamu memindahkan dua kali makan akhir pekan ke masak di
                  rumah, budget bulanan bisa turun tanpa mengubah pola hidup
                  harian.
                </p>
                <p className="rounded-2xl bg-muted px-4 py-3 text-foreground">
                  Ringkas, relevan, dan cukup konkret untuk ditindaklanjuti.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-32 pt-4 lg:px-6">
          <div className="mx-auto max-w-5xl rounded-[32px] border border-border bg-card px-6 py-14 text-center shadow-sm sm:px-10">
            <span className="label-mono text-primary">Siap mulai</span>
            <h2 className="mt-4 text-[40px] font-semibold leading-tight tracking-tight-h2 text-foreground">
              Jadikan keuanganmu
              <span className="text-primary"> lebih tenang</span>, satu chat
              pada satu waktu.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              BudgetIn membantu kamu tetap rapi tanpa mengubah cara berpikir.
              Cukup catat seperti biasa, lalu biarkan sistemnya bekerja.
            </p>
            <Link
              href="/auth"
              className={cn(
                buttonVariants({ size: "lg" }),
                "mt-8 font-medium shadow-md transition-transform hover:-translate-y-0.5"
              )}
            >
              Mulai Sekarang Gratis
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 space-y-4 border-t border-border py-10 text-center">
        <span className="block text-[15px] font-semibold tracking-tight text-foreground">
          BudgetIn
        </span>
        <p className="text-[13px] font-medium text-muted-foreground">
          &copy; 2026 BudgetIn - Aplikasi pencatat keuangan responsif dan aman.
        </p>
        <div className="mt-4 flex items-center justify-center gap-4 text-[13px] font-medium text-muted-foreground">
          <Link href="/privacy" className="transition-colors hover:text-primary">
            Kebijakan Privasi
          </Link>
          <span>&middot;</span>
          <Link href="/terms" className="transition-colors hover:text-primary">
            Syarat &amp; Ketentuan
          </Link>
        </div>
      </footer>
    </div>
  );
}
