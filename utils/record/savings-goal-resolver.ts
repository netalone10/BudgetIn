import { isSavingsKeyword } from "@/lib/savings-utils";

export interface RuntimeSavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
}

export interface SavingsGoalOption {
  id: string;
  label: string;
  description: string;
}

export type SavingsGoalResolution =
  | { kind: "not_savings" }
  | { kind: "unallocated"; category: string }
  | { kind: "resolved"; goal: RuntimeSavingsGoal; category: string }
  | {
      kind: "ambiguous";
      clarification: string;
      clarificationType: "savings_goal_selection";
      pendingAction: {
        type: "savings_contribution";
        amount: number;
        accountName: string;
        date: string;
        category: string;
        note: string;
      };
      options: SavingsGoalOption[];
    };

function normalizeText(value: string): string {
  return value.toLocaleLowerCase("id-ID").replace(/\s+/g, " ").trim();
}

function formatIDR(amount: number): string {
  return `Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
}

export function isSavingsPrompt(prompt: string, category?: string): boolean {
  return isSavingsKeyword(prompt) || (!!category && isSavingsKeyword(category));
}

export function normalizeSavingsCategory(prompt: string, category?: string): string {
  if (category && isSavingsKeyword(category)) return category;
  if (isSavingsKeyword(prompt)) return "Tabungan";
  return category?.trim() || "Tabungan";
}

export function resolveSavingsGoalForPrompt({
  prompt,
  category,
  goals,
  amount,
  accountName,
  date,
  note,
}: {
  prompt: string;
  category?: string;
  goals: RuntimeSavingsGoal[];
  amount: number;
  accountName: string;
  date: string;
  note: string;
}): SavingsGoalResolution {
  if (!isSavingsPrompt(prompt, category)) return { kind: "not_savings" };

  const resolvedCategory = normalizeSavingsCategory(prompt, category);
  if (goals.length === 0) return { kind: "unallocated", category: resolvedCategory };
  if (goals.length === 1) return { kind: "resolved", goal: goals[0], category: resolvedCategory };

  const normalizedPrompt = normalizeText(prompt);
  const matches = goals.filter((goal) => {
    const normalizedName = normalizeText(goal.name);
    if (normalizedPrompt.includes(normalizedName)) return true;
    const distinctiveTokens = normalizedName
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4 && !["dana", "goal", "tabungan", "savings"].includes(token));
    return distinctiveTokens.length > 0 && distinctiveTokens.some((token) => normalizedPrompt.includes(token));
  });

  if (matches.length === 1) {
    return { kind: "resolved", goal: matches[0], category: resolvedCategory };
  }

  const options = goals.map((goal) => ({
    id: goal.id,
    label: goal.name,
    description: `Target ${formatIDR(goal.targetAmount)}`,
  }));
  const accountPart = accountName ? ` dari ${accountName}` : "";

  return {
    kind: "ambiguous",
    clarification: `Kamu punya beberapa goal tabungan. ${formatIDR(amount)}${accountPart} mau dialokasikan ke mana?`,
    clarificationType: "savings_goal_selection",
    pendingAction: {
      type: "savings_contribution",
      amount,
      accountName,
      date,
      category: resolvedCategory,
      note: prompt || note,
    },
    options,
  };
}
