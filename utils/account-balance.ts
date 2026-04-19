/**
 * Saldo akun dihitung 100% dari transaksi (pure ledger).
 * Field `initialBalance` di tabel Account adalah metadata display saja.
 *
 * Rumus:
 *   balance = Σ income + Σ transfer_in - Σ expense - Σ transfer_out
 *             (semua WHERE accountId = this.id)
 */

import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import type { Account, AccountType } from "@prisma/client";

export type AccountWithBalance = Account & {
  accountType: AccountType;
  currentBalance: Decimal;
  transactionCount: number;
};

export type NetWorthSummary = {
  assets: Decimal;
  liabilities: Decimal;
  netWorth: Decimal;
};

export async function getAccountBalances(userId: string): Promise<AccountWithBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    include: { accountType: true },
    orderBy: [
      { accountType: { sortOrder: "asc" } },
      { createdAt: "asc" },
    ],
  });

  const aggregates = await prisma.transaction.groupBy({
    by: ["accountId", "type"],
    where: { userId, accountId: { not: null } },
    _sum: { amount: true },
    _count: true,
  });

  return accounts.map((acc) => {
    let balance = new Decimal(0);
    let count = 0;

    for (const agg of aggregates) {
      if (agg.accountId !== acc.id) continue;
      const sum = new Decimal(agg._sum.amount?.toString() ?? "0");
      count += agg._count;

      if (agg.type === "income" || agg.type === "transfer_in") {
        balance = balance.plus(sum);
      } else if (agg.type === "expense" || agg.type === "transfer_out") {
        balance = balance.minus(sum);
      }
    }

    return { ...acc, currentBalance: balance, transactionCount: count };
  });
}

export function calculateNetWorth(accounts: AccountWithBalance[]): NetWorthSummary {
  let assets = new Decimal(0);
  let liabilities = new Decimal(0);

  for (const acc of accounts) {
    if (acc.accountType.classification === "liability") {
      liabilities = liabilities.plus(acc.currentBalance);
    } else {
      assets = assets.plus(acc.currentBalance);
    }
  }

  return { assets, liabilities, netWorth: assets.minus(liabilities) };
}

/** Helper untuk satu akun spesifik — dipakai di adjust endpoint */
export async function getSingleAccountBalance(
  userId: string,
  accountId: string
): Promise<Decimal> {
  const aggregates = await prisma.transaction.groupBy({
    by: ["type"],
    where: { userId, accountId },
    _sum: { amount: true },
  });

  let balance = new Decimal(0);
  for (const agg of aggregates) {
    const sum = new Decimal(agg._sum.amount?.toString() ?? "0");
    if (agg.type === "income" || agg.type === "transfer_in") balance = balance.plus(sum);
    else if (agg.type === "expense" || agg.type === "transfer_out") balance = balance.minus(sum);
  }
  return balance;
}

/** Serialize Decimal fields ke string untuk JSON response */
export function serializeAccountWithBalance(acc: AccountWithBalance) {
  return {
    ...acc,
    initialBalance: acc.initialBalance.toString(),
    currentBalance: acc.currentBalance.toString(),
  };
}

export function serializeNetWorth(summary: NetWorthSummary) {
  return {
    assets: summary.assets.toString(),
    liabilities: summary.liabilities.toString(),
    netWorth: summary.netWorth.toString(),
  };
}
