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
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId!;

  // Header row: tambah kolom "type" (expense | income)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Transaksi!A1:G1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["id", "date", "amount", "category", "note", "created_at", "type"]],
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
  type: "expense" | "income"; // kolom G — default "expense" untuk backward compat
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
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range: "Transaksi!A:G",
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
    range: "Transaksi!A2:G",
  });

  const rows = res.data.values ?? [];
  const transactions: Transaction[] = rows
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0],
      date: row[1],
      amount: Number(row[2]),
      category: row[3],
      note: row[4] ?? "",
      created_at: row[5] ?? "",
      type: (row[6] === "income" ? "income" : "expense") as "expense" | "income",
    }));

  if (!period) return transactions;

  const jakartaNow = toZonedTime(new Date(), TIMEZONE);
  const todayStr = format(jakartaNow, "yyyy-MM-dd");
  const currentMonth = format(jakartaNow, "yyyy-MM");

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
