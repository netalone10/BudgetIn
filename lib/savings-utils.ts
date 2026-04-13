/**
 * Savings utility functions for detecting savings transactions.
 * Used in DashboardTabs (cashflow hybrid) and /api/savings (contribution calculation).
 */

// Keyword list untuk deteksi transaksi tabungan — variasi bahasa Indonesia
export const SAVINGS_KEYWORDS = [
  // Tabungan umum
  "tabungan", "nabung", "menabung",
  // Dana khusus
  "dana darurat", "dana pensiun", "dana pendidikan", "dana liburan",
  // Instrumen investasi
  "investasi", "deposito", "reksa dana", "reksadana", "saham",
  // Variasi lain
  "saving", "savings", "simpanan", "celengan",
];

/**
 * Checks if a category string contains any savings keyword.
 * Matching is case-insensitive.
 *
 * Validates: Requirements 2.1, 2.2
 */
export function isSavingsKeyword(category: string): boolean {
  const lower = category.toLowerCase();
  return SAVINGS_KEYWORDS.some((kw) => lower.includes(kw));
}

/**
 * Determines if a transaction is a savings transaction using OR logic:
 * - keyword match (isSavingsKeyword), OR
 * - category is in savingsCategoryNames (user-configurable isSavings flag)
 *
 * savingsCategoryNames should be pre-built from categories where isSavings = true,
 * with names lowercased for case-insensitive comparison.
 *
 * Note: For Google Sheets users, savingsCategoryNames will be an empty Set
 * since Sheets doesn't store isSavings metadata — keyword matching only.
 *
 * Validates: Requirements 2.2, 2.5
 */
export function isSavingsTransaction(
  category: string,
  savingsCategoryNames: Set<string>
): boolean {
  return isSavingsKeyword(category) || savingsCategoryNames.has(category.toLowerCase());
}
