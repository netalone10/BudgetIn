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
