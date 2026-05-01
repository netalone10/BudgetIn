import { computeAccountBalancesFromTx } from "@/utils/sheets-ledger";

type Tx = {
  type: "expense" | "income";
  amount: number;
  fromAccountId?: string;
  toAccountId?: string;
};

const ASSET = { id: "A1", classification: "asset" };
const ASSET2 = { id: "A2", classification: "asset" };
const LIAB = { id: "L1", classification: "liability" };

describe("computeAccountBalancesFromTx", () => {
  test("akun tanpa transaksi → saldo 0", () => {
    const r = computeAccountBalancesFromTx([ASSET], []);
    expect(r.get("A1")).toBe(0);
  });

  test("Saldo Awal asset (income, to=acc) → +amount", () => {
    const txs: Tx[] = [{ type: "income", amount: 1_000_000, toAccountId: "A1" }];
    const r = computeAccountBalancesFromTx([ASSET], txs);
    expect(r.get("A1")).toBe(1_000_000);
  });

  test("Saldo Awal liability (expense, from=acc) → +amount pada liability", () => {
    const txs: Tx[] = [{ type: "expense", amount: 500_000, fromAccountId: "L1" }];
    const r = computeAccountBalancesFromTx([LIAB], txs);
    expect(r.get("L1")).toBe(500_000);
  });

  test("expense biasa pada asset → −amount", () => {
    const txs: Tx[] = [
      { type: "income", amount: 1_000_000, toAccountId: "A1" }, // saldo awal
      { type: "expense", amount: 200_000, fromAccountId: "A1" },
    ];
    const r = computeAccountBalancesFromTx([ASSET], txs);
    expect(r.get("A1")).toBe(800_000);
  });

  test("income (gajian) pada asset → +amount", () => {
    const txs: Tx[] = [{ type: "income", amount: 8_000_000, toAccountId: "A1" }];
    const r = computeAccountBalancesFromTx([ASSET], txs);
    expect(r.get("A1")).toBe(8_000_000);
  });

  test("expense (pakai kartu kredit) pada liability → +amount (debt grows)", () => {
    const txs: Tx[] = [{ type: "expense", amount: 250_000, fromAccountId: "L1" }];
    const r = computeAccountBalancesFromTx([LIAB], txs);
    expect(r.get("L1")).toBe(250_000);
  });

  test("income (bayar kartu kredit) pada liability → −amount (debt shrinks)", () => {
    const txs: Tx[] = [
      { type: "expense", amount: 1_000_000, fromAccountId: "L1" }, // belanja pakai kartu
      { type: "income", amount: 600_000, toAccountId: "L1" }, // bayar tagihan
    ];
    const r = computeAccountBalancesFromTx([LIAB], txs);
    expect(r.get("L1")).toBe(400_000);
  });

  test("transfer asset→asset (1 row expense, both from+to) → from −, to + (net 0)", () => {
    const txs: Tx[] = [
      { type: "income", amount: 5_000_000, toAccountId: "A1" }, // saldo awal A1
      { type: "expense", amount: 1_500_000, fromAccountId: "A1", toAccountId: "A2" }, // transfer
    ];
    const r = computeAccountBalancesFromTx([ASSET, ASSET2], txs);
    expect(r.get("A1")).toBe(3_500_000);
    expect(r.get("A2")).toBe(1_500_000);
  });

  test("transfer asset→liability (bayar kartu) → asset −, liability − (debt drops)", () => {
    const txs: Tx[] = [
      { type: "income", amount: 5_000_000, toAccountId: "A1" }, // saldo bank
      { type: "expense", amount: 1_000_000, fromAccountId: "L1" }, // belanja kartu
      { type: "expense", amount: 1_000_000, fromAccountId: "A1", toAccountId: "L1" }, // bayar
    ];
    const r = computeAccountBalancesFromTx([ASSET, LIAB], txs);
    expect(r.get("A1")).toBe(4_000_000);
    expect(r.get("L1")).toBe(0);
  });

  test("transaksi dengan accountId tidak dikenal diabaikan", () => {
    const txs: Tx[] = [
      { type: "income", amount: 1_000_000, toAccountId: "GHOST" },
      { type: "income", amount: 500_000, toAccountId: "A1" },
    ];
    const r = computeAccountBalancesFromTx([ASSET], txs);
    expect(r.get("A1")).toBe(500_000);
    expect(r.has("GHOST")).toBe(false);
  });

  test("amount tidak valid (0/NaN) diskip", () => {
    const txs: Tx[] = [
      { type: "income", amount: 0, toAccountId: "A1" },
      { type: "income", amount: NaN, toAccountId: "A1" },
      { type: "income", amount: 100, toAccountId: "A1" },
    ];
    const r = computeAccountBalancesFromTx([ASSET], txs);
    expect(r.get("A1")).toBe(100);
  });

  test("expense negatif pada asset → saldo bertambah sebagai koreksi/refund beban", () => {
    const txs: Tx[] = [
      { type: "expense", amount: 200_000, fromAccountId: "A1" },
      { type: "expense", amount: -50_000, fromAccountId: "A1" },
    ];
    const r = computeAccountBalancesFromTx([ASSET], txs);
    expect(r.get("A1")).toBe(-150_000);
  });

  test("income negatif pada asset → saldo berkurang sebagai koreksi pendapatan", () => {
    const txs: Tx[] = [
      { type: "income", amount: 1_000_000, toAccountId: "A1" },
      { type: "income", amount: -100_000, toAccountId: "A1" },
    ];
    const r = computeAccountBalancesFromTx([ASSET], txs);
    expect(r.get("A1")).toBe(900_000);
  });
});
