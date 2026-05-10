import {
  computeAnalystMetrics,
  computeCashflowScore,
  computeSavingsRates,
  type AnalystTransactionLike,
} from "@/lib/analyst-metrics";

function tx(partial: Partial<AnalystTransactionLike>): AnalystTransactionLike {
  return {
    date: "2026-05-01",
    category: "Makan",
    amount: 0,
    type: "expense",
    ...partial,
  };
}

describe("computeAnalystMetrics", () => {
  it("memisahkan tabungan dari expense via keyword (tanpa flag isSavings)", () => {
    const m = computeAnalystMetrics(
      [
        tx({ type: "income", category: "Gaji", amount: 5_000_000 }),
        tx({ type: "expense", category: "Makan", amount: 1_500_000 }),
        tx({ type: "expense", category: "Tabungan", amount: 1_000_000 }),
        tx({ type: "expense", category: "Investasi Saham", amount: 500_000 }),
      ],
      new Set()
    );
    expect(m.totalIncome).toBe(5_000_000);
    expect(m.totalSpent).toBe(1_500_000); // tabungan & investasi excluded
    expect(m.totalSavings).toBe(1_500_000);
    expect(m.spentByCategory).toEqual({ Makan: 1_500_000 });
    expect(Object.keys(m.savingsByCategory).sort()).toEqual(["Investasi Saham", "Tabungan"]);
  });

  it("memisahkan tabungan via flag isSavings (kategori custom user)", () => {
    const m = computeAnalystMetrics(
      [
        tx({ type: "income", category: "Gaji", amount: 5_000_000 }),
        tx({ type: "expense", category: "Dana Rumah", amount: 750_000 }),
        tx({ type: "expense", category: "Makan", amount: 250_000 }),
      ],
      new Set(["dana rumah"])
    );
    expect(m.totalSavings).toBe(750_000);
    expect(m.totalSpent).toBe(250_000);
    expect(m.spentByCategory["Dana Rumah"]).toBeUndefined();
  });

  it("Saldo Awal di-skip seluruhnya", () => {
    const m = computeAnalystMetrics(
      [
        tx({ type: "income", category: "Saldo Awal", amount: 10_000_000 }),
        tx({ type: "expense", category: "Saldo Awal", amount: 5_000_000 }),
      ],
      new Set()
    );
    expect(m.totalIncome).toBe(0);
    expect(m.totalSpent).toBe(0);
    expect(m.totalSavings).toBe(0);
  });

  it("transfer tidak dihitung", () => {
    const m = computeAnalystMetrics(
      [
        tx({ type: "transfer_out", category: "Transfer", amount: 1_000_000, fromAccountId: "a", toAccountId: "b" }),
        tx({ type: "transfer_in", category: "Transfer", amount: 1_000_000, fromAccountId: "a", toAccountId: "b" }),
      ],
      new Set()
    );
    expect(m.totalSpent).toBe(0);
    expect(m.totalSavings).toBe(0);
  });

  it("uniqueExpenseDays menghitung hari berbeda untuk expense saja (bukan tabungan)", () => {
    const m = computeAnalystMetrics(
      [
        tx({ date: "2026-05-01", category: "Makan", amount: 50_000 }),
        tx({ date: "2026-05-02", category: "Makan", amount: 60_000 }),
        tx({ date: "2026-05-03", category: "Tabungan", amount: 1_000_000 }),
      ],
      new Set()
    );
    expect(m.uniqueExpenseDays).toBe(2);
  });
});

describe("computeCashflowScore", () => {
  it("nabung lebih banyak menaikkan score (bukan menurunkan)", () => {
    // Skenario A: income 5jt, expense 4jt (rasio 0.8 → base 40), savings 0 → bonus 0 → 40
    const a = computeCashflowScore({ totalIncome: 5_000_000, totalSpent: 4_000_000, totalSavings: 0 });
    // Skenario B: income 5jt, expense 3jt (rasio 0.6 → base 50), savings 1jt (20%) → bonus 5 → cap 50
    const b = computeCashflowScore({ totalIncome: 5_000_000, totalSpent: 3_000_000, totalSavings: 1_000_000 });
    expect(b).toBeGreaterThan(a);
  });

  it("bonus +5 ketika allocatedSavingsRate >= 10%", () => {
    // base 40 (rasio 0.8) + bonus 5 = 45
    const score = computeCashflowScore({ totalIncome: 5_000_000, totalSpent: 4_000_000, totalSavings: 600_000 });
    expect(score).toBe(45);
  });

  it("tidak ada bonus ketika alokasi < 10%", () => {
    const score = computeCashflowScore({ totalIncome: 5_000_000, totalSpent: 4_000_000, totalSavings: 100_000 });
    expect(score).toBe(40);
  });

  it("netral 25 ketika tidak ada income", () => {
    expect(computeCashflowScore({ totalIncome: 0, totalSpent: 0, totalSavings: 0 })).toBe(25);
  });
});

describe("computeSavingsRates", () => {
  it("dua rate tampil terpisah", () => {
    const r = computeSavingsRates({ totalIncome: 5_000_000, totalSpent: 2_000_000, totalSavings: 1_000_000 });
    expect(r.allocatedSavingsRate).toBeCloseTo(20);
    expect(r.netSurplusRate).toBeCloseTo(60);
  });

  it("zero income → zero rates", () => {
    const r = computeSavingsRates({ totalIncome: 0, totalSpent: 0, totalSavings: 0 });
    expect(r.allocatedSavingsRate).toBe(0);
    expect(r.netSurplusRate).toBe(0);
  });
});
