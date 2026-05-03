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
