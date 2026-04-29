import { sheets as googleSheets } from "@googleapis/sheets";
import { OAuth2Client } from "google-auth-library";

function getSheetsClient(accessToken: string) {
  const auth = new OAuth2Client();
  auth.setCredentials({ access_token: accessToken });
  return googleSheets({ version: "v4", auth });
}

export async function appendBillPaymentToSheet(
  sheetsId: string,
  accessToken: string,
  data: {
    date: Date;
    amount: number;
    category: string;
    type: "expense";
    note: string;
    account: string;
    fromAccountId?: string;
  }
) {
  const sheets = getSheetsClient(accessToken);

  const dateStr = data.date.toISOString().split("T")[0];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range: "Transaksi!A:K",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        crypto.randomUUID(),
        dateStr,
        data.amount,
        data.category,
        data.note,
        new Date().toISOString(),
        data.type,
        data.fromAccountId ?? "",
        data.account,
        "",
        "",
      ]],
    },
  });
}
