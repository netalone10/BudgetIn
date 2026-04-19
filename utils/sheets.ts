import { google } from "googleapis";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { v4 as uuidv4 } from "uuid";

const TIMEZONE = "Asia/Jakarta";

function getSheetsClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
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
    range: "Transaksi!A1:K1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["id", "date", "amount", "category", "note", "created_at", "type", "fromAccountId", "fromAccountName", "toAccountId", "toAccountName"]],
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
    range: "Akun!A1:H1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["id", "name", "type", "classification", "balance", "currency", "color", "note"]],
    },
  });

  return spreadsheetId;
}

// ─── TRANSAKSI ────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  date: string;
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
  data: Omit<Transaction, "id" | "created_at">
): Promise<Transaction> {
  const sheets = getSheetsClient(accessToken);

  const id = uuidv4();
  const created_at = format(
    toZonedTime(new Date(), TIMEZONE),
    "yyyy-MM-dd'T'HH:mm:ssxxx"
  );

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
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range: "Transaksi!A:K",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [row] },
  });

  return { id, ...data, created_at };
}

export async function getTransactions(
  sheetsId: string,
  accessToken: string,
  period?: string
): Promise<Transaction[]> {
  const sheets = getSheetsClient(accessToken);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Transaksi!A2:K",
  });

  const rows = res.data.values ?? [];
  const transactions: Transaction[] = rows
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
      };
    });

  if (!period) return transactions;

  const jakartaNow = toZonedTime(new Date(), TIMEZONE);
  const todayStr = format(jakartaNow, "yyyy-MM-dd");
  const currentMonth = format(jakartaNow, "yyyy-MM");

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
    const weekAgo = format(
      new Date(jakartaNow.getTime() - 7 * 24 * 60 * 60 * 1000),
      "yyyy-MM-dd"
    );
    return transactions.filter((t) => t.date >= weekAgo && t.date <= todayStr);
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
    range: `Transaksi!A${rowIndex}:G${rowIndex}`,
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
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetsId,
    range: `Transaksi!A${rowIndex}:G${rowIndex}`,
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
}

export async function appendAccount(
  sheetsId: string,
  accessToken: string,
  data: Omit<AccountData, "id">
): Promise<AccountData> {
  const sheets = getSheetsClient(accessToken);

  const id = uuidv4();
  const row = [
    id,
    data.name,
    data.type,
    data.classification,
    data.balance,
    data.currency,
    data.color ?? "",
    data.note ?? "",
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range: "Akun!A:H",
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
  const sheets = getSheetsClient(accessToken);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Akun!A2:H",
  });

  const rows = res.data.values ?? [];
  return rows
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
    }));
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
    range: `Akun!A${rowIndex}:H${rowIndex}`,
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
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetsId,
    range: `Akun!A${rowIndex}:H${rowIndex}`,
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
    range: "Transaksi!A1:K1",
  });
  const header = res.data.values?.[0] ?? [];
  if (header.length < 11) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetsId,
      range: "Transaksi!A1:K1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["id", "date", "amount", "category", "note", "created_at", "type", "fromAccountId", "fromAccountName", "toAccountId", "toAccountName"]],
      },
    });
  }
}

export async function updateAccountBalance(
  sheetsId: string,
  accessToken: string,
  id: string,
  delta: number
): Promise<void> {
  const accounts = await getAccounts(sheetsId, accessToken);
  const account = accounts.find((a) => a.id === id);
  if (!account) return;
  await updateAccount(sheetsId, accessToken, id, { balance: account.balance + delta });
}

// ─── HELPER ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findRowById(sheets: any, sheetsId: string, id: string): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range: "Transaksi!A:A",
  });
  const rows: string[][] = res.data.values ?? [];
  const index = rows.findIndex((row) => row[0] === id);
  return index === -1 ? -1 : index + 1;
}
