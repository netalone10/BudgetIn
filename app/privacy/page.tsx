import ThemeToggle from "@/components/ThemeToggle";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi — BudgetIn",
  description: "Kebijakan privasi penggunaan aplikasi BudgetIn.",
};

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold tracking-tight">Kebijakan Privasi</h1>
          <p className="text-sm text-muted-foreground">Terakhir diperbarui: 12 April 2026</p>
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
            <h2 className="text-base font-semibold text-foreground">2. Data yang Kami Kumpulkan</h2>
            <p>Ketika kamu menggunakan BudgetIn, kami mengumpulkan data berikut:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><span className="text-foreground font-medium">Data Akun:</span> nama, alamat email, dan foto profil dari akun Google kamu saat login.</li>
              <li><span className="text-foreground font-medium">Data Transaksi:</span> catatan pengeluaran dan pemasukan yang kamu input ke aplikasi.</li>
              <li><span className="text-foreground font-medium">Data Google Sheets:</span> akses ke Google Sheets yang dibuat otomatis untuk menyimpan data keuanganmu.</li>
              <li><span className="text-foreground font-medium">Data Penggunaan:</span> log aktivitas dasar untuk keperluan debugging dan peningkatan layanan.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">3. Bagaimana Kami Menggunakan Data</h2>
            <p>Data yang dikumpulkan digunakan semata-mata untuk:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Menjalankan layanan pencatatan keuangan dan fitur AI.</li>
              <li>Menyinkronkan data transaksi ke Google Sheets milik kamu.</li>
              <li>Memberikan laporan dan analisis keuangan personal.</li>
              <li>Meningkatkan performa dan kualitas aplikasi.</li>
            </ul>
            <p className="mt-2">Kami <span className="text-foreground font-medium">tidak menjual, menyewakan, atau membagikan</span> data pribadimu kepada pihak ketiga untuk tujuan komersial.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">4. Penyimpanan Data</h2>
            <p>
              Data kamu disimpan di infrastruktur <span className="text-foreground font-medium">Supabase</span> yang aman dengan enkripsi standar industri. Data transaksi juga tersimpan langsung di <span className="text-foreground font-medium">Google Sheets milikmu sendiri</span> &mdash; artinya kamu memiliki kendali penuh atas datamu.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">5. Layanan Pihak Ketiga</h2>
            <p>BudgetIn menggunakan layanan pihak ketiga berikut:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><span className="text-foreground font-medium">Google OAuth &amp; Sheets API</span> &mdash; untuk autentikasi dan sinkronisasi data.</li>
              <li><span className="text-foreground font-medium">Groq AI</span> &mdash; untuk pemrosesan bahasa alami pada input transaksi.</li>
              <li><span className="text-foreground font-medium">Vercel</span> &mdash; untuk hosting dan deployment aplikasi.</li>
              <li><span className="text-foreground font-medium">Supabase</span> &mdash; untuk penyimpanan database.</li>
            </ul>
            <p className="mt-2">Setiap layanan di atas tunduk pada kebijakan privasi masing-masing.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">6. Hak Pengguna</h2>
            <p>Kamu memiliki hak untuk:</p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>Mengakses data pribadi yang kami simpan.</li>
              <li>Meminta penghapusan akun dan seluruh data terkait.</li>
              <li>Mencabut akses Google OAuth kapan saja melalui pengaturan akun Google kamu.</li>
            </ul>
            <p className="mt-2">Untuk mengajukan permintaan, hubungi kami di <a href="mailto:akbar.rm10@gmail.com" className="text-primary hover:underline underline-offset-4">akbar.rm10@gmail.com</a>.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">7. Perubahan Kebijakan</h2>
            <p>
              Kami dapat memperbarui kebijakan privasi ini sewaktu-waktu. Perubahan signifikan akan diberitahukan melalui notifikasi dalam aplikasi atau email. Penggunaan layanan setelah pembaruan berarti kamu menyetujui kebijakan yang baru.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">8. Hubungi Kami</h2>
            <p>
              Jika ada pertanyaan terkait privasi, silakan hubungi:{" "}
              <a href="mailto:akbar.rm10@gmail.com" className="text-primary hover:underline underline-offset-4">akbar.rm10@gmail.com</a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t flex gap-6 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">&larr; Kembali ke Beranda</Link>
          <Link href="/terms" className="hover:text-primary transition-colors">Syarat &amp; Ketentuan &rarr;</Link>
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
