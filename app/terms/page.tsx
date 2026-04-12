import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan — BudgetIn",
  description: "Syarat dan ketentuan penggunaan aplikasi BudgetIn.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-6 backdrop-blur-sm sticky top-0 bg-background/80 z-10">
        <Link href="/" className="font-bold tracking-tight text-lg hover:opacity-80 transition-opacity">
          BudgetIn
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-16">
        <div className="space-y-2 mb-10">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Legal</p>
          <h1 className="text-3xl font-bold tracking-tight">Syarat &amp; Ketentuan</h1>
          <p className="text-sm text-muted-foreground">Terakhir diperbarui: 12 April 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">1. Penerimaan Syarat</h2>
            <p>
              Dengan mengakses dan menggunakan BudgetIn, kamu menyatakan telah membaca, memahami, dan menyetujui syarat dan ketentuan ini. Jika tidak setuju, harap hentikan penggunaan layanan.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">2. Deskripsi Layanan</h2>
            <p>
              BudgetIn adalah aplikasi pencatat keuangan pribadi berbasis AI yang memungkinkan pengguna mencatat transaksi menggunakan bahasa alami. Data disinkronkan ke Google Sheets milik pengguna. Layanan ini disediakan oleh{" "}
              <a href="https://amuharr.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">Akbar Muharram</a>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">3. Akun Pengguna</h2>
            <p>Untuk menggunakan BudgetIn, kamu perlu login dengan akun Google. Kamu bertanggung jawab untuk:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Menjaga keamanan akun dan kredensial login.</li>
              <li>Memastikan seluruh aktivitas yang dilakukan melalui akunmu.</li>
              <li>Segera menginformasikan jika terjadi akses tidak sah ke akunmu.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">4. Penggunaan yang Diperbolehkan</h2>
            <p>Kamu diperbolehkan menggunakan BudgetIn untuk:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Mencatat dan mengelola keuangan pribadi.</li>
              <li>Mengakses laporan dan analisis keuangan pribadi.</li>
              <li>Mengintegrasikan data dengan Google Sheets milik sendiri.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">5. Larangan Penggunaan</h2>
            <p>Pengguna dilarang:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Menggunakan layanan untuk tujuan ilegal atau melanggar hukum yang berlaku di Indonesia.</li>
              <li>Mencoba meretas, memanipulasi, atau mengganggu sistem BudgetIn.</li>
              <li>Membagikan akses akun kepada pihak lain.</li>
              <li>Menggunakan bot atau skrip otomatis untuk mengakses layanan secara berlebihan.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">6. Kepemilikan Data</h2>
            <p>
              Data transaksi yang kamu input adalah <span className="text-foreground font-medium">milikmu sepenuhnya</span>. BudgetIn hanya memproses data tersebut untuk menjalankan layanan. Kamu dapat mengekspor atau menghapus datamu kapan saja melalui Google Sheets yang terhubung.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">7. Ketersediaan Layanan</h2>
            <p>
              Kami berusaha menjaga layanan tetap aktif 24/7, namun tidak menjamin ketersediaan tanpa gangguan. BudgetIn berhak melakukan pemeliharaan, pembaruan, atau penghentian layanan sewaktu-waktu dengan atau tanpa pemberitahuan sebelumnya.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">8. Batasan Tanggung Jawab</h2>
            <p>
              BudgetIn disediakan &quot;sebagaimana adanya&quot; (<em>as-is</em>). Kami tidak bertanggung jawab atas kerugian finansial yang timbul akibat keputusan yang dibuat berdasarkan data atau analisis dari aplikasi ini. Gunakan sebagai alat bantu, bukan sebagai satu-satunya sumber keputusan keuangan.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">9. Perubahan Syarat</h2>
            <p>
              Kami berhak memperbarui syarat ini kapan saja. Versi terbaru selalu tersedia di halaman ini. Penggunaan layanan setelah pembaruan berarti kamu menerima syarat yang baru.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">10. Hukum yang Berlaku</h2>
            <p>
              Syarat dan ketentuan ini diatur oleh hukum yang berlaku di Republik Indonesia. Segala sengketa diselesaikan melalui musyawarah, atau jika diperlukan, melalui pengadilan yang berwenang di Jakarta.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">11. Hubungi Kami</h2>
            <p>
              Pertanyaan terkait syarat ini dapat dikirimkan ke:{" "}
              <a href="mailto:akbar.rm10@gmail.com" className="text-primary hover:underline underline-offset-4">akbar.rm10@gmail.com</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t flex gap-6 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">&larr; Kembali ke Beranda</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">Kebijakan Privasi &rarr;</Link>
        </div>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        <p>&copy; 2026 BudgetIn &mdash; Dikembangkan oleh{" "}
          <a href="https://amuharr.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">Akbar Muharram</a>
        </p>
      </footer>
    </div>
  );
}
