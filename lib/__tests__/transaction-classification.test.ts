import { isExpenseTransaction, isTransferTransaction } from "@/lib/transaction-classification";

describe("transaction classification", () => {
  it("excludes DB transfer rows from expense", () => {
    expect(isTransferTransaction({ type: "transfer_out", category: "Transfer" })).toBe(true);
    expect(isTransferTransaction({ type: "transfer_in", category: "Transfer" })).toBe(true);
    expect(isExpenseTransaction({ type: "transfer_out", category: "Transfer" })).toBe(false);
    expect(isExpenseTransaction({ type: "transfer_in", category: "Transfer" })).toBe(false);
  });

  it("excludes Sheets transfer rows with both account legs from expense", () => {
    const tx = {
      type: "expense",
      category: "Transfer",
      fromAccountId: "bca",
      toAccountId: "mandiri",
    };

    expect(isTransferTransaction(tx)).toBe(true);
    expect(isExpenseTransaction(tx)).toBe(false);
  });

  it("excludes Sheets transfer rows with account names from expense", () => {
    const tx = {
      type: "expense",
      category: "Transfer",
      fromAccountName: "BCA",
      toAccountName: "Mandiri",
    };

    expect(isTransferTransaction(tx)).toBe(true);
    expect(isExpenseTransaction(tx)).toBe(false);
  });

  it("keeps transfer fee as expense", () => {
    const tx = {
      type: "expense",
      category: "Biaya Admin",
      fromAccountId: "bca",
    };

    expect(isTransferTransaction(tx)).toBe(false);
    expect(isExpenseTransaction(tx)).toBe(true);
  });
});
