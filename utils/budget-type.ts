export type BudgetType = "fixed" | "variable";

export const FIXED_BUDGET_KEYWORDS = [
  "kos",
  "sewa",
  "arisan",
  "cicilan",
  "kredit",
  "kontrak",
  "asuransi",
  "bpjs",
  "langganan",
  "mortgage",
  "rent",
];

export function inferBudgetType(category: string): BudgetType {
  const lower = category.toLowerCase();
  return FIXED_BUDGET_KEYWORDS.some((keyword) => lower.includes(keyword)) ? "fixed" : "variable";
}

export function resolveBudgetType(category: string, budgetType?: string | null): BudgetType {
  return budgetType === "fixed" || budgetType === "variable" ? budgetType : inferBudgetType(category);
}
