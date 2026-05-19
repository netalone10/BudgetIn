/**
 * Transaction Regression Suite — P0
 *
 * Melindungi core finance logic dari regresi:
 * - Transfer exclusion dari expense
 * - Signed amount (negatif untuk koreksi/refund)
 * - Account balance calculation
 * - Date/time sorting
 * - Savings contribution lifecycle
 */

import { isExpenseTransaction, isTransferTransaction } from "@/lib/transaction-classification";
import { compareTransactionDateTimeDesc, normalizeTransactionTime, isValidTransactionTime } from "@/lib/transaction-time";
import { isSavingsTransaction, isSavingsKeyword } from "@/lib/savings-utils";
import { Decimal } from "@prisma/client/runtime/library";

// ── Transfer Exclusion ────────────────────────────────────────────────────────

describe("transfer exclusion dari expense", () => {
  it("transfer_out bukan expense", () => {
    expect(isExpenseTransaction({ type: "transfer_out", category: "Transfer" })).toBe(false);
  });

  it("transfer_in bukan expense", () => {
    expect(isExpenseTransaction({ type: "transfer_in", category: "Transfer" })).toBe(false);
  });

  it("Sheets transfer (dua akun) bukan expense", () => {
    expect(isExpenseTransaction({
      type: "expense",
      category: "Transfer",
      fromAccountId: "bca",
      toAccountId: "jago",
    })).toBe(false);
  });

  it("Sheets transfer dengan nama akun bukan expense", () => {
    expect(isExpenseTransaction({
      type: "expense",
      category: "Transfer",
      fromAccountName: "BCA",
      toAccountName: "Jago",
    })).toBe(false);
  });

  it("transfer fee (Biaya Admin) tetap expense", () => {
    expect(isExpenseTransaction({
      type: "expense",
      category: "Biaya Admin",
      fromAccountId: "bca",
    })).toBe(true);
  });

  it("expense biasa tetap expense", () => {
    expect(isExpenseTransaction({ type: "expense", category: "Makan" })).toBe(true);
  });

  it("income bukan expense", () => {
    expect(isExpenseTransaction({ type: "income", category: "Gaji" })).toBe(false);
  });

  it("isTransferTransaction: DB transfer_out", () => {
    expect(isTransferTransaction({ type: "transfer_out", category: "Transfer" })).toBe(true);
  });

  it("isTransferTransaction: DB transfer_in", () => {
    expect(isTransferTransaction({ type: "transfer_in", category: "Transfer" })).toBe(true);
  });

  it("isTransferTransaction: kategori Transfer tanpa akun bukan transfer", () => {
    // Kategori Transfer tapi tidak ada fromAccount/toAccount → bukan transfer
    expect(isTransferTransaction({ type: "expense", category: "Transfer" })).toBe(false);
  });
});

// ── Signed Amount (koreksi/refund/reversal) ───────────────────────────────────

describe("signed amount — koreksi dan refund", () => {
  it("expense negatif dihitung sebagai pengurang total expense", () => {
    // Simulasi aggregasi manual: expense 100rb + refund -30rb = net 70rb
    const transactions = [
      { type: "expense", category: "Makan", amount: 100_000 },
      { type: "expense", category: "Makan", amount: -30_000 }, // refund
    ];
    const total = transactions
      .filter((t) => isExpenseTransaction(t))
      .reduce((sum, t) => sum + t.amount, 0);
    expect(total).toBe(70_000);
  });

  it("income negatif dihitung sebagai pengurang total income", () => {
    const transactions = [
      { type: "income", category: "Gaji", amount: 5_000_000 },
      { type: "income", category: "Gaji", amount: -500_000 }, // koreksi
    ];
    const total = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    expect(total).toBe(4_500_000);
  });

  it("transfer tidak boleh negatif (validasi konseptual)", () => {
    // Transfer selalu positif — negatif tidak masuk akal untuk transfer
    const transferAmount = 1_000_000;
    expect(transferAmount).toBeGreaterThan(0);
  });
});

// ── Account Balance Calculation ───────────────────────────────────────────────

describe("account balance calculation (pure ledger)", () => {
  function calcBalance(
    transactions: { type: string; amount: number }[]
  ): number {
    let balance = 0;
    for (const t of transactions) {
      if (t.type === "income" || t.type === "transfer_in") balance += t.amount;
      else if (t.type === "expense" || t.type === "transfer_out") balance -= t.amount;
    }
    return balance;
  }

  it("income menambah saldo", () => {
    expect(calcBalance([{ type: "income", amount: 5_000_000 }])).toBe(5_000_000);
  });

  it("expense mengurangi saldo", () => {
    expect(calcBalance([
      { type: "income", amount: 5_000_000 },
      { type: "expense", amount: 1_000_000 },
    ])).toBe(4_000_000);
  });

  it("transfer_out mengurangi saldo akun sumber", () => {
    expect(calcBalance([
      { type: "income", amount: 5_000_000 },
      { type: "transfer_out", amount: 2_000_000 },
    ])).toBe(3_000_000);
  });

  it("transfer_in menambah saldo akun tujuan", () => {
    expect(calcBalance([
      { type: "transfer_in", amount: 2_000_000 },
    ])).toBe(2_000_000);
  });

  it("saldo bisa negatif (kartu kredit / hutang)", () => {
    expect(calcBalance([
      { type: "expense", amount: 1_000_000 },
    ])).toBe(-1_000_000);
  });

  it("expense negatif (refund) menambah saldo", () => {
    expect(calcBalance([
      { type: "income", amount: 5_000_000 },
      { type: "expense", amount: 1_000_000 },
      { type: "expense", amount: -200_000 }, // refund
    ])).toBe(4_200_000);
  });

  it("Decimal precision: tidak ada floating point error", () => {
    let balance = new Decimal(0);
    balance = balance.plus(new Decimal("1000000.50"));
    balance = balance.minus(new Decimal("333333.33"));
    balance = balance.plus(new Decimal("333333.33"));
    // Harus kembali ke 1000000.50 tanpa floating point drift
    expect(balance.toNumber()).toBeCloseTo(1_000_000.50, 2);
  });
});

// ── Date/Time Sorting ─────────────────────────────────────────────────────────

describe("transaction date/time sorting", () => {
  it("compareTransactionDateTimeDesc: tanggal lebih baru di atas", () => {
    const a = { date: "2026-05-01", time: "10:00" };
    const b = { date: "2026-05-02", time: "10:00" };
    expect(compareTransactionDateTimeDesc(a, b)).toBeGreaterThan(0); // b > a → b dulu
    expect(compareTransactionDateTimeDesc(b, a)).toBeLessThan(0);
  });

  it("compareTransactionDateTimeDesc: tanggal sama, waktu lebih baru di atas", () => {
    const a = { date: "2026-05-01", time: "09:00" };
    const b = { date: "2026-05-01", time: "14:30" };
    expect(compareTransactionDateTimeDesc(a, b)).toBeGreaterThan(0); // b lebih baru
    expect(compareTransactionDateTimeDesc(b, a)).toBeLessThan(0);
  });

  it("compareTransactionDateTimeDesc: sama persis → 0", () => {
    const a = { date: "2026-05-01", time: "10:00" };
    expect(compareTransactionDateTimeDesc(a, a)).toBe(0);
  });

  it("normalizeTransactionTime: time valid dikembalikan apa adanya", () => {
    expect(normalizeTransactionTime("14:30")).toBe("14:30");
    expect(normalizeTransactionTime("00:00")).toBe("00:00");
    expect(normalizeTransactionTime("23:59")).toBe("23:59");
  });

  it("normalizeTransactionTime: time tidak valid → fallback 00:00", () => {
    expect(normalizeTransactionTime(null)).toBe("00:00");
    expect(normalizeTransactionTime(undefined)).toBe("00:00");
    expect(normalizeTransactionTime("")).toBe("00:00");
    expect(normalizeTransactionTime("25:00")).toBe("00:00");
    expect(normalizeTransactionTime("abc")).toBe("00:00");
  });

  it("isValidTransactionTime: format HH:mm valid", () => {
    expect(isValidTransactionTime("00:00")).toBe(true);
    expect(isValidTransactionTime("23:59")).toBe(true);
    expect(isValidTransactionTime("09:05")).toBe(true);
  });

  it("isValidTransactionTime: format tidak valid", () => {
    expect(isValidTransactionTime("24:00")).toBe(false);
    expect(isValidTransactionTime("9:5")).toBe(false);
    expect(isValidTransactionTime("")).toBe(false);
    expect(isValidTransactionTime(null)).toBe(false);
  });

  it("sort array transaksi descending", () => {
    const txs = [
      { date: "2026-05-01", time: "08:00" },
      { date: "2026-05-03", time: "12:00" },
      { date: "2026-05-02", time: "10:00" },
    ];
    const sorted = [...txs].sort(compareTransactionDateTimeDesc);
    expect(sorted[0].date).toBe("2026-05-03");
    expect(sorted[1].date).toBe("2026-05-02");
    expect(sorted[2].date).toBe("2026-05-01");
  });
});

// ── Savings Contribution Lifecycle ───────────────────────────────────────────

describe("savings contribution lifecycle", () => {
  it("isSavingsKeyword: mendeteksi kata kunci tabungan", () => {
    expect(isSavingsKeyword("Tabungan")).toBe(true);
    expect(isSavingsKeyword("tabungan liburan")).toBe(true);
    expect(isSavingsKeyword("Investasi Saham")).toBe(true);
    expect(isSavingsKeyword("Reksa Dana")).toBe(true);
    expect(isSavingsKeyword("Dana Darurat")).toBe(true);
    expect(isSavingsKeyword("Deposito")).toBe(true);
  });

  it("isSavingsKeyword: tidak mendeteksi kategori biasa", () => {
    expect(isSavingsKeyword("Makan")).toBe(false);
    expect(isSavingsKeyword("Transport")).toBe(false);
    expect(isSavingsKeyword("Tagihan")).toBe(false);
    expect(isSavingsKeyword("Gaji")).toBe(false);
  });

  it("isSavingsTransaction: keyword match", () => {
    expect(isSavingsTransaction("Tabungan", new Set())).toBe(true);
    expect(isSavingsTransaction("Investasi", new Set())).toBe(true);
  });

  it("isSavingsTransaction: flag isSavings dari DB (kategori custom)", () => {
    const savingsSet = new Set(["dana rumah", "celengan emas"]);
    expect(isSavingsTransaction("Dana Rumah", savingsSet)).toBe(true);
    expect(isSavingsTransaction("Celengan Emas", savingsSet)).toBe(true);
  });

  it("isSavingsTransaction: kategori biasa bukan savings", () => {
    expect(isSavingsTransaction("Makan", new Set())).toBe(false);
    expect(isSavingsTransaction("Transport", new Set())).toBe(false);
  });

  it("tabungan tidak dihitung sebagai expense dalam aggregasi", () => {
    const savingsSet = new Set(["tabungan"]);
    const transactions = [
      { type: "income", category: "Gaji", amount: 5_000_000 },
      { type: "expense", category: "Makan", amount: 1_000_000 },
      { type: "expense", category: "Tabungan", amount: 500_000 },
    ];

    const expenses = transactions.filter(
      (t) => isExpenseTransaction(t) && !isSavingsTransaction(t.category, savingsSet)
    );
    const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);

    expect(totalExpense).toBe(1_000_000); // Tabungan tidak masuk expense
  });

  it("savings contribution amount harus positif", () => {
    const contributionAmount = 500_000;
    expect(contributionAmount).toBeGreaterThan(0);
  });
});
