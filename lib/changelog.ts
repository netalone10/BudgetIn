export type ChangelogType = "release" | "improvement" | "fix";

export type ChangelogItem = {
  version: string;
  date: string;
  title: string;
  description: string;
  type: ChangelogType;
  changes: string[];
  githubUrl?: string;
};

export const githubRepositoryUrl = "https://github.com/netalone10/BudgetIn";

export const changelogItems: ChangelogItem[] = [
  {
    version: "v1.6.4",
    date: "2026-05-07",
    title: "Hardening edit tipe akun",
    description: "Rilis patch lanjutan untuk menutup edge case pada tambah/edit akun dan menjaga validasi tipe akun lebih konsisten.",
    type: "fix",
    githubUrl: `${githubRepositoryUrl}/tree/v1.6.4`,
    changes: [
      "Memastikan edit akun database benar-benar menyimpan perubahan tipe akun.",
      "Menyembunyikan tipe akun nonaktif dari pilihan tambah akun, kecuali tipe tersebut sedang dipakai akun yang diedit.",
      "Membersihkan field kartu kredit saat akun dipindahkan ke tipe non-kartu dan memperketat validasi tanggal kartu kredit di server.",
      "Menangani kegagalan load tipe akun tanpa membuat halaman terus loading.",
    ],
  },
  {
    version: "v1.6.3",
    date: "2026-05-07",
    title: "Perbaikan pilihan tipe akun",
    description: "Rilis patch untuk memastikan modal Tambah Akun selalu menyimpan pilihan tipe akun yang valid sebelum akun dibuat.",
    type: "fix",
    githubUrl: `${githubRepositoryUrl}/tree/v1.6.3`,
    changes: [
      "Memperbaiki error Tipe akun harus dipilih yang bisa muncul walau user sudah memilih tipe akun seperti Lainnya (Aset).",
      "Menyinkronkan pilihan tipe akun ketika daftar tipe akun selesai dimuat atau berubah.",
      "Mencegah submit akun baru sebelum tipe akun valid tersedia di form.",
    ],
  },
  {
    version: "v1.6.2",
    date: "2026-05-06",
    title: "Perbaikan layout admin dan riwayat transaksi mobile",
    description: "Rilis patch untuk memperbaiki layout admin panel yang terpotong saat sidebar terbuka dan menampilkan sumber akun di riwayat transaksi mobile.",
    type: "fix",
    githubUrl: `${githubRepositoryUrl}/tree/v1.6.2`,
    changes: [
      "Memperbaiki admin panel yang terpotong saat sidebar terbuka dengan mengaktifkan horizontal scroll dan padding topbar mobile.",
      "Menampilkan nama akun sumber di bawah deskripsi transaksi pada tampilan mobile di riwayat transaksi dashboard.",
    ],
  },
  {
    version: "v1.6.1",
    date: "2026-05-06",
    title: "Perbaikan tampilan mobile dan jam transaksi",
    description: "Rilis patch untuk merapikan ringkasan Akun & Dompet di layar kecil dan memastikan jam transaksi manual tetap akurat saat submit.",
    type: "fix",
    githubUrl: `${githubRepositoryUrl}/tree/v1.6.1`,
    changes: [
      "Mencegah nominal Total Aset, Kekayaan Bersih, dan Total Utang saling bertumpuk di halaman Akun & Dompet mobile.",
      "Membuat ukuran nominal ringkasan akun lebih responsif dan aman untuk nilai panjang.",
      "Memastikan form transaksi manual memakai jam terkini saat submit kecuali user mengubah jam secara manual.",
    ],
  },
  {
    version: "v1.6.0",
    date: "2026-05-05",
    title: "SEO audit dan halaman publik",
    description: "Halaman publik BudgetIn diperkuat untuk crawlability, metadata sharing, trust signal, dan aksesibilitas berdasarkan audit SquirrelScan.",
    type: "release",
    githubUrl: `${githubRepositoryUrl}/tree/v1.6.0`,
    changes: [
      "Menambahkan robots.txt dan sitemap.xml untuk halaman publik BudgetIn.",
      "Memperkuat metadata SEO global, canonical URL, Open Graph, Twitter card, dan preview image.",
      "Menambahkan halaman Tentang dan Kontak sebagai trust pages publik.",
      "Menandai halaman auth sebagai noindex agar login/demo tidak ditargetkan SEO.",
      "Menambahkan footer publik, internal link legal/informasi, skip link, dan polish konten privacy/homepage.",
    ],
  },
  {
    version: "v1.5.0",
    date: "2026-05-05",
    title: "Jam transaksi end-to-end",
    description: "Transaksi sekarang menyimpan tanggal dan jam terpisah, bisa diinput manual, diedit, ditampilkan, diurutkan, serta dipahami dari prompt AI.",
    type: "release",
    githubUrl: `${githubRepositoryUrl}/tree/v1.5.0`,
    changes: [
      "Menambahkan input jam di form transaksi manual dan modal edit transaksi.",
      "Menampilkan jam transaksi di daftar transaksi serta mengurutkan riwayat berdasarkan tanggal dan jam.",
      "Menambahkan field time di database dan kolom time di Google Sheets Transaksi kolom L tanpa menggeser kolom lama.",
      "Membuat AI prompt memahami waktu seperti jam 14:30, jam 2 siang, tadi pagi, sore, malam, dan semalam.",
      "Memastikan backup/restore, calendar, account detail, dan bill payment kompatibel dengan jam transaksi.",
    ],
  },
  {
    version: "v1.4.0",
    date: "2026-05-05",
    title: "Reset data dan delete account di Settings",
    description: "User sekarang bisa mereset data, mereset setup akun, dan menghapus akun langsung dari halaman Settings dengan konfirmasi eksplisit.",
    type: "release",
    changes: [
      "Menambahkan halaman Akun & Data untuk reset data finansial, reset setup akun, dan delete account.",
      "Mengosongkan data Google Sheets untuk user Sheets tanpa menghapus file Drive.",
      "Menambahkan proteksi confirmation text sebelum aksi destruktif diproses server.",
      "Menyiapkan ulang kategori dan tipe akun default setelah reset data.",
    ],
  },
  {
    version: "v1.3.1",
    date: "2026-05-05",
    title: "Perbaikan Google Sheets setup lock",
    description: "Dashboard tidak lagi terkunci di layar migrasi fallback saat data Google Sheets sudah sesuai.",
    type: "fix",
    changes: [
      "Menambahkan opsi untuk menandai Google Sheets setup selesai tanpa restore data.",
      "Mempertahankan blokir migrasi otomatis saat target Sheets sudah berisi data agar tidak terjadi duplikasi.",
      "Membuka kembali akses dashboard untuk akun Google yang sudah memiliki data Sheets valid.",
    ],
  },
  {
    version: "v1.3.0",
    date: "2026-05-05",
    title: "Backup Restore dan Google Permission Migration",
    description: "BudgetIn sekarang mendukung backup/restore lintas storage serta recovery akun Google yang perlu permission Sheets dan Drive.",
    type: "release",
    githubUrl: `${githubRepositoryUrl}/commit/0f5e78e`,
    changes: [
      "Menambahkan Backup & Restore JSON untuk migrasi data Database dan Google Sheets.",
      "Mendukung restore Database ke Database, Database ke Google Sheets, Google Sheets ke Database, dan Google Sheets ke Google Sheets.",
      "Memblok partial consent Google agar akun baru tidak masuk ke fallback database diam-diam.",
      "Menambahkan recovery flow untuk akun Google yang perlu reconnect permission Sheets dan Drive.",
      "Menambahkan preview dan eksekusi migrasi data fallback ke Google Sheets dengan marker idempotency.",
      "Menampilkan status Google setup required di admin panel agar issue setup lebih mudah dipantau.",
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-05-05",
    title: "Production changelog untuk user",
    description: "User sekarang bisa melihat daftar update production langsung dari dashboard BudgetIn.",
    type: "release",
    changes: [
      "Menambahkan halaman update/changelog yang bisa diakses user dari dashboard.",
      "Menampilkan ringkasan perubahan production dengan versi, tanggal, dan referensi GitHub.",
      "Menyiapkan alur version control berbasis Semantic Versioning untuk rilis berikutnya.",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-05-05",
    title: "Login demo lebih stabil",
    description: "Perbaikan pada pengalaman akses demo agar proses login tidak mudah timeout.",
    type: "fix",
    githubUrl: `${githubRepositoryUrl}/commit/9a58ffb`,
    changes: [
      "Menangani timeout pada demo login di halaman autentikasi.",
      "Membuat akses demo lebih konsisten untuk user yang mencoba BudgetIn pertama kali.",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-05-05",
    title: "Akses akun demo dari homepage",
    description: "User baru dapat mencoba BudgetIn lebih cepat melalui akses demo dari halaman utama.",
    type: "improvement",
    githubUrl: `${githubRepositoryUrl}/commit/df67fc1`,
    changes: [
      "Menambahkan akses akun demo dari homepage.",
      "Mempercepat onboarding user yang ingin melihat fitur BudgetIn tanpa setup awal penuh.",
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-05-05",
    title: "Admin panel command center",
    description: "Panel admin diperbarui untuk memantau user, status data, dan metrik operasional dengan lebih jelas.",
    type: "improvement",
    githubUrl: `${githubRepositoryUrl}/commit/b046703`,
    changes: [
      "Menambahkan KPI user, status verifikasi, mode data, dan metrik aktivitas.",
      "Menyediakan tabel user dengan pencarian, filter, sorting, dan pagination.",
      "Merapikan tampilan admin agar lebih siap untuk operasional production.",
    ],
  },
];

export function getLatestChangelogItem() {
  return changelogItems[0];
}
