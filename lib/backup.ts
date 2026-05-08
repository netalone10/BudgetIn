import "server-only";

import { randomUUID } from "crypto";
import { Decimal } from "@prisma/client/runtime/library";
import { OAuth2Client } from "google-auth-library";
import { sheets as googleSheets } from "@googleapis/sheets";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/utils/token";
import {
  ensureAccountHeader,
  ensureTransaksiHeader,
  getAccounts,
  getTransactions,
} from "@/utils/sheets";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { normalizeTransactionTime } from "@/lib/transaction-time";

export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 20_000;

type StorageMode = "database" | "sheets" | "google_setup_required_db_fallback";

type CanonicalCategory = {
  id: string;
  name: string;
  type: string;
  isSavings: boolean;
  rolloverEnabled: boolean;
};

type CanonicalAccountType = {
  id: string;
  name: string;
  classification: string;
  icon: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
};

type CanonicalAccount = {
  id: string;
  accountTypeId: string | null;
  accountTypeName: string;
  classification: string;
  name: string;
  initialBalance: number;
  currency: string;
  color: string | null;
  icon: string | null;
  note: string;
  isActive: boolean;
  tanggalSettlement: number | null;
  tanggalJatuhTempo: number | null;
};

type CanonicalTransaction = {
  id: string;
  date: string;
  time?: string;
  amount: number;
  category: string;
  note: string;
  type: "expense" | "income" | "transfer";
  fromAccountId: string | null;
  fromAccountName: string | null;
  toAccountId: string | null;
  toAccountName: string | null;
  transferId: string | null;
  isInitialBalance: boolean;
  createdAt: string;
};

type CanonicalBudget = {
  id: string;
  categoryId: string | null;
  categoryName: string;
  amount: number;
  month: string;
};

type CanonicalSavingsGoal = {
  id: string;
  name: string;
  targetAmount: number;
  deadline: string | null;
  createdAt: string;
};

type CanonicalSavingsContribution = {
  id: string;
  goalId: string;
  transactionId: string;
  amount: number;
  date: string;
  note: string;
  createdAt: string;
};

type CanonicalRecurringBill = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  categoryId: string | null;
  categoryName: string | null;
  accountId: string | null;
  accountName: string | null;
  autoRecord: boolean;
  reminderDays: number[];
  lastPaidAt: string | null;
  nextDueDate: string;
  isActive: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type CanonicalBillPayment = {
  id: string;
  billId: string;
  transactionId: string | null;
  paidAt: string;
  amount: number;
  note: string | null;
  paymentMonth: string;
};

export type BudgetInBackup = {
  schemaVersion: number;
  appName: "BudgetIn";
  exportedAt: string;
  source: {
    storageMode: StorageMode;
    userId: string;
    email: string | null;
    name: string | null;
  };
  summary: BackupSummary;
  data: {
    categories: CanonicalCategory[];
    accountTypes: CanonicalAccountType[];
    accounts: CanonicalAccount[];
    transactions: CanonicalTransaction[];
    budgets: CanonicalBudget[];
    savingsGoals: CanonicalSavingsGoal[];
    savingsContributions: CanonicalSavingsContribution[];
    recurringBills: CanonicalRecurringBill[];
    billPayments: CanonicalBillPayment[];
  };
};

export type BackupSummary = {
  categories: number;
  accountTypes: number;
  accounts: number;
  transactions: number;
  budgets: number;
  savingsGoals: number;
  savingsContributions: number;
  recurringBills: number;
  billPayments: number;
  totalRecords: number;
};

export type RestorePreview = {
  sourceStorageMode: StorageMode;
  targetStorageMode: "database" | "sheets";
  path: string;
  summary: BackupSummary;
  existing: BackupSummary;
  warnings: string[];
};

export type GoogleSetupMigrationPreview = RestorePreview & {
  migratedAt: string | null;
  canMigrate: boolean;
  canMarkComplete: boolean;
};

function toNumber(value: unknown) {
  if (value instanceof Decimal) return value.toNumber();
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function summaryOf(data: BudgetInBackup["data"]): BackupSummary {
  const summary = {
    categories: data.categories.length,
    accountTypes: data.accountTypes.length,
    accounts: data.accounts.length,
    transactions: data.transactions.length,
    budgets: data.budgets.length,
    savingsGoals: data.savingsGoals.length,
    savingsContributions: data.savingsContributions.length,
    recurringBills: data.recurringBills.length,
    billPayments: data.billPayments.length,
    totalRecords: 0,
  };
  summary.totalRecords = Object.entries(summary)
    .filter(([key]) => key !== "totalRecords")
    .reduce((total, [, value]) => total + value, 0);
  return summary;
}

function accountNameMap(accounts: CanonicalAccount[]) {
  return new Map(accounts.map((account) => [account.id, account.name]));
}

function normalizeTransactionDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
}

function normalizeMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 7);
}

export async function createBudgetInBackup(userId: string, options?: { forceDatabaseSource?: boolean }): Promise<BudgetInBackup> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, googleId: true, sheetsId: true },
  });
  if (!user) throw new Error("User tidak ditemukan");

  const storageMode: StorageMode = options?.forceDatabaseSource
    ? user.googleId
      ? "google_setup_required_db_fallback"
      : "database"
    : user.sheetsId
    ? "sheets"
    : user.googleId
      ? "google_setup_required_db_fallback"
      : "database";

  const [categories, savingsGoals, savingsContributions, recurringBills, billPayments] = await Promise.all([
    prisma.category.findMany({ where: { userId } }),
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.savingsContribution.findMany({ where: { userId } }),
    prisma.recurringBill.findMany({
      where: { userId },
      include: {
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
    prisma.billPayment.findMany({
      where: { bill: { userId } },
    }),
  ]);

  const canonicalCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    type: category.type,
    isSavings: category.isSavings,
    rolloverEnabled: category.rolloverEnabled,
  }));

  const data = user.sheetsId && !options?.forceDatabaseSource
    ? await exportSheetsData(userId, user.sheetsId, canonicalCategories)
    : await exportDbData(userId, canonicalCategories);

  const backupData: BudgetInBackup["data"] = {
    ...data,
    categories: canonicalCategories,
    savingsGoals: savingsGoals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount.toNumber(),
      deadline: goal.deadline?.toISOString() ?? null,
      createdAt: goal.createdAt.toISOString(),
    })),
    savingsContributions: savingsContributions.map((contribution) => ({
      id: contribution.id,
      goalId: contribution.goalId,
      transactionId: contribution.transactionId,
      amount: contribution.amount.toNumber(),
      date: contribution.date,
      note: contribution.note,
      createdAt: contribution.createdAt.toISOString(),
    })),
    recurringBills: recurringBills.map((bill) => ({
      id: bill.id,
      name: bill.name,
      amount: bill.amount.toNumber(),
      dueDay: bill.dueDay,
      categoryId: bill.categoryId,
      categoryName: bill.category?.name ?? null,
      accountId: bill.accountId,
      accountName: bill.account?.name ?? null,
      autoRecord: bill.autoRecord,
      reminderDays: bill.reminderDays,
      lastPaidAt: bill.lastPaidAt?.toISOString() ?? null,
      nextDueDate: bill.nextDueDate.toISOString(),
      isActive: bill.isActive,
      note: bill.note,
      createdAt: bill.createdAt.toISOString(),
      updatedAt: bill.updatedAt.toISOString(),
    })),
    billPayments: billPayments.map((payment) => ({
      id: payment.id,
      billId: payment.billId,
      transactionId: payment.transactionId,
      paidAt: payment.paidAt.toISOString(),
      amount: payment.amount.toNumber(),
      note: payment.note,
      paymentMonth: payment.paymentMonth,
    })),
  };

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appName: "BudgetIn",
    exportedAt: new Date().toISOString(),
    source: {
      storageMode,
      userId: user.id,
      email: user.email,
      name: user.name,
    },
    summary: summaryOf(backupData),
    data: backupData,
  };
}

async function exportDbData(userId: string, categories: CanonicalCategory[]) {
  const [accountTypes, accounts, transactions, budgets] = await Promise.all([
    prisma.accountType.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId }, include: { accountType: true } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.budget.findMany({ where: { userId }, include: { category: true } }),
  ]);

  const names = new Map(accounts.map((account) => [account.id, account.name]));
  const transactionByTransfer = new Map<string, typeof transactions>();
  const canonicalTransactions: CanonicalTransaction[] = [];

  for (const transaction of transactions) {
    if (transaction.transferId && (transaction.type === "transfer_out" || transaction.type === "transfer_in")) {
      const group = transactionByTransfer.get(transaction.transferId) ?? [];
      group.push(transaction);
      transactionByTransfer.set(transaction.transferId, group);
      continue;
    }

    canonicalTransactions.push({
      id: transaction.id,
      date: normalizeTransactionDate(transaction.date),
      time: normalizeTransactionTime(transaction.time),
      amount: transaction.amount.toNumber(),
      category: transaction.category,
      note: transaction.note,
      type: transaction.type === "income" ? "income" : "expense",
      fromAccountId: transaction.type === "expense" ? transaction.accountId : null,
      fromAccountName: transaction.type === "expense" && transaction.accountId ? names.get(transaction.accountId) ?? null : null,
      toAccountId: transaction.type === "income" ? transaction.accountId : null,
      toAccountName: transaction.type === "income" && transaction.accountId ? names.get(transaction.accountId) ?? null : null,
      transferId: transaction.transferId,
      isInitialBalance: transaction.isInitialBalance,
      createdAt: transaction.createdAt.toISOString(),
    });
  }

  for (const [transferId, group] of transactionByTransfer) {
    const out = group.find((transaction) => transaction.type === "transfer_out");
    const input = group.find((transaction) => transaction.type === "transfer_in");
    if (!out || !input) {
      for (const transaction of group) {
        canonicalTransactions.push({
          id: transaction.id,
          date: normalizeTransactionDate(transaction.date),
          time: normalizeTransactionTime(transaction.time),
          amount: transaction.amount.toNumber(),
          category: transaction.category,
          note: transaction.note,
          type: transaction.type === "transfer_in" ? "income" : "expense",
          fromAccountId: transaction.type === "transfer_out" ? transaction.accountId : null,
          fromAccountName: transaction.type === "transfer_out" && transaction.accountId ? names.get(transaction.accountId) ?? null : null,
          toAccountId: transaction.type === "transfer_in" ? transaction.accountId : null,
          toAccountName: transaction.type === "transfer_in" && transaction.accountId ? names.get(transaction.accountId) ?? null : null,
          transferId,
          isInitialBalance: transaction.isInitialBalance,
          createdAt: transaction.createdAt.toISOString(),
        });
      }
      continue;
    }

    canonicalTransactions.push({
      id: transferId,
      date: normalizeTransactionDate(out.date),
      time: normalizeTransactionTime(out.time),
      amount: out.amount.toNumber(),
      category: "Transfer",
      note: out.note || input.note,
      type: "transfer",
      fromAccountId: out.accountId,
      fromAccountName: out.accountId ? names.get(out.accountId) ?? null : null,
      toAccountId: input.accountId,
      toAccountName: input.accountId ? names.get(input.accountId) ?? null : null,
      transferId,
      isInitialBalance: false,
      createdAt: out.createdAt.toISOString(),
    });
  }

  return {
    accountTypes: accountTypes.map((type) => ({
      id: type.id,
      name: type.name,
      classification: type.classification,
      icon: type.icon,
      color: type.color,
      sortOrder: type.sortOrder,
      isActive: type.isActive,
    })),
    accounts: accounts.map((account) => ({
      id: account.id,
      accountTypeId: account.accountTypeId,
      accountTypeName: account.accountType.name,
      classification: account.accountType.classification,
      name: account.name,
      initialBalance: account.initialBalance.toNumber(),
      currency: account.currency,
      color: account.color,
      icon: account.icon,
      note: account.note,
      isActive: account.isActive,
      tanggalSettlement: account.tanggalSettlement,
      tanggalJatuhTempo: account.tanggalJatuhTempo,
    })),
    transactions: canonicalTransactions.sort((a, b) => `${a.date}${a.createdAt}`.localeCompare(`${b.date}${b.createdAt}`)),
    budgets: budgets.map((budget) => ({
      id: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category.name,
      amount: budget.amount.toNumber(),
      month: normalizeMonth(budget.month),
    })),
  } satisfies Pick<BudgetInBackup["data"], "accountTypes" | "accounts" | "transactions" | "budgets">;
}

async function exportSheetsData(userId: string, sheetsId: string, categories: CanonicalCategory[]) {
  const accessToken = await getValidToken(userId);
  const [sheetAccounts, sheetTransactions] = await Promise.all([
    getAccounts(sheetsId, accessToken),
    getTransactions(sheetsId, accessToken),
  ]);
  const accountTypesByName = new Map<string, CanonicalAccountType>();

  for (const account of sheetAccounts) {
    if (accountTypesByName.has(account.type)) continue;
    accountTypesByName.set(account.type, {
      id: account.type,
      name: account.type,
      classification: account.classification === "liability" ? "liability" : "asset",
      icon: "wallet",
      color: account.color ?? "#6366f1",
      sortOrder: accountTypesByName.size * 10,
      isActive: true,
    });
  }

  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  const sheets = googleSheets({ version: "v4", auth });
  const budgetRows = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Budget!A2:C",
    valueRenderOption: "UNFORMATTED_VALUE",
  }).catch(() => ({ data: { values: [] as unknown[][] } }));
  const categoryByName = new Map(categories.map((category) => [category.name, category.id]));

  return {
    accountTypes: Array.from(accountTypesByName.values()),
    accounts: sheetAccounts.map((account) => ({
      id: account.id,
      accountTypeId: account.type,
      accountTypeName: account.type,
      classification: account.classification === "liability" ? "liability" : "asset",
      name: account.name,
      initialBalance: account.balance,
      currency: account.currency,
      color: account.color,
      icon: null,
      note: account.note ?? "",
      isActive: true,
      tanggalSettlement: account.tanggalSettlement,
      tanggalJatuhTempo: account.tanggalJatuhTempo,
    })),
    transactions: sheetTransactions.map((transaction) => ({
      id: transaction.id,
      date: normalizeTransactionDate(transaction.date),
      time: normalizeTransactionTime(transaction.time),
      amount: transaction.amount,
      category: transaction.category,
      note: transaction.note,
      type: transaction.category === "Transfer" && transaction.fromAccountId && transaction.toAccountId
        ? "transfer"
        : transaction.type,
      fromAccountId: transaction.fromAccountId ?? null,
      fromAccountName: transaction.fromAccountName ?? null,
      toAccountId: transaction.toAccountId ?? null,
      toAccountName: transaction.toAccountName ?? null,
      transferId: transaction.category === "Transfer" && transaction.fromAccountId && transaction.toAccountId ? transaction.id : null,
      isInitialBalance: transaction.category === "Saldo Awal",
      createdAt: transaction.created_at || new Date().toISOString(),
    })),
    budgets: (budgetRows.data.values ?? [])
      .filter((row) => row[0])
      .map((row, index) => ({
        id: `sheet-budget-${index}-${row[0]}-${row[2]}`,
        categoryId: categoryByName.get(String(row[0])) ?? null,
        categoryName: String(row[0]),
        amount: toNumber(row[1]),
        month: normalizeMonth(String(row[2] ?? "")),
      })),
  } satisfies Pick<BudgetInBackup["data"], "accountTypes" | "accounts" | "transactions" | "budgets">;
}

export function parseBackupPayload(payload: unknown): BudgetInBackup {
  if (!payload || typeof payload !== "object") throw new Error("File backup tidak valid");
  const backup = payload as BudgetInBackup;
  if (backup.appName !== "BudgetIn" || backup.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error("Versi backup tidak didukung");
  }
  if (!backup.data || !backup.source) throw new Error("Struktur backup tidak lengkap");
  const data = backup.data;
  const arrays = [
    data.categories,
    data.accountTypes,
    data.accounts,
    data.transactions,
    data.budgets,
    data.savingsGoals,
    data.savingsContributions,
    data.recurringBills,
    data.billPayments,
  ];
  if (arrays.some((item) => !Array.isArray(item))) throw new Error("Data backup tidak lengkap");
  const summary = summaryOf(data);
  if (summary.totalRecords > MAX_BACKUP_RECORDS) throw new Error("Backup terlalu besar");
  return { ...backup, summary };
}

export async function createRestorePreview(userId: string, backup: BudgetInBackup): Promise<RestorePreview> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { sheetsId: true } });
  if (!target) throw new Error("User tidak ditemukan");
  const targetStorageMode = target.sheetsId ? "sheets" : "database";
  const existing = await countExistingData(userId, target.sheetsId ?? null);
  const warnings: string[] = [];
  if (existing.totalRecords > 0) warnings.push("Akun target sudah memiliki data. Restore akan merge dan mencoba menghindari duplikasi.");
  if (backup.source.userId === userId) warnings.push("Backup berasal dari akun yang sama dengan akun target.");
  if (targetStorageMode === "sheets") warnings.push("Akun, transaksi, dan budget akan dipulihkan ke Google Sheets; data tabungan dan tagihan tetap di database BudgetIn.");
  return {
    sourceStorageMode: backup.source.storageMode,
    targetStorageMode,
    path: `${backup.source.storageMode}→${targetStorageMode}`,
    summary: backup.summary,
    existing,
    warnings,
  };
}

export async function createGoogleSetupMigrationPreview(userId: string): Promise<GoogleSetupMigrationPreview> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleId: true, sheetsId: true, googleSetupMigratedAt: true },
  });
  if (!user?.googleId) throw new Error("Akun ini bukan akun Google.");
  if (!user.sheetsId) throw new Error("Hubungkan ulang Google terlebih dahulu.");

  const backup = await createBudgetInBackup(userId, { forceDatabaseSource: true });
  const preview = await createRestorePreview(userId, backup);
  const canMigrate = !user.googleSetupMigratedAt && preview.existing.accounts === 0 && preview.existing.transactions === 0 && preview.existing.budgets === 0;
  const canMarkComplete = !user.googleSetupMigratedAt && !canMigrate && (preview.existing.accounts > 0 || preview.existing.transactions > 0 || preview.existing.budgets > 0);
  const warnings = [...preview.warnings];
  if (user.googleSetupMigratedAt) warnings.push("Data fallback sudah pernah dimigrasikan.");
  if (preview.existing.accounts > 0 || preview.existing.transactions > 0 || preview.existing.budgets > 0) {
    warnings.push("Google Sheets target sudah berisi akun, transaksi, atau budget. Migrasi otomatis diblok untuk mencegah duplikasi.");
  }
  return {
    ...preview,
    warnings,
    migratedAt: user.googleSetupMigratedAt?.toISOString() ?? null,
    canMigrate,
    canMarkComplete,
  };
}

export async function migrateGoogleSetupFallbackToSheets(userId: string): Promise<GoogleSetupMigrationPreview> {
  const preview = await createGoogleSetupMigrationPreview(userId);
  if (!preview.canMigrate) throw new Error("Migrasi tidak bisa dijalankan karena target tidak kosong atau sudah pernah dimigrasikan.");

  const backup = await createBudgetInBackup(userId, { forceDatabaseSource: true });
  await restoreBudgetInBackup(userId, backup, { skipCommonDbBackedData: true });
  await prisma.user.update({
    where: { id: userId },
    data: { googleSetupMigratedAt: new Date() },
  });
  return createGoogleSetupMigrationPreview(userId);
}

export async function markGoogleSetupMigrationComplete(userId: string): Promise<GoogleSetupMigrationPreview> {
  const preview = await createGoogleSetupMigrationPreview(userId);
  if (!preview.canMarkComplete) throw new Error("Setup Google tidak bisa ditandai selesai dari kondisi saat ini.");

  await prisma.user.update({
    where: { id: userId },
    data: { googleSetupMigratedAt: new Date() },
  });
  return createGoogleSetupMigrationPreview(userId);
}

async function countExistingData(userId: string, sheetsId: string | null): Promise<BackupSummary> {
  const [categories, accountTypes, savingsGoals, savingsContributions, recurringBills, billPayments] = await Promise.all([
    prisma.category.count({ where: { userId } }),
    prisma.accountType.count({ where: { userId } }),
    prisma.savingsGoal.count({ where: { userId } }),
    prisma.savingsContribution.count({ where: { userId } }),
    prisma.recurringBill.count({ where: { userId } }),
    prisma.billPayment.count({ where: { bill: { userId } } }),
  ]);

  let accounts = 0;
  let transactions = 0;
  let budgets = 0;
  if (sheetsId) {
    const accessToken = await getValidToken(userId).catch(() => null);
    if (accessToken) {
      const [sheetAccounts, sheetTransactions] = await Promise.all([
        getAccounts(sheetsId, accessToken).catch(() => []),
        getTransactions(sheetsId, accessToken).catch(() => []),
      ]);
      accounts = sheetAccounts.length;
      transactions = sheetTransactions.length;
      const auth = new OAuth2Client();
      auth.setCredentials({ access_token: accessToken });
      const sheets = googleSheets({ version: "v4", auth });
      const budgetRows = await sheets.spreadsheets.values.get({ spreadsheetId: sheetsId, range: "Budget!A2:C" }).catch(() => ({ data: { values: [] as unknown[][] } }));
      budgets = budgetRows.data.values?.filter((row) => row[0]).length ?? 0;
    }
  } else {
    [accounts, transactions, budgets] = await Promise.all([
      prisma.account.count({ where: { userId } }),
      prisma.transaction.count({ where: { userId } }),
      prisma.budget.count({ where: { userId } }),
    ]);
  }

  return summaryOf({
    categories: Array.from({ length: categories }),
    accountTypes: Array.from({ length: accountTypes }),
    accounts: Array.from({ length: accounts }),
    transactions: Array.from({ length: transactions }),
    budgets: Array.from({ length: budgets }),
    savingsGoals: Array.from({ length: savingsGoals }),
    savingsContributions: Array.from({ length: savingsContributions }),
    recurringBills: Array.from({ length: recurringBills }),
    billPayments: Array.from({ length: billPayments }),
  } as BudgetInBackup["data"]);
}

export async function restoreBudgetInBackup(
  userId: string,
  backup: BudgetInBackup,
  options?: { skipCommonDbBackedData?: boolean }
): Promise<RestorePreview> {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { sheetsId: true } });
  if (!target) throw new Error("User tidak ditemukan");

  if (target.sheetsId) {
    await restoreToSheets(userId, target.sheetsId, backup, options);
  } else {
    await restoreToDatabase(userId, backup);
  }

  return createRestorePreview(userId, backup);
}

async function restoreCommonDbBackedData(userId: string, backup: BudgetInBackup, maps: {
  categoryId: Map<string, string>;
  accountId: Map<string, string>;
  transactionId: Map<string, string>;
  savingsGoalId: Map<string, string>;
  billId: Map<string, string>;
}) {
  for (const goal of backup.data.savingsGoals) {
    const id = randomUUID();
    maps.savingsGoalId.set(goal.id, id);
    await prisma.savingsGoal.create({
      data: {
        id,
        userId,
        name: goal.name,
        targetAmount: goal.targetAmount,
        deadline: goal.deadline ? new Date(goal.deadline) : null,
        createdAt: new Date(goal.createdAt),
      },
    }).catch(() => {});
  }

  for (const contribution of backup.data.savingsContributions) {
    const goalId = maps.savingsGoalId.get(contribution.goalId);
    const transactionId = maps.transactionId.get(contribution.transactionId);
    if (!goalId || !transactionId) continue;
    await prisma.savingsContribution.create({
      data: {
        id: randomUUID(),
        userId,
        goalId,
        transactionId,
        amount: contribution.amount,
        date: normalizeTransactionDate(contribution.date),
        note: contribution.note,
        createdAt: new Date(contribution.createdAt),
      },
    }).catch(() => {});
  }

  for (const bill of backup.data.recurringBills) {
    const id = randomUUID();
    maps.billId.set(bill.id, id);
    await prisma.recurringBill.create({
      data: {
        id,
        userId,
        name: bill.name,
        amount: bill.amount,
        dueDay: bill.dueDay,
        categoryId: bill.categoryId ? maps.categoryId.get(bill.categoryId) ?? null : null,
        accountId: bill.accountId ? maps.accountId.get(bill.accountId) ?? null : null,
        autoRecord: bill.autoRecord,
        reminderDays: bill.reminderDays,
        lastPaidAt: bill.lastPaidAt ? new Date(bill.lastPaidAt) : null,
        nextDueDate: new Date(bill.nextDueDate),
        isActive: bill.isActive,
        note: bill.note,
        createdAt: new Date(bill.createdAt),
        updatedAt: new Date(bill.updatedAt),
      },
    }).catch(() => {});
  }

  for (const payment of backup.data.billPayments) {
    const billId = maps.billId.get(payment.billId);
    if (!billId) continue;
    await prisma.billPayment.create({
      data: {
        id: randomUUID(),
        billId,
        transactionId: payment.transactionId ? maps.transactionId.get(payment.transactionId) ?? null : null,
        paidAt: new Date(payment.paidAt),
        amount: payment.amount,
        note: payment.note,
        paymentMonth: normalizeMonth(payment.paymentMonth),
      },
    }).catch(() => {});
  }
}

async function restoreCategories(userId: string, backup: BudgetInBackup) {
  const categoryId = new Map<string, string>();
  for (const category of backup.data.categories) {
    const restored = await prisma.category.upsert({
      where: { userId_name: { userId, name: category.name } },
      update: {
        type: category.type === "income" ? "income" : "expense",
        isSavings: category.isSavings,
        rolloverEnabled: category.rolloverEnabled,
      },
      create: {
        userId,
        name: category.name,
        type: category.type === "income" ? "income" : "expense",
        isSavings: category.isSavings,
        rolloverEnabled: category.rolloverEnabled,
      },
    });
    categoryId.set(category.id, restored.id);
  }
  return categoryId;
}

async function restoreToDatabase(userId: string, backup: BudgetInBackup) {
  await ensureDefaultAccountTypes(userId);
  const maps = {
    categoryId: new Map<string, string>(),
    accountTypeId: new Map<string, string>(),
    accountId: new Map<string, string>(),
    transactionId: new Map<string, string>(),
    savingsGoalId: new Map<string, string>(),
    billId: new Map<string, string>(),
  };

  await prisma.$transaction(async (tx) => {
    for (const category of backup.data.categories) {
      const restored = await tx.category.upsert({
        where: { userId_name: { userId, name: category.name } },
        update: {
          type: category.type === "income" ? "income" : "expense",
          isSavings: category.isSavings,
          rolloverEnabled: category.rolloverEnabled,
        },
        create: {
          userId,
          name: category.name,
          type: category.type === "income" ? "income" : "expense",
          isSavings: category.isSavings,
          rolloverEnabled: category.rolloverEnabled,
        },
      });
      maps.categoryId.set(category.id, restored.id);
    }

    for (const type of backup.data.accountTypes) {
      const restored = await tx.accountType.upsert({
        where: { userId_name: { userId, name: type.name } },
        update: {
          classification: type.classification === "liability" ? "liability" : "asset",
          icon: type.icon,
          color: type.color,
          sortOrder: type.sortOrder,
          isActive: type.isActive,
        },
        create: {
          userId,
          name: type.name,
          classification: type.classification === "liability" ? "liability" : "asset",
          icon: type.icon,
          color: type.color,
          sortOrder: type.sortOrder,
          isActive: type.isActive,
        },
      });
      maps.accountTypeId.set(type.id, restored.id);
    }

    for (const account of backup.data.accounts) {
      const typeId = account.accountTypeId ? maps.accountTypeId.get(account.accountTypeId) : undefined;
      const fallbackType = await tx.accountType.upsert({
        where: { userId_name: { userId, name: account.accountTypeName || "Lainnya" } },
        update: {},
        create: {
          userId,
          name: account.accountTypeName || "Lainnya",
          classification: account.classification === "liability" ? "liability" : "asset",
          icon: account.icon ?? "wallet",
          color: account.color ?? "#6366f1",
        },
      });
      const restored = await tx.account.create({
        data: {
          id: randomUUID(),
          userId,
          accountTypeId: typeId ?? fallbackType.id,
          name: account.name,
          initialBalance: account.initialBalance,
          currency: account.currency || "IDR",
          color: account.color,
          icon: account.icon,
          note: account.note,
          isActive: account.isActive,
          tanggalSettlement: account.tanggalSettlement,
          tanggalJatuhTempo: account.tanggalJatuhTempo,
        },
      });
      maps.accountId.set(account.id, restored.id);
    }

    for (const transaction of backup.data.transactions) {
      if (transaction.type === "transfer") {
        const transferId = randomUUID();
        const outAccountId = transaction.fromAccountId ? maps.accountId.get(transaction.fromAccountId) : null;
        const inAccountId = transaction.toAccountId ? maps.accountId.get(transaction.toAccountId) : null;
        if (!outAccountId || !inAccountId) continue;
        const transactionTime = normalizeTransactionTime(transaction.time);
        await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId,
            accountId: outAccountId,
            type: "transfer_out",
            amount: transaction.amount,
            category: "Transfer",
            date: normalizeTransactionDate(transaction.date),
            time: transactionTime,
            note: transaction.note,
            transferId,
            createdAt: new Date(transaction.createdAt),
          },
        });
        const input = await tx.transaction.create({
          data: {
            id: randomUUID(),
            userId,
            accountId: inAccountId,
            type: "transfer_in",
            amount: transaction.amount,
            category: "Transfer",
            date: normalizeTransactionDate(transaction.date),
            time: transactionTime,
            note: transaction.note,
            transferId,
            createdAt: new Date(transaction.createdAt),
          },
        });
        maps.transactionId.set(transaction.id, input.id);
        continue;
      }

      const sourceAccountId = transaction.type === "income" ? transaction.toAccountId : transaction.fromAccountId;
      const accountId = sourceAccountId ? maps.accountId.get(sourceAccountId) ?? null : null;
      const restored = await tx.transaction.create({
        data: {
          id: randomUUID(),
          userId,
          accountId,
          type: transaction.type,
          amount: transaction.amount,
          category: transaction.category,
          date: normalizeTransactionDate(transaction.date),
          time: normalizeTransactionTime(transaction.time),
          note: transaction.note,
          isInitialBalance: transaction.isInitialBalance,
          createdAt: new Date(transaction.createdAt),
        },
      });
      maps.transactionId.set(transaction.id, restored.id);
    }

    for (const budget of backup.data.budgets) {
      const categoryId = budget.categoryId ? maps.categoryId.get(budget.categoryId) : null;
      const category = categoryId
        ? await tx.category.findUnique({ where: { id: categoryId } })
        : await tx.category.upsert({
            where: { userId_name: { userId, name: budget.categoryName } },
            update: {},
            create: { userId, name: budget.categoryName, type: "expense" },
          });
      if (!category) continue;
      await tx.budget.upsert({
        where: { userId_categoryId_month: { userId, categoryId: category.id, month: normalizeMonth(budget.month) } },
        update: { amount: budget.amount },
        create: { userId, categoryId: category.id, amount: budget.amount, month: normalizeMonth(budget.month) },
      });
    }
  }, { timeout: 30_000 });

  await restoreCommonDbBackedData(userId, backup, maps);
}

async function restoreToSheets(
  userId: string,
  sheetsId: string,
  backup: BudgetInBackup,
  options?: { skipCommonDbBackedData?: boolean }
) {
  const accessToken = await getValidToken(userId);
  await Promise.all([
    ensureAccountHeader(sheetsId, accessToken),
    ensureTransaksiHeader(sheetsId, accessToken),
  ]);

  const maps = {
    categoryId: await restoreCategories(userId, backup),
    accountId: new Map<string, string>(),
    transactionId: new Map<string, string>(),
    savingsGoalId: new Map<string, string>(),
    billId: new Map<string, string>(),
  };

  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  const sheets = googleSheets({ version: "v4", auth });
  const existingAccounts = await getAccounts(sheetsId, accessToken).catch(() => []);
  const existingAccountIds = new Set(existingAccounts.map((account) => account.id));
  const accountRows = backup.data.accounts.map((account) => {
    const id = existingAccountIds.has(account.id) ? randomUUID() : account.id;
    maps.accountId.set(account.id, id);
    return [
      id,
      account.name,
      account.accountTypeName || "Lainnya",
      account.classification === "liability" ? "liability" : "asset",
      account.initialBalance,
      account.currency || "IDR",
      account.color ?? "",
      account.note ?? "",
      account.tanggalSettlement ?? "",
      account.tanggalJatuhTempo ?? "",
    ];
  });

  const accountNames = accountNameMap(backup.data.accounts);
  const transactionRows = backup.data.transactions.map((transaction) => {
    const id = randomUUID();
    maps.transactionId.set(transaction.id, id);
    const fromId = transaction.fromAccountId ? maps.accountId.get(transaction.fromAccountId) ?? "" : "";
    const toId = transaction.toAccountId ? maps.accountId.get(transaction.toAccountId) ?? "" : "";
    return [
      id,
      normalizeTransactionDate(transaction.date),
      transaction.amount,
      transaction.type === "transfer" ? "Transfer" : transaction.category,
      transaction.note,
      transaction.createdAt || new Date().toISOString(),
      transaction.type === "income" ? "income" : "expense",
      fromId,
      transaction.fromAccountName ?? (transaction.fromAccountId ? accountNames.get(transaction.fromAccountId) ?? "" : ""),
      toId,
      transaction.toAccountName ?? (transaction.toAccountId ? accountNames.get(transaction.toAccountId) ?? "" : ""),
      normalizeTransactionTime(transaction.time),
    ];
  });

  const budgetRows = backup.data.budgets.map((budget) => [budget.categoryName, budget.amount, normalizeMonth(budget.month)]);

  const writes = [];
  if (accountRows.length) {
    writes.push(sheets.spreadsheets.values.append({
      spreadsheetId: sheetsId,
      range: "Akun!A:J",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: accountRows },
    }));
  }
  if (transactionRows.length) {
    writes.push(sheets.spreadsheets.values.append({
      spreadsheetId: sheetsId,
      range: "Transaksi!A:L",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: transactionRows },
    }));
  }
  if (budgetRows.length) {
    writes.push(sheets.spreadsheets.values.append({
      spreadsheetId: sheetsId,
      range: "Budget!A:C",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: budgetRows },
    }));
  }
  await Promise.all(writes);
  if (!options?.skipCommonDbBackedData) {
    await restoreCommonDbBackedData(userId, backup, maps);
  }
}
