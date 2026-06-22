import { computeSafeToSpend, type SafeToSpendInput } from "@/lib/safe-to-spend";

describe("computeSafeToSpend", () => {
  // Acuan: 10 Juni 2026 (bulan Juni = 30 hari) → sisa 21 hari (10..30 inklusif).
  const now = new Date(2026, 5, 10); // month index 5 = Juni

  it("membagi sisa budget variable rata ke hari tersisa (termasuk hari ini)", () => {
    const budgets: SafeToSpendInput[] = [
      { category: "Makan", budget: 3_000_000, spent: 1_000_000, budgetType: "variable" },
    ];
    const r = computeSafeToSpend(budgets, "2026-06", now);
    expect(r.isCurrentMonth).toBe(true);
    expect(r.daysLeft).toBe(21);
    expect(r.remaining).toBe(2_000_000);
    expect(r.perDay).toBeCloseTo(2_000_000 / 21);
    expect(r.depleted).toBe(false);
    expect(r.hasBudget).toBe(true);
  });

  it("mengabaikan kategori fixed (komitmen lump-sum) dari hitungan harian", () => {
    const budgets: SafeToSpendInput[] = [
      { category: "Kos", budget: 2_000_000, spent: 2_000_000, budgetType: "fixed" },
      { category: "Jajan", budget: 1_000_000, spent: 0, budgetType: "variable" },
    ];
    const r = computeSafeToSpend(budgets, "2026-06", now);
    expect(r.variableBudget).toBe(1_000_000);
    expect(r.variableSpent).toBe(0);
    expect(r.remaining).toBe(1_000_000);
  });

  it("memakai rollover sebagai bagian effective budget", () => {
    const budgets: SafeToSpendInput[] = [
      { category: "Makan", budget: 1_000_000, spent: 0, rollover: 500_000, budgetType: "variable" },
    ];
    const r = computeSafeToSpend(budgets, "2026-06", now);
    expect(r.variableBudget).toBe(1_500_000);
    expect(r.remaining).toBe(1_500_000);
  });

  it("menandai depleted dan perDay 0 saat sisa habis/over", () => {
    const budgets: SafeToSpendInput[] = [
      { category: "Makan", budget: 1_000_000, spent: 1_200_000, budgetType: "variable" },
    ];
    const r = computeSafeToSpend(budgets, "2026-06", now);
    expect(r.remaining).toBe(-200_000);
    expect(r.depleted).toBe(true);
    expect(r.perDay).toBe(0);
  });

  it("hasBudget false saat tidak ada kategori variable berbudget", () => {
    const budgets: SafeToSpendInput[] = [
      { category: "Kos", budget: 2_000_000, spent: 0, budgetType: "fixed" },
    ];
    const r = computeSafeToSpend(budgets, "2026-06", now);
    expect(r.hasBudget).toBe(false);
  });

  it("isCurrentMonth false untuk bulan lampau dan daysLeft jatuh ke totalDays", () => {
    const r = computeSafeToSpend(
      [{ category: "Makan", budget: 1_000_000, spent: 0, budgetType: "variable" }],
      "2026-05", // Mei, sedangkan now Juni
      now
    );
    expect(r.isCurrentMonth).toBe(false);
    expect(r.totalDays).toBe(31); // Mei 31 hari
    expect(r.daysLeft).toBe(31);
    expect(r.dayOfMonth).toBe(0);
  });

  it("pada hari terakhir bulan, daysLeft = 1 (sisa untuk hari ini)", () => {
    const lastDay = new Date(2026, 5, 30); // 30 Juni
    const r = computeSafeToSpend(
      [{ category: "Makan", budget: 2_100_000, spent: 0, budgetType: "variable" }],
      "2026-06",
      lastDay
    );
    expect(r.daysLeft).toBe(1);
    expect(r.perDay).toBe(2_100_000);
  });

  it("menebak fixed/variable dari nama kategori saat budgetType tidak diset", () => {
    const budgets: SafeToSpendInput[] = [
      { category: "Cicilan motor", budget: 1_000_000, spent: 0 }, // 'cicilan' → fixed
      { category: "Hiburan", budget: 500_000, spent: 0 }, // → variable
    ];
    const r = computeSafeToSpend(budgets, "2026-06", now);
    expect(r.variableBudget).toBe(500_000);
  });
});
