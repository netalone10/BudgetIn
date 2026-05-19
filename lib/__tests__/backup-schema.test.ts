// Mock semua dependencies yang membutuhkan runtime server/DB
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/utils/token", () => ({ getValidToken: jest.fn() }));
jest.mock("@/utils/sheets", () => ({
  ensureAccountHeader: jest.fn(),
  ensureTransaksiHeader: jest.fn(),
  getAccounts: jest.fn(),
  getTransactions: jest.fn(),
}));
jest.mock("@/utils/account-types", () => ({ ensureDefaultAccountTypes: jest.fn() }));
jest.mock("@googleapis/sheets", () => ({ sheets: jest.fn() }));
jest.mock("google-auth-library", () => ({ OAuth2Client: jest.fn().mockImplementation(() => ({ setCredentials: jest.fn() })) }));

import {
  parseBackupPayload,
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_RECORDS,
  type BudgetInBackup,
} from "@/lib/backup";

// ── Helper: buat backup minimal yang valid ────────────────────────────────────

function makeValidBackup(overrides: Partial<BudgetInBackup> = {}): BudgetInBackup {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appName: "BudgetIn",
    exportedAt: new Date().toISOString(),
    source: {
      storageMode: "database",
      userId: "user-123",
      email: "test@example.com",
      name: "Test User",
    },
    summary: {
      categories: 0,
      accountTypes: 0,
      accounts: 0,
      transactions: 0,
      budgets: 0,
      savingsGoals: 0,
      savingsContributions: 0,
      recurringTransactions: 0,
      recurringOccurrences: 0,
      totalRecords: 0,
    },
    data: {
      categories: [],
      accountTypes: [],
      accounts: [],
      transactions: [],
      budgets: [],
      savingsGoals: [],
      savingsContributions: [],
      recurringTransactions: [],
      recurringOccurrences: [],
    },
    ...overrides,
  };
}

// ── parseBackupPayload ────────────────────────────────────────────────────────

describe("parseBackupPayload — validasi dasar", () => {
  it("menerima backup valid schema v2", () => {
    const backup = makeValidBackup();
    expect(() => parseBackupPayload(backup)).not.toThrow();
  });

  it("menerima backup schema v1 (backward compat)", () => {
    const backup = makeValidBackup({ schemaVersion: 1 });
    expect(() => parseBackupPayload(backup)).not.toThrow();
  });

  it("menolak payload null", () => {
    expect(() => parseBackupPayload(null)).toThrow("File backup tidak valid");
  });

  it("menolak payload bukan object", () => {
    expect(() => parseBackupPayload("string")).toThrow("File backup tidak valid");
    expect(() => parseBackupPayload(42)).toThrow("File backup tidak valid");
  });

  it("menolak appName yang salah", () => {
    const backup = makeValidBackup({ appName: "OtherApp" as "BudgetIn" });
    expect(() => parseBackupPayload(backup)).toThrow("Versi backup tidak didukung");
  });

  it("menolak schemaVersion yang tidak didukung", () => {
    const backup = makeValidBackup({ schemaVersion: 99 });
    expect(() => parseBackupPayload(backup)).toThrow("Versi backup tidak didukung");
  });

  it("menolak backup tanpa data", () => {
    const backup = { ...makeValidBackup(), data: undefined };
    expect(() => parseBackupPayload(backup)).toThrow();
  });

  it("menolak backup tanpa source", () => {
    const backup = { ...makeValidBackup(), source: undefined };
    expect(() => parseBackupPayload(backup)).toThrow();
  });
});

describe("parseBackupPayload — validasi array data", () => {
  it("menolak jika salah satu array data tidak ada", () => {
    const backup = makeValidBackup();
    const dataWithMissing = { ...backup.data, transactions: undefined };
    expect(() => parseBackupPayload({ ...backup, data: dataWithMissing })).toThrow(
      "Data backup tidak lengkap"
    );
  });

  it("menolak jika data bukan array (object)", () => {
    const backup = makeValidBackup();
    const dataWithWrong = { ...backup.data, categories: {} };
    expect(() => parseBackupPayload({ ...backup, data: dataWithWrong })).toThrow(
      "Data backup tidak lengkap"
    );
  });
});

describe("parseBackupPayload — batas ukuran", () => {
  it("menolak backup yang melebihi MAX_BACKUP_RECORDS", () => {
    const backup = makeValidBackup();
    // Isi transactions dengan lebih dari MAX_BACKUP_RECORDS item
    backup.data.transactions = Array.from({ length: MAX_BACKUP_RECORDS + 1 }, (_, i) => ({
      id: `tx-${i}`,
      date: "2026-01-01",
      time: "00:00",
      amount: 10000,
      category: "Makan",
      note: "",
      type: "expense" as const,
      fromAccountId: null,
      fromAccountName: null,
      toAccountId: null,
      toAccountName: null,
      transferId: null,
      isInitialBalance: false,
      createdAt: new Date().toISOString(),
    }));
    expect(() => parseBackupPayload(backup)).toThrow("Backup terlalu besar");
  });
});

describe("parseBackupPayload — migrasi v1 ke v2", () => {
  it("mengkonversi recurringBills ke recurringTransactions", () => {
    const v1Backup = {
      ...makeValidBackup({ schemaVersion: 1 }),
      data: {
        ...makeValidBackup().data,
        recurringBills: [
          {
            id: "bill-1",
            name: "Tagihan Listrik",
            amount: 500000,
            type: "expense",
            frequency: "monthly",
            interval: 1,
            nextDueDate: "2026-06-01T00:00:00.000Z",
            isActive: true,
            autoRecord: false,
            reminderDays: [3],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        recurringTransactions: undefined,
        billPayments: [],
        recurringOccurrences: undefined,
      },
    };

    const result = parseBackupPayload(v1Backup);
    expect(result.data.recurringTransactions).toHaveLength(1);
    expect(result.data.recurringTransactions[0].name).toBe("Tagihan Listrik");
    expect(result.data.recurringTransactions[0].type).toBe("expense");
  });

  it("mengkonversi billPayments ke recurringOccurrences", () => {
    const v1Backup = {
      ...makeValidBackup({ schemaVersion: 1 }),
      data: {
        ...makeValidBackup().data,
        recurringBills: [],
        recurringTransactions: [],
        billPayments: [
          {
            id: "pay-1",
            billId: "bill-1",
            amount: 500000,
            paidAt: "2026-05-01T00:00:00.000Z",
            paymentMonth: "2026-05",
          },
        ],
        recurringOccurrences: undefined,
      },
    };

    const result = parseBackupPayload(v1Backup);
    expect(result.data.recurringOccurrences).toHaveLength(1);
    expect(result.data.recurringOccurrences[0].recurringId).toBe("bill-1");
  });
});

describe("parseBackupPayload — tidak menyimpan secrets", () => {
  it("source tidak mengandung field token/password", () => {
    const backup = makeValidBackup();
    const result = parseBackupPayload(backup);
    const sourceKeys = Object.keys(result.source);
    expect(sourceKeys).not.toContain("accessToken");
    expect(sourceKeys).not.toContain("refreshToken");
    expect(sourceKeys).not.toContain("password");
    expect(sourceKeys).not.toContain("token");
  });
});
