import PublicFooter from "@/components/PublicFooter";
import ThemeToggle from "@/components/ThemeToggle";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kontak BudgetIn — Bantuan, Privasi, dan Dukungan Pengguna",
  description:
    "Hubungi BudgetIn untuk pertanyaan dukungan, kebijakan privasi, permintaan data, penghapusan akun, atau masukan terkait aplikasi keuangan pribadi.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Kontak BudgetIn — Bantuan, Privasi, dan Dukungan Pengguna",
    description:
      "Kirim pertanyaan dukungan, masukan produk, atau permintaan terkait data dan privasi pengguna BudgetIn.",
    url: "/contact",
  },
};

const contactTopics = [
  "Bantuan login dan akses akun",
  "Pertanyaan tentang privasi dan data pengguna",
  "Permintaan penghapusan akun atau data",
  "Masukan fitur dan laporan bug aplikasi",
];

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
        <Link href="/" className="text-lg font-bold tracking-tight transition-opacity hover:opacity-80">
          BudgetIn
        </Link>
        <ThemeToggle />
      </header>

      <main id="main-content" className="mx-auto flex-1 w-full max-w-3xl px-6 py-16">
        <div className="mb-12 space-y-4">
          <p className="label-mono text-primary">Kontak</p>
          <h1 className="text-4xl font-semibold tracking-tight-h2 text-foreground">
            Butuh bantuan atau ingin membahas data kamu di BudgetIn?
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Kamu bisa menghubungi kami untuk pertanyaan produk, dukungan akun, laporan bug, atau permintaan terkait privasi dan penghapusan data pengguna.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_0.85fr]">
          <section className="rounded-[28px] border border-border bg-card p-8 shadow-sm">
            <h2 className="text-xl font-semibold text-foreground">Email utama</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Kirim pesan ke alamat email berikut dan sertakan konteks singkat agar kami bisa memahami kebutuhanmu dengan lebih cepat.
            </p>
            <a href="mailto:akbar.rm10@gmail.com" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              akbar.rm10@gmail.com
            </a>
          </section>

          <section className="rounded-[28px] border border-border bg-muted/35 p-8">
            <h2 className="text-xl font-semibold text-foreground">Topik yang bisa dibantu</h2>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {contactTopics.map((topic) => (
                <li key={topic} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-10 rounded-[28px] border border-border bg-card p-8 text-sm leading-relaxed text-muted-foreground shadow-sm">
          <h2 className="text-xl font-semibold text-foreground">Permintaan data dan privasi</h2>
          <p className="mt-3">
            Untuk permintaan akses data, koreksi informasi, penghapusan akun, atau pertanyaan tentang pemrosesan data, cantumkan email akun BudgetIn yang digunakan. Kami akan menggunakan informasi tersebut hanya untuk memverifikasi dan memproses permintaanmu.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/privacy" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
              Baca Kebijakan Privasi
            </Link>
            <Link href="/terms" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
              Baca Syarat Penggunaan
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
