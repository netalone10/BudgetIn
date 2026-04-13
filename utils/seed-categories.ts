import { prisma } from "@/lib/prisma";

// Kategori default yang langsung tersedia untuk semua user baru
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Makan",
  "Transport",
  "Tagihan",
  "Kesehatan",
  "Hiburan",
  "Belanja",
  "Pendidikan",
  "Lain-Lain",
];

export const DEFAULT_INCOME_CATEGORIES = [
  "Gaji",
  "Freelance",
  "Bonus",
  "Investasi",
  "Bisnis",
  "THR",
  "Dividen",
  "Lainnya",
];

export const ALL_DEFAULT_CATEGORIES = [
  ...DEFAULT_INCOME_CATEGORIES,
  ...DEFAULT_EXPENSE_CATEGORIES,
];

/**
 * Seed kategori default untuk user baru.
 * Aman dipanggil berkali-kali — pakai upsert (skip kalau sudah ada).
 */
export async function seedDefaultCategories(userId: string): Promise<void> {
  const expenseData = DEFAULT_EXPENSE_CATEGORIES.map((name) => ({
    userId,
    name,
    type: "expense",
  }));
  const incomeData = DEFAULT_INCOME_CATEGORIES.map((name) => ({
    userId,
    name,
    type: "income",
  }));

  await prisma.category.createMany({
    data: [...expenseData, ...incomeData],
    skipDuplicates: true,
  });
}
