type TransactionLike = {
  type?: string | null;
  category?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
};

export function isTransferTransaction(tx: TransactionLike): boolean {
  if (tx.type === "transfer_out" || tx.type === "transfer_in") return true;
  return tx.category === "Transfer" && !!tx.fromAccountId && !!tx.toAccountId;
}

export function isExpenseTransaction(tx: TransactionLike): boolean {
  return tx.type !== "income" && !isTransferTransaction(tx);
}
