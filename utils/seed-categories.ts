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
function isMissingBudgetTypeColumnError(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const maybeError = error as { code?: string; message?: string; meta?: { column?: string } };
  return (
    maybeError.code === "P2022" &&
    (maybeError.meta?.column === "budget_type" ||
      maybeError.message?.includes("budget_type") ||
      maybeError.message?.includes("Category.budgetType"))
  );
}

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
  const data = [...expenseData, ...incomeData];

  try {
    await prisma.category.createMany({
      data,
      skipDuplicates: true,
    });
  } catch (error) {
    if (!isMissingBudgetTypeColumnError(error)) throw error;
    // Fallback: production DB belum punya kolom budget_type — insert satu-per-satu via raw SQL aman tanpa kolom tsb.
    for (const row of data) {
      await prisma.$executeRaw`
        INSERT INTO categories (id, user_id, name, type)
        VALUES (gen_random_uuid(), ${row.userId}, ${row.name}, ${row.type})
        ON CONFLICT (user_id, name) DO NOTHING
      `;
    }
  }
}
