import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import {
  getAccountBalances,
  calculateNetWorth,
  serializeAccountWithBalance,
  serializeNetWorth,
} from "@/utils/account-balance";
import { ensureDefaultAccountTypes } from "@/utils/account-types";
import { getValidToken } from "@/utils/token";
import { google } from "googleapis";
import { appendAccount, getAccounts, updateAccount, AccountData } from "@/utils/sheets";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDefaultAccountTypes(session.userId);

  const accounts = await getAccountBalances(session.userId);
  const summary = calculateNetWorth(accounts);

  // Sync ke Google Sheets jika user menggunakan Sheets
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (user?.sheetsId) {
    try {
      const accessToken = await getValidToken(session.userId);
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const sheets = google.sheets({ version: "v4", auth });

      // Cek apakah sheet "Akun" sudah ada, kalau belum buat baru
      const meta = await sheets.spreadsheets.get({ spreadsheetId: user.sheetsId });
      const hasAkunSheet = meta.data.sheets?.some((s: any) => s.properties?.title === "Akun");

      if (!hasAkunSheet) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: user.sheetsId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "Akun", sheetId: 2 } } }],
          },
        });
        // Tambah header
        await sheets.spreadsheets.values.update({
          spreadsheetId: user.sheetsId,
          range: "Akun!A1:H1",
          valueInputOption: "RAW",
          requestBody: { values: [["id", "name", "type", "classification", "balance", "currency", "color", "note"]] },
        });
      }

      const existingSheetsAccounts = await getAccounts(user.sheetsId, accessToken);
      const existingSheetIds = new Set(existingSheetsAccounts.map((a) => a.id));

      // Sync akun yang ada di DB tapi belum di Sheets
      for (const acc of accounts) {
        if (!existingSheetIds.has(acc.id)) {
          await appendAccount(user.sheetsId, accessToken, {
            name: acc.name,
            type: acc.accountType.name,
            classification: acc.accountType.classification,
            balance: acc.currentBalance.toNumber(),
            currency: acc.currency,
            color: acc.color,
            note: acc.note,
          });
        } else {
          // Update saldo jika sudah ada di Sheets
          await updateAccount(user.sheetsId, accessToken, acc.id, {
            balance: acc.currentBalance.toNumber(),
          });
        }
      }
    } catch (e) {
      console.error("Failed to sync accounts to Sheets:", e);
    }
  }

  return NextResponse.json({
    accounts: accounts.map(serializeAccountWithBalance),
    summary: serializeNetWorth(summary),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { accountTypeId, name, initialBalance, currency, color, icon, note, tanggalSettlement, tanggalJatuhTempo } = body;

  // Validasi
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nama akun tidak boleh kosong." }, { status: 400 });
  }
  if (name.trim().length > 50) {
    return NextResponse.json({ error: "Nama akun maksimal 50 karakter." }, { status: 400 });
  }
  if (!accountTypeId) {
    return NextResponse.json({ error: "Tipe akun harus dipilih." }, { status: 400 });
  }

  // Pastikan accountTypeId milik user dan aktif
  const accountType = await prisma.accountType.findUnique({ where: { id: accountTypeId } });
  if (!accountType || accountType.userId !== session.userId || !accountType.isActive) {
    return NextResponse.json({ error: "Tipe akun tidak valid." }, { status: 400 });
  }

  // Validasi Kartu Kredit: wajib ada tanggalSettlement dan tanggalJatuhTempo
  if (accountType.name === "Kartu Kredit") {
    if (!tanggalSettlement || typeof tanggalSettlement !== "number" || tanggalSettlement < 1 || tanggalSettlement > 31) {
      return NextResponse.json({ error: "Tanggal Settlement (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
    }
    if (!tanggalJatuhTempo || typeof tanggalJatuhTempo !== "number" || tanggalJatuhTempo < 1 || tanggalJatuhTempo > 31) {
      return NextResponse.json({ error: "Tanggal Jatuh Tempo (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
    }
  }

  // Parse initialBalance
  let parsedBalance = new Decimal(0);
  if (initialBalance !== undefined && initialBalance !== null && initialBalance !== "") {
    parsedBalance = new Decimal(Number(initialBalance));
    if (!parsedBalance.isFinite() || parsedBalance.isNegative()) {
      return NextResponse.json({ error: "Saldo awal tidak valid." }, { status: 400 });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // Create akun + transaksi saldo awal secara atomic
  const account = await prisma.$transaction(async (tx) => {
    const newAccount = await tx.account.create({
      data: {
        userId: session.userId,
        accountTypeId,
        name: name.trim(),
        initialBalance: parsedBalance,
        currency: currency ?? "IDR",
        color: color ?? null,
        icon: icon ?? null,
        note: note ?? "",
        // Kartu Kredit fields
        ...(accountType.name === "Kartu Kredit" && {
          tanggalSettlement,
          tanggalJatuhTempo,
        }),
      },
    });

    // Insert transaksi saldo awal jika > 0
    if (parsedBalance.greaterThan(0)) {
      await tx.transaction.create({
        data: {
          userId: session.userId,
          accountId: newAccount.id,
          type: "income",
          amount: parsedBalance,
          category: "Saldo Awal",
          date: today,
          note: `Saldo awal akun ${newAccount.name}`,
          isInitialBalance: true,
        },
      });
    }

    return newAccount;
  });

  // Sync ke Google Sheets jika user menggunakan Sheets
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (user?.sheetsId) {
    try {
      const accessToken = await getValidToken(session.userId);
      await appendAccount(user.sheetsId, accessToken, {
        name: account.name,
        type: accountType.name,
        classification: accountType.classification,
        balance: parsedBalance.toNumber(),
        currency: account.currency,
        color: account.color,
        note: account.note,
      });
    } catch (e) {
      console.error("Failed to sync new account to Sheets:", e);
    }
  }

  return NextResponse.json({ account }, { status: 201 });
}
