import ThemeToggle from "@/components/ThemeToggle";
import PublicFooter from "@/components/PublicFooter";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi BudgetIn — Perlindungan Data Pengguna",
  description:
    "Pelajari bagaimana BudgetIn mengumpulkan, menggunakan, menyimpan, dan melindungi data akun, transaksi, Google Sheets, serta hak privasi pengguna.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Kebijakan Privasi BudgetIn — Perlindungan Data Pengguna",
    description:
      "Informasi privasi BudgetIn tentang data akun, transaksi, Google Sheets, layanan pihak ketiga, hak pengguna, dan permintaan penghapusan data.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>
      <header className="flex h-14 items-center justify-between border-b px-6 backdrop-blur-sm sticky top-0 bg-background/80 z-10">
        <Link href="/" className="font-bold tracking-tight text-lg hover:opacity-80 transition-opacity">
          BudgetIn
        </Link>
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-4 text-sm font-medium text-muted-foreground sm:flex" aria-label="Navigasi informasi">
            <Link href="/about" className="transition-colors hover:text-primary">
              Tentang
            </Link>
            <Link href="/contact" className="transition-colors hover:text-primary">
              Kontak
            </Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="main-content" className="flex-1 mx-auto w-full max-w-2xl px-6 py-16">
        <div className="space-y-2 mb-10">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Legal</p>
          <h1 className="text-3xl font-semibold tracking-tight">Kebijakan Privasi</h1>
          <p className="text-sm text-muted-foreground">Terakhir diperbarui: 13 Mei 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">1. Tentang BudgetIn</h2>
            <p>
              BudgetIn adalah aplikasi pencatat keuangan pribadi berbasis AI yang dikembangkan oleh{" "}
              <a href="https://amuharr.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                Akbar Muharram
              </a>. Kami berkomitmen untuk melindungi privasi dan data pribadi pengguna.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">2. Data Google User yang Diakses</h2>
            <p>
              Saat kamu login menggunakan Google OAuth dan menggunakan fitur BudgetIn, aplikasi kami mengakses data Google berikut:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><span className="text-foreground font-medium">Profil Google:</span> nama, alamat email, dan foto profil dari akun Google kamu &mdash; digunakan untuk autentikasi dan personalisasi akun.</li>
              <li><span className="text-foreground font-medium">Google Sheets:</span> BudgetIn membuat dan mengakses Google Sheets khusus di Google Drive kamu untuk menyimpan data transaksi keuangan. Kami hanya mengakses spreadsheet yang dibuat oleh aplikasi ini, bukan spreadsheet lain di Drive kamu.</li>
              <li><span className="text-foreground font-medium">Google Drive (scope terbatas):</span> akses dibatasi hanya untuk membuat dan mengelola file spreadsheet BudgetIn. Kami tidak mengakses, membaca, atau mengunduh file lain di Google Drive kamu.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">3. Data yang Kami Kumpulkan</h2>
            <p>Selain data Google di atas, kami mengumpulkan data berikut:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><span className="text-foreground font-medium">Data Transaksi:</span> catatan pengeluaran dan pemasukan yang kamu input ke aplikasi.</li>
              <li><span className="text-foreground font-medium">Data Penggunaan:</span> log aktivitas dasar untuk keperluan debugging dan peningkatan layanan.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">4. Bagaimana Kami Menggunakan Data Google</h2>
            <p>Data Google yang diakses digunakan semata-mata untuk:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><span className="text-foreground font-medium">Autentikasi:</span> data profil Google digunakan untuk memverifikasi identitas kamu saat login.</li>
              <li><span className="text-foreground font-medium">Sinkronisasi Data Keuangan:</span> transaksi yang kamu input disinkronkan dan disimpan ke Google Sheets milik kamu sendiri.</li>
              <li><span className="text-foreground font-medium">Laporan Keuangan:</span> data dari Google Sheets digunakan untuk menghasilkan laporan dan analisis keuangan personal.</li>
            </ul>
            <p className="mt-2">
              Kami <span className="text-foreground font-medium">tidak menggunakan data Google untuk tujuan lain</span> di luar fungsionalitas aplikasi BudgetIn. Kami tidak menggunakan data Google untuk iklan, profiling, atau tujuan komersial di luar layanan ini.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">5. Pembagian Data Google ke Pihak Ketiga</h2>
            <p>
              Kami <span className="text-foreground font-medium">tidak membagikan, menjual, atau menyewakan</span> data Google user kepada pihak ketiga. Data Google kamu hanya diproses oleh:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><span className="text-foreground font-medium">Google</span> &mdash; sebagai penyedia layanan OAuth dan Sheets API. Data diproses sesuai kebijakan privasi Google.</li>
              <li><span className="text-foreground font-medium">Supabase</span> &mdash; sebagai penyimpanan database. Data transaksi yang disimpan di Supabase tidak termasuk data Google langsung, hanya data transaksi yang kamu input.</li>
            </ul>
            <p className="mt-2">
              Data Google tidak dikirim ke layanan AI pihak ketiga. Fitur AI BudgetIn (input transaksi via bahasa alami) hanya memproses teks transaksi yang kamu input, bukan data Google.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">6. Penyimpanan dan Perlindungan Data Google</h2>
            <p>
              Data Google yang diakses oleh BudgetIn ditangani dengan standar keamanan berikut:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><span className="text-foreground font-medium">OAuth Tokens:</span> token akses Google disimpan secara terenkripsi di database dan tidak pernah di-log atau diekspos.</li>
              <li><span className="text-foreground font-medium">Google Sheets:</span> data transaksi disimpan langsung di Google Sheets milik kamu &mdash; BudgetIn tidak menyalin atau menyimpan ulang konten Sheets ke server kami.</li>
              <li><span className="text-foreground font-medium">Enkripsi:</span> semua komunikasi antara BudgetIn dan Google menggunakan HTTPS/TLS. Data di database dienkripsi at-rest oleh Supabase.</li>
              <li><span className="text-foreground font-medium">Akses Terbatas:</span> hanya sistem BudgetIn yang memiliki izin OAuth yang dapat mengakses data Google kamu. Tidak ada akses manual oleh developer ke data pengguna.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">7. Retensi dan Penghapusan Data Google</h2>
            <p>
              <span className="text-foreground font-medium">Retensi:</span> data Google (akses ke Sheets, profil) disimpan selama akun BudgetIn kamu masih aktif. Jika kamu menghapus akun BudgetIn, seluruh token OAuth dan referensi ke Google Sheets akan dihapus dari sistem kami.
            </p>
            <p>
              <span className="text-foreground font-medium">Penghapusan:</span> kamu dapat menghapus data Google dari BudgetIn dengan cara berikut:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2 pl-2">
              <li>Melalui pengaturan akun di aplikasi BudgetIn (fitur hapus akun).</li>
              <li>Mencabut akses Google OAuth melalui{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                  Pengaturan Keamanan Akun Google
                </a>.
              </li>
              <li>Mengirim permintaan penghapusan ke{" "}
                <a href="mailto:akbar.rm10@gmail.com" className="text-primary hover:underline underline-offset-4">akbar.rm10@gmail.com</a>.
              </li>
            </ul>
            <p className="mt-2">
              Setelah permintaan penghapusan diproses, token OAuth dan data akun akan dihapus dari sistem aktif dalam waktu 30 hari. Google Sheets yang telah dibuat di Drive kamu tetap ada dan dapat kamu hapus manual dari Google Drive.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">8. Layanan Pihak Ketiga</h2>
            <p>BudgetIn menggunakan layanan pihak ketiga berikut:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><span className="text-foreground font-medium">Google OAuth &amp; Sheets API</span> &mdash; untuk autentikasi dan sinkronisasi data keuangan.</li>
              <li><span className="text-foreground font-medium">Groq AI</span> &mdash; untuk pemrosesan bahasa alami pada input transaksi (hanya memproses teks input, bukan data Google).</li>
              <li><span className="text-foreground font-medium">Vercel</span> &mdash; untuk hosting dan deployment aplikasi.</li>
              <li><span className="text-foreground font-medium">Supabase</span> &mdash; untuk penyimpanan database aplikasi.</li>
            </ul>
            <p className="mt-2">Setiap layanan di atas tunduk pada kebijakan privasi masing-masing.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">9. Hak Pengguna</h2>
            <p>Kamu memiliki hak untuk:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Mengakses data pribadi yang kami simpan.</li>
              <li>Meminta penghapusan akun dan seluruh data terkait, termasuk data Google.</li>
              <li>Mencabut akses Google OAuth kapan saja melalui{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline underline-offset-4">
                  Pengaturan Akun Google
                </a>.
              </li>
              <li>Meminta penjelasan tentang data Google apa saja yang diakses oleh BudgetIn.</li>
            </ul>
            <p className="mt-2">Untuk mengajukan permintaan, hubungi kami di <a href="mailto:akbar.rm10@gmail.com" className="text-primary hover:underline underline-offset-4">akbar.rm10@gmail.com</a>.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">10. Perubahan Kebijakan</h2>
            <p>
              Kami dapat memperbarui kebijakan privasi ini sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui notifikasi dalam aplikasi atau email. Penggunaan layanan setelah pembaruan berarti kamu menyetujui kebijakan yang baru.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">11. Hubungi Kami</h2>
            <p>
              Jika ada pertanyaan terkait privasi atau data Google kamu, silakan hubungi:{" "}
              <a href="mailto:akbar.rm10@gmail.com" className="text-primary hover:underline underline-offset-4">akbar.rm10@gmail.com</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t flex gap-6 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">&larr; Kembali ke Beranda</Link>
          <Link href="/terms" className="hover:text-primary transition-colors">Syarat &amp; Ketentuan &rarr;</Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
