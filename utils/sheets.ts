import { sheets as googleSheets } from "@googleapis/sheets";
import { OAuth2Client } from "google-auth-library";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { randomUUID } from "crypto";
import { normalizeTransactionTime } from "@/lib/transaction-time";

const TIMEZONE = "Asia/Jakarta";
const SHEETS_CACHE_TTL_MS = 15_000;
const TRANSACTION_HEADERS = ["id", "date", "amount", "category", "note", "created_at", "type", "fromAccountId", "fromAccountName", "toAccountId", "toAccountName", "time"];

// Simple in-memory TTL cache for Sheets API calls (helps rapid period toggling)
type CacheEntry<T> = { data: T; ts: number };
const sheetsCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | undefined {
  const entry = sheetsCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > SHEETS_CACHE_TTL_MS) {
    sheetsCache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T) {
  sheetsCache.set(key, { data, ts: Date.now() });
}

function getSheetsClient(accessToken: string) {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return googleSheets({ version: "v4", auth });
}

// ─── ONBOARDING ──────────────────────────────────────────────────────────────

export async function createGoogleSheet(
  accessToken: string,
  userName: string
): Promise<string> {
  const sheets = getSheetsClient(accessToken);

  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `Catatuang - ${userName}` },
      sheets: [
        { properties: { title: "Transaksi", sheetId: 0, index: 0 } },
        { properties: { title: "Budget", sheetId: 1, index: 1 } },
        { properties: { title: "Akun", sheetId: 2, index: 2 } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;

  // Header row: double-entry columns — fromAccount (debit/kredit sumber) + toAccount (debit/kredit tujuan)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Transaksi!A1:L1",
    valueInputOption: "RAW",
    requestBody: {
      values: [TRANSACTION_HEADERS],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Budget!A1:C1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["category", "amount", "month"]],
    },
  });

  // Akun sheet headers
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Akun!A1:J1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "id",
        "name",
        "type",
        "classification",
        "balance",
        "currency",
        "color",
        "note",
        "tanggalSettlement",
        "tanggalJatuhTempo",
      ]],
    },
  });

  return spreadsheetId;
}

// ─── TRANSAKSI ────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string;
  time?: string;
  amount: number;
  category: string;
  note: string;
  created_at: string;
  type: "expense" | "income";
  // Double-entry columns (H-K). Legacy rows only have H/I as accountId/accountName →
  // treated as fromAccountId/fromAccountName for backward compat.
  fromAccountId?: string;   // kolom H — akun sumber (uang keluar / debit)
  fromAccountName?: string; // kolom I
  toAccountId?: string;     // kolom J — akun tujuan (uang masuk / kredit)
  toAccountName?: string;   // kolom K
}

export async function appendTransaction(
  sheetsId: string,
  accessToken: string,
  data: Omit<Transaction, "id" | "created_at"> & { id?: string }
): Promise<Transaction> {
  const sheets = getSheetsClient(accessToken);

  // Allow callers to supply the row id (e.g. savings contributions keep the
  // Sheets row id in sync with the Prisma mirror Transaction / contribution).
  const id = data.id ?? randomUUID();
  const created_at = format(
    toZonedTime(new Date(), TIMEZONE),
    "yyyy-MM-dd'T'HH:mm:ssxxx"
  );
  const time = normalizeTransactionTime(data.time);

  const row = [
    id,
    data.date,
    data.amount,
    data.category,
    data.note,
    created_at,
    data.type ?? "expense",
    data.fromAccountId ?? "",
    data.fromAccountName ?? "",
    data.toAccountId ?? "",
    data.toAccountName ?? "",
    time,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range: "Transaksi!A:L",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return { ...data, id, time, created_at };
}

/**
 * Lightweight count helpers — fetch hanya column A (ID) supaya payload kecil.
 * Dipakai oleh cron sync-sheets-counts buat ngisi cache di User table.
 * Note: tidak pakai getCached/setCached supaya cron selalu fetch fresh.
 */
export async function countTransactions(
  sheetsId: string,
  accessToken: string
): Promise<number> {
  const sheets = getSheetsClient(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Transaksi!A2:A",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (res.data.values ?? []).filter((row) => row[0]).length;
}

export async function countAccounts(
  sheetsId: string,
  accessToken: string
): Promise<number> {
  const sheets = getSheetsClient(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Akun!A2:A",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return (res.data.values ?? []).filter((row) => row[0]).length;
}

export async function getTransactions(
  sheetsId: string,
  accessToken: string,
  period?: string
): Promise<Transaction[]> {
  const cacheKey = `tx:${sheetsId}:${accessToken.slice(0, 20)}`;
  let transactions = getCached<Transaction[]>(cacheKey);
  if (!transactions) {
    const sheets = getSheetsClient(accessToken);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetsId,
      range: "Transaksi!A2:L",
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    });

    const rows = res.data.values ?? [];
    transactions = rows
      .filter((row) => row[0])
      .map((row) => {
        // Legacy rows (9 cols): col H = accountId treated as fromAccountId
        const isLegacy = row.length <= 9 && !row[9];
        return {
          id: row[0],
          date: row[1],
          amount: Number(row[2]),
          category: row[3],
          note: row[4] ?? "",
          created_at: row[5] ?? "",
          type: (row[6] === "income" ? "income" : "expense") as "expense" | "income",
          fromAccountId: row[7] || undefined,
          fromAccountName: row[8] || undefined,
          toAccountId: isLegacy ? undefined : (row[9] || undefined),
          toAccountName: isLegacy ? undefined : (row[10] || undefined),
          time: normalizeTransactionTime(row[11]),
        };
      });

    setCached(cacheKey, transactions);
  }

  if (!period) return transactions;

  const jakartaNow = toZonedTime(new Date(), TIMEZONE);
  const todayStr = format(jakartaNow, "yyyy-MM-dd");
  const currentMonth = format(jakartaNow, "yyyy-MM");

  // Semua waktu — kembalikan semua transaksi tanpa filter.
  if (period === "semua" || period === "all") {
    return transactions;
  }

  // Custom range: "custom:2026-04-01:2026-04-12"
  if (period.startsWith("custom:")) {
    const [, from, to] = period.split(":");
    return transactions.filter((t) => t.date >= from && t.date <= to);
  }

  if (period === "bulan ini") {
    return transactions.filter((t) => t.date.startsWith(currentMonth));
  }
  if (period === "bulan lalu") {
    const lastMonth = format(
      new Date(jakartaNow.getFullYear(), jakartaNow.getMonth() - 1, 1),
      "yyyy-MM"
    );
    return transactions.filter((t) => t.date.startsWith(lastMonth));
  }
  if (period === "minggu ini") {
    // Calendar week: Monday–Sunday (matches DB version in utils/db-transactions.ts)
    const day = jakartaNow.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = (day + 6) % 7; // days since Monday
    const monday = new Date(jakartaNow);
    monday.setDate(jakartaNow.getDate() - mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mondayStr = format(monday, "yyyy-MM-dd");
    const sundayStr = format(sunday, "yyyy-MM-dd");
    return transactions.filter((t) => t.date >= mondayStr && t.date <= sundayStr);
  }
  if (period === "hari ini" || period === "today") {
    return transactions.filter((t) => t.date === todayStr);
  }
  if (period === "kemarin" || period === "yesterday") {
    const yesterday = new Date(jakartaNow);
    yesterday.setDate(jakartaNow.getDate() - 1);
    const yesterdayStr = format(yesterday, "yyyy-MM-dd");
    return transactions.filter((t) => t.date === yesterdayStr);
  }
  if (/^\d{4}-\d{2}$/.test(period)) {
    return transactions.filter((t) => t.date.startsWith(period));
  }

  return transactions;
}

export async function updateTransaction(
  sheetsId: string,
  accessToken: string,
  id: string,
  data: Partial<Omit<Transaction, "id" | "created_at">>
): Promise<void> {
  const sheets = getSheetsClient(accessToken);

  const rowIndex = await findRowById(sheets, sheetsId, id);
  if (rowIndex === -1) throw new Error(`Transaction ${id} not found`);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: `Transaksi!A${rowIndex}:L${rowIndex}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const current = res.data.values?.[0] ?? [];

  const updated = [
    current[0],
    data.date ?? current[1],
    data.amount ?? current[2],
    data.category ?? current[3],
    data.note ?? current[4],
    current[5],
    data.type ?? current[6] ?? "expense",
    data.fromAccountId !== undefined ? (data.fromAccountId ?? "") : (current[7] ?? ""),
    data.fromAccountName !== undefined ? (data.fromAccountName ?? "") : (current[8] ?? ""),
    current[9] ?? "",
    current[10] ?? "",
    data.time !== undefined ? normalizeTransactionTime(data.time) : normalizeTransactionTime(current[11]),
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetsId,
    range: `Transaksi!A${rowIndex}:L${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [updated] },
  });
}

export async function deleteTransaction(
  sheetsId: string,
  accessToken: string,
  id: string
): Promise<void> {
  const sheets = getSheetsClient(accessToken);

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetsId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === "Transaksi");
  const sheetId = sheet?.properties?.sheetId ?? 0;

  const rowIndex = await findRowById(sheets, sheetsId, id);
  if (rowIndex === -1) throw new Error(`Transaction ${id} not found`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetsId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}

// ─── BUDGET BACKUP ────────────────────────────────────────────────────────────

export async function appendBudgetBackup(
  sheetsId: string,
  accessToken: string,
  category: string,
  amount: number,
  month: string
): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range: "Budget!A:C",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[category, amount, month]] },
  });
}

// ─── AKUN / ASSET / LIABILITIES ───────────────────────────────────────────────

export interface AccountData {
  id: string;
  name: string;
  type: string;
  classification: string; // "asset" | "liability"
  balance: number;
  currency: string;
  color: string | null;
  note: string | null;
  tanggalSettlement: number | null;
  tanggalJatuhTempo: number | null;
}

export async function appendAccount(
  sheetsId: string,
  accessToken: string,
  data: Omit<AccountData, "id">
): Promise<AccountData> {
  const sheets = getSheetsClient(accessToken);

  const id = randomUUID();
  const row = [
    id,
    data.name,
    data.type,
    data.classification,
    data.balance,
    data.currency,
    data.color ?? "",
    data.note ?? "",
    data.tanggalSettlement ?? "",
    data.tanggalJatuhTempo ?? "",
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range: "Akun!A:J",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return { id, ...data };
}

export async function getAccounts(
  sheetsId: string,
  accessToken: string
): Promise<AccountData[]> {
  const cacheKey = `acc:${sheetsId}:${accessToken.slice(0, 20)}`;
  let accounts = getCached<AccountData[]>(cacheKey);
  if (accounts) return accounts;

  const sheets = getSheetsClient(accessToken);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Akun!A2:J",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const rows = res.data.values ?? [];
  accounts = rows
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0],
      name: row[1],
      type: row[2],
      classification: row[3],
      balance: Number(row[4]) || 0,
      currency: row[5] || "IDR",
      color: row[6] || null,
      note: row[7] || null,
      tanggalSettlement: row[8] ? Number(row[8]) : null,
      tanggalJatuhTempo: row[9] ? Number(row[9]) : null,
    }));

  setCached(cacheKey, accounts);
  return accounts;
}

export async function updateAccount(
  sheetsId: string,
  accessToken: string,
  id: string,
  data: Partial<Omit<AccountData, "id">>
): Promise<void> {
  const sheets = getSheetsClient(accessToken);

  const rowIndex = await findRowByIdInSheet(sheets, sheetsId, "Akun", id);
  if (rowIndex === -1) return; // Account not found in sheets, skip

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: `Akun!A${rowIndex}:J${rowIndex}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const current = res.data.values?.[0] ?? [];

  const updated = [
    current[0],
    data.name ?? current[1],
    data.type ?? current[2],
    data.classification ?? current[3],
    data.balance ?? current[4],
    data.currency ?? current[5],
    data.color ?? current[6] ?? "",
    data.note ?? current[7] ?? "",
    data.tanggalSettlement ?? current[8] ?? "",
    data.tanggalJatuhTempo ?? current[9] ?? "",
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetsId,
    range: `Akun!A${rowIndex}:J${rowIndex}`,
    valueInputOption: "RAW",
    requestBody: { values: [updated] },
  });
}

export async function deleteAccount(
  sheetsId: string,
  accessToken: string,
  id: string
): Promise<void> {
  const sheets = getSheetsClient(accessToken);

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetsId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === "Akun");
  const sheetId = sheet?.properties?.sheetId ?? 2;

  const rowIndex = await findRowByIdInSheet(sheets, sheetsId, "Akun", id);
  if (rowIndex === -1) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetsId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}

// ─── MIGRATION ────────────────────────────────────────────────────────────────

export async function ensureTransaksiHeader(sheetsId: string, accessToken: string): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Transaksi!A1:L1",
  });
  const header = res.data.values?.[0] ?? [];
  if (header.length < 12) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetsId,
      range: "Transaksi!A1:L1",
      valueInputOption: "RAW",
      requestBody: {
        values: [TRANSACTION_HEADERS],
      },
    });
  }
}

export async function ensureAccountHeader(sheetsId: string, accessToken: string): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Akun!A1:J1",
  });
  const header = res.data.values?.[0] ?? [];
  if (header.length < 10) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetsId,
      range: "Akun!A1:J1",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          "id",
          "name",
          "type",
          "classification",
          "balance",
          "currency",
          "color",
          "note",
          "tanggalSettlement",
          "tanggalJatuhTempo",
        ]],
      },
    });
  }
}

export async function clearBudgetInSheetData(sheetsId: string, accessToken: string): Promise<void> {
  const sheets = getSheetsClient(accessToken);
  await Promise.all([
    ensureTransaksiHeader(sheetsId, accessToken),
    ensureAccountHeader(sheetsId, accessToken),
  ]);
  await sheets.spreadsheets.values.batchClear({
    spreadsheetId: sheetsId,
    requestBody: {
      ranges: ["Transaksi!A2:L", "Budget!A2:C", "Akun!A2:J"],
    },
  });
  sheetsCache.delete(`tx:${sheetsId}:${accessToken.slice(0, 20)}`);
  sheetsCache.delete(`acc:${sheetsId}:${accessToken.slice(0, 20)}`);
}

/**
 * @deprecated Cache-write helper kept as escape hatch only. App now reads balance
 * via `computeAccountBalances` (pure-ledger). Avoid calling in new code.
 */
export async function updateAccountBalance(
  sheetsId: string,
  accessToken: string,
  id: string,
  delta: number,
  preloadedAccounts?: AccountData[]
): Promise<void> {
  const accounts = preloadedAccounts ?? await getAccounts(sheetsId, accessToken);
  const account = accounts.find((a) => a.id === id);
  if (!account) return;
  await updateAccount(sheetsId, accessToken, id, { balance: account.balance + delta });
}

export { computeAccountBalancesFromTx } from "./sheets-ledger";
import { computeAccountBalancesFromTx as _computeBalances } from "./sheets-ledger";

export async function computeAccountBalances(
  sheetsId: string,
  accessToken: string,
  opts?: { preloadedAccounts?: AccountData[]; preloadedTransactions?: Transaction[] }
): Promise<Map<string, number>> {
  const [accounts, transactions] = await Promise.all([
    opts?.preloadedAccounts ?? getAccounts(sheetsId, accessToken),
    opts?.preloadedTransactions ?? getTransactions(sheetsId, accessToken),
  ]);
  return _computeBalances(accounts, transactions);
}

/**
 * Like `getAccounts` but with `balance` overridden by ledger-computed value.
 * Use this for any read path that displays saldo / networth. The cached
 * `Akun!E balance` column is intentionally ignored to prevent drift.
 */
export async function getAccountsWithBalance(
  sheetsId: string,
  accessToken: string,
  opts?: { preloadedTransactions?: Transaction[] }
): Promise<AccountData[]> {
  const [accounts, transactions] = await Promise.all([
    getAccounts(sheetsId, accessToken),
    opts?.preloadedTransactions ?? getTransactions(sheetsId, accessToken),
  ]);
  const computed = _computeBalances(accounts, transactions);
  return accounts.map((a) => ({ ...a, balance: computed.get(a.id) ?? 0 }));
}

export async function getTransactionRow(
  sheetsId: string,
  accessToken: string,
  id: string
): Promise<Transaction | null> {
  const sheets = getSheetsClient(accessToken);
  const rowIndex = await findRowById(sheets, sheetsId, id);
  if (rowIndex === -1) return null;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: `Transaksi!A${rowIndex}:L${rowIndex}`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const row = res.data.values?.[0];
  if (!row || !row[0]) return null;
  const isLegacy = row.length <= 9 && !row[9];
  return {
    id: row[0],
    date: row[1],
    amount: Number(row[2]),
    category: row[3],
    note: row[4] ?? "",
    created_at: row[5] ?? "",
    type: (row[6] === "income" ? "income" : "expense") as "expense" | "income",
    fromAccountId: row[7] || undefined,
    fromAccountName: row[8] || undefined,
    toAccountId: isLegacy ? undefined : (row[9] || undefined),
    toAccountName: isLegacy ? undefined : (row[10] || undefined),
    time: normalizeTransactionTime(row[11]),
  };
}

// ─── HELPER ───────────────────────────────────────────────────────────────────

 
async function findRowByIdInSheet(sheets: any, sheetsId: string, sheetTitle: string, id: string): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: `${sheetTitle}!A:A`,
  });
  const rows: string[][] = res.data.values ?? [];
  const index = rows.findIndex((row) => row[0] === id);
  return index === -1 ? -1 : index + 1;
}

// ─── HELPER ───────────────────────────────────────────────────────────────────

 
async function findRowById(sheets: any, sheetsId: string, id: string): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Transaksi!A:A",
  });
  const rows: string[][] = res.data.values ?? [];
  const index = rows.findIndex((row) => row[0] === id);
  return index === -1 ? -1 : index + 1;
}
