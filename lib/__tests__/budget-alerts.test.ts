import {
  computeBudgetAlerts,
  BUDGET_WARN_THRESHOLD,
  type BudgetAlertInput,
} from "@/lib/budget-alerts";

describe("computeBudgetAlerts", () => {
  it("returns no alerts when all categories are below the warn threshold", () => {
    const budgets: BudgetAlertInput[] = [
      { category: "Makan", budget: 1_000_000, spent: 500_000 },
      { category: "Transport", budget: 600_000, spent: 100_000 },
    ];
    expect(computeBudgetAlerts(budgets)).toEqual([]);
  });

  it("flags a category at/above 80% as warn", () => {
    const alerts = computeBudgetAlerts([
      { category: "Makan", budget: 1_000_000, spent: 800_000 },
    ]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ category: "Makan", level: "warn", ratio: 0.8 });
  });

  it("flags a category at/above 100% as over", () => {
    const alerts = computeBudgetAlerts([
      { category: "Kopi", budget: 300_000, spent: 354_000 },
    ]);
    expect(alerts[0].level).toBe("over");
    expect(alerts[0].ratio).toBeCloseTo(1.18);
  });

  it("uses effective budget (budget + rollover)", () => {
    // spent 1.0jt vs budget 1.0jt = 100% (over), tapi dengan rollover 500rb
    // effective = 1.5jt → 66% → tidak ada alert.
    const alerts = computeBudgetAlerts([
      { category: "Makan", budget: 1_000_000, spent: 1_000_000, rollover: 500_000 },
    ]);
    expect(alerts).toEqual([]);
  });

  it("skips categories with no effective budget", () => {
    expect(
      computeBudgetAlerts([{ category: "Lain", budget: 0, spent: 50_000 }])
    ).toEqual([]);
    expect(
      computeBudgetAlerts([{ category: "Lain", budget: 0, spent: 0, rollover: 0 }])
    ).toEqual([]);
  });

  it("does not flag negative/zero spending", () => {
    expect(
      computeBudgetAlerts([{ category: "Refund", budget: 500_000, spent: -100_000 }])
    ).toEqual([]);
  });

  it("sorts most critical (highest ratio) first", () => {
    const alerts = computeBudgetAlerts([
      { category: "A", budget: 100, spent: 85 }, // 0.85 warn
      { category: "B", budget: 100, spent: 150 }, // 1.5 over
      { category: "C", budget: 100, spent: 95 }, // 0.95 warn
    ]);
    expect(alerts.map((a) => a.category)).toEqual(["B", "C", "A"]);
  });

  it("respects a custom warn threshold", () => {
    const budgets: BudgetAlertInput[] = [{ category: "Makan", budget: 1000, spent: 700 }];
    expect(computeBudgetAlerts(budgets)).toEqual([]); // 70% < 80% default
    expect(computeBudgetAlerts(budgets, 0.7)).toHaveLength(1); // 70% >= 0.7
  });

  it("exposes the default warn threshold as 0.8", () => {
    expect(BUDGET_WARN_THRESHOLD).toBe(0.8);
  });

  it("returns empty for empty input", () => {
    expect(computeBudgetAlerts([])).toEqual([]);
  });
});
