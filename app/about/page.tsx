import PublicFooter from "@/components/PublicFooter";
import ThemeToggle from "@/components/ThemeToggle";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tentang BudgetIn — Aplikasi Keuangan Pribadi Berbasis AI",
  description:
    "Pelajari bagaimana BudgetIn membantu pencatatan pengeluaran, budget, tagihan, dan tabungan pribadi dengan input natural berbasis AI.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "Tentang BudgetIn — Aplikasi Keuangan Pribadi Berbasis AI",
    description:
      "BudgetIn dibuat untuk membantu kamu mencatat transaksi harian, memahami pola keuangan, dan menjaga data tetap mudah dipindahkan.",
    url: "/about",
  },
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-sm">
        <Link href="/" className="text-lg font-bold tracking-tight transition-opacity hover:opacity-80">
          BudgetIn
        </Link>
        <ThemeToggle />
      </header>

      <main id="main-content" className="mx-auto flex-1 w-full max-w-3xl px-4 sm:px-6 py-16">
        <div className="mb-12 space-y-4">
          <p className="label-mono text-primary">Tentang BudgetIn</p>
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight-h2 text-foreground">
            Budget tracker yang dibuat untuk cara orang Indonesia mencatat uang sehari-hari.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            BudgetIn membantu kamu mencatat pengeluaran, pemasukan, transfer, tagihan, budget, dan tabungan tanpa harus membuka spreadsheet atau mengisi form panjang setiap kali transaksi terjadi.
          </p>
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Kenapa BudgetIn dibuat</h2>
            <p>
              Banyak orang ingin lebih rapi mengelola uang, tetapi kebiasaan mencatat sering berhenti karena prosesnya terasa rumit. BudgetIn dirancang agar input transaksi terasa seperti menulis pesan singkat: cukup ketik aktivitas dan nominal, lalu sistem membantu menyusun kategorinya.
            </p>
            <p>
              Fokus utamanya bukan hanya menyimpan angka, tetapi membantu kamu melihat pola, memahami kategori yang mulai membengkak, dan mengambil keputusan kecil yang lebih tenang setiap hari.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Cara kerja singkat</h2>
            <p>
              BudgetIn membaca input natural, mengubahnya menjadi catatan transaksi yang terstruktur, lalu menampilkannya dalam dashboard, budget, cashflow, kalender, tagihan, dan target tabungan. Untuk pengguna Google, data transaksi juga dapat tersimpan di Google Sheets milik pengguna sendiri.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">Privasi dan kendali data</h2>
            <p>
              Data keuangan adalah data sensitif. Karena itu BudgetIn menyediakan halaman kebijakan privasi, kontrol akun, dan opsi pengelolaan data agar pengguna memahami bagaimana data diproses dan bagaimana permintaan penghapusan dapat dilakukan.
            </p>
            <p>
              BudgetIn dikembangkan oleh{" "}
              <a href="https://amuharr.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                Akbar Muharram
              </a>{" "}
              sebagai aplikasi pencatat keuangan pribadi yang ringan, responsif, dan mudah dipakai di perangkat harian.
            </p>
          </section>

          <section id="google-api-disclosure" className="space-y-3 rounded-lg border border-border bg-muted/40 px-5 py-4">
            <h2 className="text-xl font-semibold text-foreground">Google API — Pernyataan Penggunaan Data</h2>
            <p>
              BudgetIn menggunakan Google API untuk memungkinkan pengguna menyimpan data transaksi ke Google Sheets milik mereka sendiri. Penggunaan dan transfer informasi yang diterima dari Google API ke aplikasi lain mana pun akan mematuhi{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline underline-offset-4"
              >
                Google API Services User Data Policy
              </a>
              , termasuk persyaratan Limited Use.
            </p>
            <p>
              BudgetIn hanya meminta akses ke file Google Sheets yang dibuat oleh aplikasi ini atas nama pengguna. Data yang diperoleh dari Google API tidak digunakan untuk keperluan iklan, tidak dijual kepada pihak ketiga, dan tidak digunakan di luar fungsi inti aplikasi.
            </p>
            <p className="text-xs text-muted-foreground">
              The use and transfer of information received from Google APIs to any other app will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline underline-offset-4"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>
        </div>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8">
          <Link href="/auth" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            Mulai Gratis
          </Link>
          <Link href="/contact" className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            Hubungi Kami
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
