import { isSavingsPrompt, normalizeSavingsCategory, resolveSavingsGoalForPrompt } from "@/utils/record/savings-goal-resolver";

const base = {
  amount: 500_000,
  accountName: "BCA",
  date: "2026-05-03",
  note: "nabung 500rb dari BCA",
};

describe("savings goal resolver", () => {
  it("auto allocates a savings prompt when there is exactly one goal", () => {
    const result = resolveSavingsGoalForPrompt({
      ...base,
      prompt: "nabung 500rb dari BCA",
      category: "Tabungan",
      goals: [{ id: "goal_1", name: "Dana Darurat", targetAmount: 10_000_000 }],
    });

    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.goal.id).toBe("goal_1");
      expect(result.category).toBe("Tabungan");
    }
  });

  it("returns a clarification for ambiguous multi-goal savings prompts", () => {
    const result = resolveSavingsGoalForPrompt({
      ...base,
      prompt: "nabung 500rb dari BCA",
      category: "Tabungan",
      goals: [
        { id: "goal_1", name: "Dana Darurat", targetAmount: 10_000_000 },
        { id: "goal_2", name: "Liburan", targetAmount: 5_000_000 },
      ],
    });

    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.clarificationType).toBe("savings_goal_selection");
      expect(result.pendingAction.type).toBe("savings_contribution");
      expect(result.pendingAction.category).toBe("Tabungan");
      expect(result.options).toEqual([
        { id: "goal_1", label: "Dana Darurat", description: "Target Rp 10.000.000" },
        { id: "goal_2", label: "Liburan", description: "Target Rp 5.000.000" },
      ]);
    }
  });

  it("allocates to the named goal only when prompt mentions a goal", () => {
    const result = resolveSavingsGoalForPrompt({
      ...base,
      prompt: "nabung 500rb ke Dana Darurat dari BCA",
      category: "Tabungan",
      goals: [
        { id: "goal_1", name: "Dana Darurat", targetAmount: 10_000_000 },
        { id: "goal_2", name: "Liburan", targetAmount: 5_000_000 },
      ],
    });

    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.goal.id).toBe("goal_1");
    }
  });

  it("detects savings prompts and normalizes category away from Lain-lain", () => {
    expect(isSavingsPrompt("nabung 500rb", "Lain-lain")).toBe(true);
    expect(normalizeSavingsCategory("nabung 500rb", "Lain-lain")).toBe("Tabungan");
  });
});
