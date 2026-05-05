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
