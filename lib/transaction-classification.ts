type TransactionLike = {
  type?: string | null;
  category?: string | null;
  fromAccountId?: string | null;
  fromAccountName?: string | null;
  toAccountId?: string | null;
  toAccountName?: string | null;
};

export function isTransferTransaction(tx: TransactionLike): boolean {
  if (tx.type === "transfer_out" || tx.type === "transfer_in") return true;
  const hasFromAccount = !!tx.fromAccountId || !!tx.fromAccountName;
  const hasToAccount = !!tx.toAccountId || !!tx.toAccountName;
  return tx.category === "Transfer" && hasFromAccount && hasToAccount;
}

export function isExpenseTransaction(tx: TransactionLike): boolean {
  return tx.type !== "income" && !isTransferTransaction(tx);
}

/**
 * Kategori transaksi yang murni menyesuaikan Equity (saldo akun), BUKAN
 * aktivitas operasional. Secara akuntansi: Assets − Liabilities = Equity, dan
 * transaksi-transaksi ini langsung memengaruhi Equity tanpa melewati
 * Income/Expense. Tetap diikutsertakan saat menghitung saldo akun, tetapi
 * WAJIB di-skip dari total pemasukan/pengeluaran di semua laporan.
 *
 *   - "Saldo Awal"        → seeding saldo awal akun
 *   - "Penyesuaian Saldo" → koreksi/adjustment saldo manual
 */
export const EQUITY_CATEGORIES = new Set(["Saldo Awal", "Penyesuaian Saldo"]);

export function isEquityTransaction(tx: TransactionLike): boolean {
  return !!tx.category && EQUITY_CATEGORIES.has(tx.category);
}
