/**
 * Pure helpers for computing account balances from the Sheets ledger.
 * Kept in its own module (no external deps) so it's safely importable
 * by route handlers AND unit tests without pulling Google API SDK / uuid (ESM).
 */

export interface AccountClassif {
  id: string;
  classification: string; // "asset" | "liability"
}

export interface LedgerTx {
  type: "expense" | "income";
  amount: number;
  fromAccountId?: string;
  toAccountId?: string;
}

/**
 * Compute current balance per account from the Transaksi ledger (pure-ledger).
 * Source of truth: sheet Transaksi. Mirrors `getAccountBalances` di DB path.
 *
 * Sign rule depends only on side + classification (not on row type label):
 *   from-leg → asset −amount, liability +amount  (uang keluar)
 *   to-leg   → asset +amount, liability −amount  (uang masuk)
 *
 * Berlaku untuk semua flow yang ditulis app:
 *   • pure expense (from set):       asset −, liability + (debt grows)
 *   • pure income  (to set):         asset +, liability − (paying off debt)
 *   • transfer    (both set):        net 0 across both legs
 *   • Saldo Awal income (asset, to): +amount ✓
 *   • Saldo Awal expense (liab, from): +amount on liability ✓
 *   • Penyesuaian Saldo: ditangani sebagai income/expense biasa
 */
export function computeAccountBalancesFromTx(
  accounts: AccountClassif[],
  transactions: LedgerTx[]
): Map<string, number> {
  const balances = new Map<string, number>();
  const classificationOf = new Map<string, string>();
  for (const a of accounts) {
    balances.set(a.id, 0);
    classificationOf.set(a.id, a.classification);
  }

  const apply = (accountId: string | undefined, side: "from" | "to", amount: number) => {
    if (!accountId) return;
    if (!balances.has(accountId)) return; // ignore deleted/unknown account ids
    const classif = classificationOf.get(accountId) ?? "asset";
    const sign = side === "from"
      ? (classif === "liability" ? +1 : -1)
      : (classif === "liability" ? -1 : +1);
    balances.set(accountId, (balances.get(accountId) ?? 0) + sign * amount);
  };

  for (const t of transactions) {
    if (!Number.isFinite(t.amount) || t.amount <= 0) continue;
    apply(t.fromAccountId, "from", t.amount);
    apply(t.toAccountId, "to", t.amount);
  }

  return balances;
}
