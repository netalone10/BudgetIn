/**
 * Google Sheets single-call data fetching layer.
 *
 * Fetches the full transaction ledger + accounts in ONE Sheets API call each,
 * then derives month-specific slices and balance calculations in memory.
 * Wrapped with React cache() for per-request deduplication so that multiple
 * Server Components sharing the same render never trigger duplicate API calls.
 *
 * Requirements: 8.1, 8.2, 8.3
 */
import "server-only";

import { cache } from "react";
import { getTransactions, getAccounts, type Transaction, type AccountData } from "@/utils/sheets";
import { computeAccountBalancesFromTx } from "@/utils/sheets-ledger";
import { getValidToken } from "@/utils/token";
import { cacheSheetResponse, handleSheetsFallback } from "@/lib/sheets-fallback";
import { checkThresholdBreach } from "@/lib/performance";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SheetsLedgerData {
  transactions: Transaction[];
  accounts: AccountData[];
}

export interface SheetsAccountWithBalance extends AccountData {
  balance: number;
}

// ─── Core: Single-call full ledger fetch (React cache-wrapped) ────────────────

/**
 * Fetches the full transaction ledger and all accounts from Google Sheets
 * in a single pair of API calls. Wrapped with React cache() so that within
 * a single server request, repeated calls with the same userId return the
 * same promise without re-fetching.
 *
 * On success, caches the response via cacheSheetResponse for fallback use.
 * On failure, returns stale cached data or empty dataset via handleSheetsFallback.
 */
export const getFullSheetsLedger = cache(
  async (userId: string, sheetsId: string): Promise<SheetsLedgerData> => {
    const startTime = Date.now();
    try {
      const accessToken = await getValidToken(userId);

      // Single pair of API calls — fetch everything at once
      const [transactions, accounts] = await Promise.all([
        getTransactions(sheetsId, accessToken),
        getAccounts(sheetsId, accessToken),
      ]);

      // Cache successful response for fallback use (Requirement 8.4)
      cacheSheetResponse(userId, { transactions, accounts });

      const duration = Date.now() - startTime;
      const breach = checkThresholdBreach("sheets-sync", duration);
      if (breach) {
        console.warn(breach.message);
      }

      return { transactions, accounts };
    } catch (error) {
      const duration = Date.now() - startTime;
      const breach = checkThresholdBreach("sheets-sync", duration);
      if (breach) {
        console.warn(breach.message);
      }

      // Graceful degradation: return stale data or empty dataset
      const fallback = handleSheetsFallback<SheetsLedgerData>(
        userId,
        error,
        () => ({ transactions: [], accounts: [] })
      );

      if (fallback.isStale) {
        console.warn(
          `[sheets-data] Serving stale data for user ${userId}: ${fallback.error}`
        );
      } else {
        console.error(
          `[sheets-data] No cached data available for user ${userId}: ${fallback.error}`
        );
      }

      return fallback.data;
    }
  }
);

// ─── Derived: Month-specific transaction slices ───────────────────────────────

/**
 * Derives transactions for a specific month (YYYY-MM) from the full ledger.
 * No additional API calls — purely in-memory filtering.
 *
 * Requirement 8.1: derive month-specific slices in memory
 */
export async function getTransactionsForMonth(
  userId: string,
  sheetsId: string,
  month: string
): Promise<Transaction[]> {
  const { transactions } = await getFullSheetsLedger(userId, sheetsId);
  return transactions.filter((t) => t.date.startsWith(month));
}

/**
 * Derives transactions for a custom date range from the full ledger.
 * No additional API calls — purely in-memory filtering.
 */
export async function getTransactionsForRange(
  userId: string,
  sheetsId: string,
  from: string,
  to: string
): Promise<Transaction[]> {
  const { transactions } = await getFullSheetsLedger(userId, sheetsId);
  return transactions.filter((t) => t.date >= from && t.date <= to);
}

/**
 * Returns all transactions (unfiltered) from the preloaded ledger.
 * Useful when the caller needs the full dataset (e.g., for balance computation).
 */
export async function getAllTransactions(
  userId: string,
  sheetsId: string
): Promise<Transaction[]> {
  const { transactions } = await getFullSheetsLedger(userId, sheetsId);
  return transactions;
}

// ─── Derived: Account balances from ledger ────────────────────────────────────

/**
 * Computes account balances from the preloaded ledger data.
 * Reuses the same transactions already fetched — no separate API roundtrip.
 *
 * Requirement 8.2: reuse preloaded transaction data for balance calculations
 */
export async function getAccountBalancesFromLedger(
  userId: string,
  sheetsId: string
): Promise<Map<string, number>> {
  const { transactions, accounts } = await getFullSheetsLedger(userId, sheetsId);
  return computeAccountBalancesFromTx(accounts, transactions);
}

/**
 * Returns accounts with their ledger-computed balances.
 * Combines account metadata with pure-ledger balance calculation.
 * No separate API call for balances — derived from the same preloaded data.
 *
 * Requirement 8.2: avoid separate Google Sheets API roundtrip for balance calculation
 */
export async function getAccountsWithComputedBalance(
  userId: string,
  sheetsId: string
): Promise<SheetsAccountWithBalance[]> {
  const { transactions, accounts } = await getFullSheetsLedger(userId, sheetsId);
  const balances = computeAccountBalancesFromTx(accounts, transactions);

  return accounts.map((a) => ({
    ...a,
    balance: balances.get(a.id) ?? 0,
  }));
}
