import { summarizeFamily, type FamilyRawTxn } from "@/lib/family-data";

function tx(partial: Partial<FamilyRawTxn>): FamilyRawTxn {
  return {
    id: Math.random().toString(36).slice(2),
    ownerUserId: "u1",
    ownerName: "Suami",
    ownerDisplayRole: "Suami",
    date: "2026-06-01",
    time: "10:00",
    amount: 0,
    category: "Lainnya",
    note: "",
    type: "expense",
    accountId: "a1",
    ...partial,
  };
}

describe("summarizeFamily", () => {
  it("menjumlahkan income & expense lintas anggota", () => {
    const s = summarizeFamily([
      tx({ ownerUserId: "u1", type: "expense", amount: 100, category: "Makan" }),
      tx({ ownerUserId: "u2", ownerName: "Istri", type: "income", amount: 500 }),
      tx({ ownerUserId: "u2", ownerName: "Istri", type: "expense", amount: 50, category: "Transport" }),
    ]);
    expect(s.income).toBe(500);
    expect(s.expense).toBe(150);
    expect(s.net).toBe(350);
    expect(s.byMember).toHaveLength(2);
  });

  it("mengeliminasi pasangan transfer antar-anggota (2 kaki) dari income & expense", () => {
    const ftid = "ft-1";
    const s = summarizeFamily([
      // uang bulanan suami → istri: expense di suami + income di istri, ter-link
      tx({ ownerUserId: "u1", type: "expense", amount: 2000, category: "Transfer Keluarga", familyTransferId: ftid, counterpartyUserId: "u2" }),
      tx({ ownerUserId: "u2", ownerName: "Istri", type: "income", amount: 2000, category: "Transfer Keluarga", familyTransferId: ftid, counterpartyUserId: "u1" }),
      // pengeluaran riil
      tx({ ownerUserId: "u1", type: "expense", amount: 100, category: "Makan" }),
    ]);
    expect(s.income).toBe(0); // income transfer dieliminasi
    expect(s.expense).toBe(100); // hanya pengeluaran riil
  });

  it("TIDAK mengeliminasi transfer yang hanya punya 1 kaki (pasangan belum lengkap)", () => {
    const s = summarizeFamily([
      tx({ ownerUserId: "u1", type: "expense", amount: 2000, category: "Transfer Keluarga", familyTransferId: "lonely", counterpartyUserId: "u2" }),
    ]);
    expect(s.expense).toBe(2000);
  });

  it("melewati transaksi equity (Saldo Awal) & tabungan", () => {
    const s = summarizeFamily(
      [
        tx({ type: "expense", amount: 999, category: "Saldo Awal" }),
        tx({ type: "expense", amount: 300, category: "Tabungan" }),
        tx({ type: "expense", amount: 100, category: "Makan" }),
      ],
      new Set(["tabungan"])
    );
    expect(s.expense).toBe(100);
  });
});
