import "server-only";

import { prisma } from "@/lib/prisma";
import { DEMO_ACCOUNT } from "@/lib/demo-account";
import { getValidToken } from "@/utils/token";
import { seedDefaultCategories } from "@/utils/seed-categories";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { clearBudgetInSheetData } from "@/utils/sheets";

type StorageMode = "database" | "sheets" | "google_setup_required_db_fallback";

export type AccountDataActionResult = {
  storageMode: StorageMode;
  sheetsCleared: boolean;
  deletedCounts: {
    billPayments: number;
    recurringBills: number;
    savingsContributions: number;
    savingsGoals: number;
    budgets: number;
    transactions: number;
    accounts: number;
    accountTypes: number;
    categories: number;
  };
  reseeded: boolean;
};

type ActionUser = {
  id: string;
  email: string;
  googleId: string | null;
  sheetsId: string | null;
};

function storageModeOf(user: ActionUser): StorageMode {
  if (user.sheetsId) return "sheets";
  if (user.googleId) return "google_setup_required_db_fallback";
  return "database";
}

async function getActionUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, googleId: true, sheetsId: true },
  });
  if (!user) throw new Error("User tidak ditemukan.");
  if (user.email === DEMO_ACCOUNT.email) throw new Error("Aksi ini tidak tersedia untuk akun demo publik.");
  return user;
}

async function clearSheetsDataIfNeeded(userId: string, sheetsId: string | null) {
  if (!sheetsId) return false;
  const accessToken = await getValidToken(userId);
  await clearBudgetInSheetData(sheetsId, accessToken);
  return true;
}

async function deleteFinancialData(userId: string): Promise<AccountDataActionResult["deletedCounts"]> {
  return prisma.$transaction(async (tx) => {
    const billPayments = await tx.billPayment.deleteMany({ where: { bill: { userId } } });
    const recurringBills = await tx.recurringBill.deleteMany({ where: { userId } });
    const savingsContributions = await tx.savingsContribution.deleteMany({ where: { userId } });
    const savingsGoals = await tx.savingsGoal.deleteMany({ where: { userId } });
    const budgets = await tx.budget.deleteMany({ where: { userId } });
    const transactions = await tx.transaction.deleteMany({ where: { userId } });
    const accounts = await tx.account.deleteMany({ where: { userId } });
    const accountTypes = await tx.accountType.deleteMany({ where: { userId } });
    const categories = await tx.category.deleteMany({ where: { userId } });

    return {
      billPayments: billPayments.count,
      recurringBills: recurringBills.count,
      savingsContributions: savingsContributions.count,
      savingsGoals: savingsGoals.count,
      budgets: budgets.count,
      transactions: transactions.count,
      accounts: accounts.count,
      accountTypes: accountTypes.count,
      categories: categories.count,
    };
  }, { timeout: 30_000 });
}

export async function resetUserFinancialData(userId: string): Promise<AccountDataActionResult> {
  const user = await getActionUser(userId);
  const sheetsCleared = await clearSheetsDataIfNeeded(user.id, user.sheetsId);
  const deletedCounts = await deleteFinancialData(user.id);
  await seedDefaultCategories(user.id);
  await ensureDefaultAccountTypes(user.id);

  return {
    storageMode: storageModeOf(user),
    sheetsCleared,
    deletedCounts,
    reseeded: true,
  };
}

export async function resetUserAccountSetup(userId: string): Promise<AccountDataActionResult> {
  const result = await resetUserFinancialData(userId);
  await prisma.user.update({
    where: { id: userId },
    data: {
      sheetsId: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      googleSetupMigratedAt: null,
    },
  });
  return result;
}

export async function deleteCurrentUserAccount(userId: string): Promise<{ storageMode: StorageMode; sheetsCleared: boolean }> {
  const user = await getActionUser(userId);
  const sheetsCleared = await clearSheetsDataIfNeeded(user.id, user.sheetsId);
  await prisma.user.delete({ where: { id: user.id } });
  return { storageMode: storageModeOf(user), sheetsCleared };
}
