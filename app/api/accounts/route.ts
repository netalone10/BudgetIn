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
import { sheets as googleSheets } from "@googleapis/sheets";
import { OAuth2Client } from "google-auth-library";
import {
  appendAccount,
  appendTransaction,
  getAccounts,
  updateAccount,
  updateAccountBalance,
  ensureTransaksiHeader,
  ensureAccountHeader,
} from "@/utils/sheets";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // Jika user Google Sheets, baca dari Sheets dan hitung total
  if (user?.sheetsId) {
    try {
      const accessToken = await getValidToken(session.userId);
      const auth = new OAuth2Client();
      auth.setCredentials({ access_token: accessToken });
      const sheets = googleSheets({ version: "v4", auth });

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
        await sheets.spreadsheets.values.update({
          spreadsheetId: user.sheetsId,
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

      await Promise.all([
        ensureAccountHeader(user.sheetsId, accessToken).catch(() => {}),
        ensureTransaksiHeader(user.sheetsId, accessToken).catch(() => {}),
      ]);
      const sheetsAccounts = await getAccounts(user.sheetsId, accessToken);

      // Hitung total assets dan liabilities dari Sheets
      let assets = 0;
      let liabilities = 0;
      const accounts = sheetsAccounts.map((a) => ({
        id: a.id,
        name: a.name,
        accountType: { name: a.type, classification: a.classification },
        currentBalance: a.balance.toString(),
        currency: a.currency,
        color: a.color,
        note: a.note,
        icon: null,
        transactionCount: 0,
        tanggalSettlement: a.tanggalSettlement,
        tanggalJatuhTempo: a.tanggalJatuhTempo,
      }));

      for (const acc of accounts) {
        const balance = parseFloat(acc.currentBalance) || 0;
        if (acc.accountType.classification === "liability") {
          liabilities += balance;
        } else {
          assets += balance;
        }
      }

      const netWorth = assets - liabilities;

      return NextResponse.json({
        accounts,
        summary: {
          assets: assets.toString(),
          liabilities: liabilities.toString(),
          netWorth: netWorth.toString(),
        },
      });
    } catch (e) {
      console.error("Failed to read accounts from Sheets:", e);
      return NextResponse.json({ error: "Gagal mengambil data dari Google Sheets" }, { status: 500 });
    }
  }

  // User non-Google: baca dari Prisma
  await ensureDefaultAccountTypes(session.userId);
  const accounts = await getAccountBalances(session.userId);
  const summary = calculateNetWorth(accounts);

  return NextResponse.json({
    accounts: accounts.map(serializeAccountWithBalance),
    summary: serializeNetWorth(summary),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { accountTypeId, accountTypeName, classification, name, initialBalance, currency, color, icon, note, tanggalSettlement, tanggalJatuhTempo } = body;

  // Validasi
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nama akun tidak boleh kosong." }, { status: 400 });
  }
  if (name.trim().length > 50) {
    return NextResponse.json({ error: "Nama akun maksimal 50 karakter." }, { status: 400 });
  }

  // Parse initialBalance
  let parsedBalance = 0;
  if (initialBalance !== undefined && initialBalance !== null && initialBalance !== "") {
    parsedBalance = Number(initialBalance);
    if (!isFinite(parsedBalance) || parsedBalance < 0) {
      return NextResponse.json({ error: "Saldo awal tidak valid." }, { status: 400 });
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // Jika user Google Sheets, simpan ke Sheets saja (tidak ke Prisma)
  if (user?.sheetsId) {
    // Validasi untuk Sheets user
    if (!accountTypeName) {
      return NextResponse.json({ error: "Tipe akun harus dipilih." }, { status: 400 });
    }

    // Validasi Kartu Kredit
    if (accountTypeName === "Kartu Kredit") {
      if (!tanggalSettlement || typeof tanggalSettlement !== "number" || tanggalSettlement < 1 || tanggalSettlement > 31) {
        return NextResponse.json({ error: "Tanggal Settlement (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
      }
      if (!tanggalJatuhTempo || typeof tanggalJatuhTempo !== "number" || tanggalJatuhTempo < 1 || tanggalJatuhTempo > 31) {
        return NextResponse.json({ error: "Tanggal Jatuh Tempo (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
      }
    }

    try {
      const accessToken = await getValidToken(session.userId);
      const classif = classification || "asset";

      // Create with balance 0 — initial balance will be set via Saldo Awal transaction
      const newAccount = await appendAccount(user.sheetsId, accessToken, {
        name: name.trim(),
        type: accountTypeName,
        classification: classif,
        balance: 0,
        currency: currency ?? "IDR",
        color: color ?? null,
        note: note ?? "",
        tanggalSettlement: accountTypeName === "Kartu Kredit" ? tanggalSettlement : null,
        tanggalJatuhTempo: accountTypeName === "Kartu Kredit" ? tanggalJatuhTempo : null,
      });

      // Record initial balance as a transaction so it's auditable and revertable on delete
      if (parsedBalance > 0) {
        const today = new Date().toISOString().slice(0, 10);
        // Asset: income (money flows in). Liability: expense (you took on debt).
        if (classif === "asset") {
          await appendTransaction(user.sheetsId, accessToken, {
            date: today,
            amount: parsedBalance,
            category: "Saldo Awal",
            note: `Saldo awal akun ${name.trim()}`,
            type: "income",
            toAccountId: newAccount.id,
            toAccountName: name.trim(),
          });
        } else {
          await appendTransaction(user.sheetsId, accessToken, {
            date: today,
            amount: parsedBalance,
            category: "Saldo Awal",
            note: `Saldo awal akun ${name.trim()}`,
            type: "expense",
            fromAccountId: newAccount.id,
            fromAccountName: name.trim(),
          });
        }
        // Delta: asset income→+, liability expense→+ (owe more). Both result in +parsedBalance stored.
        await updateAccountBalance(user.sheetsId, accessToken, newAccount.id, parsedBalance).catch(() => {});
      }

      return NextResponse.json({
        account: {
          ...newAccount,
          currentBalance: parsedBalance.toString(),
          accountType: { name: accountTypeName, classification: classif },
          icon: null,
          transactionCount: 0,
          tanggalSettlement: accountTypeName === "Kartu Kredit" ? tanggalSettlement : null,
          tanggalJatuhTempo: accountTypeName === "Kartu Kredit" ? tanggalJatuhTempo : null,
        }
      }, { status: 201 });
    } catch (e) {
      console.error("Failed to create account in Sheets:", e);
      return NextResponse.json({ error: "Gagal membuat akun di Google Sheets" }, { status: 500 });
    }
  }

  // User non-Google: simpan ke Prisma
  if (!accountTypeId) {
    return NextResponse.json({ error: "Tipe akun harus dipilih." }, { status: 400 });
  }

  const accountType = await prisma.accountType.findUnique({ where: { id: accountTypeId } });
  if (!accountType || accountType.userId !== session.userId || !accountType.isActive) {
    return NextResponse.json({ error: "Tipe akun tidak valid." }, { status: 400 });
  }

  if (accountType.name === "Kartu Kredit") {
    if (!tanggalSettlement || typeof tanggalSettlement !== "number" || tanggalSettlement < 1 || tanggalSettlement > 31) {
      return NextResponse.json({ error: "Tanggal Settlement (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
    }
    if (!tanggalJatuhTempo || typeof tanggalJatuhTempo !== "number" || tanggalJatuhTempo < 1 || tanggalJatuhTempo > 31) {
      return NextResponse.json({ error: "Tanggal Jatuh Tempo (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
    }
  }

  const parsedBalanceDecimal = new Decimal(parsedBalance);
  const today = new Date().toISOString().slice(0, 10);

  const account = await prisma.$transaction(async (tx) => {
    const newAccount = await tx.account.create({
      data: {
        userId: session.userId,
        accountTypeId,
        name: name.trim(),
        initialBalance: parsedBalanceDecimal,
        currency: currency ?? "IDR",
        color: color ?? null,
        icon: icon ?? null,
        note: note ?? "",
        ...(accountType.name === "Kartu Kredit" && {
          tanggalSettlement,
          tanggalJatuhTempo,
        }),
      },
    });

    if (parsedBalanceDecimal.greaterThan(0)) {
      await tx.transaction.create({
        data: {
          userId: session.userId,
          accountId: newAccount.id,
          type: "income",
          amount: parsedBalanceDecimal,
          category: "Saldo Awal",
          date: today,
          note: `Saldo awal akun ${newAccount.name}`,
          isInitialBalance: true,
        },
      });
    }

    return newAccount;
  });

  return NextResponse.json({ account }, { status: 201 });
}

// Migration endpoint: merge local Prisma accounts to Google Sheets
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  if (!user?.sheetsId) {
    return NextResponse.json({ error: "Anda tidak menggunakan Google Sheets" }, { status: 400 });
  }

  try {
    const accessToken = await getValidToken(session.userId);
    const auth = new OAuth2Client();
    auth.setCredentials({ access_token: accessToken });
    const sheets = googleSheets({ version: "v4", auth });

    // Cek apakah sheet "Akun" sudah ada
    const meta = await sheets.spreadsheets.get({ spreadsheetId: user.sheetsId });
    const hasAkunSheet = meta.data.sheets?.some((s: any) => s.properties?.title === "Akun");

    if (!hasAkunSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: user.sheetsId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: "Akun", sheetId: 2 } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: user.sheetsId,
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

    await ensureAccountHeader(user.sheetsId, accessToken).catch(() => {});
    // Ambil semua akun dari Sheets
    const existingSheetsAccounts = await getAccounts(user.sheetsId, accessToken);
    const existingSheetIds = new Set(existingSheetsAccounts.map((a) => a.id));

    // Ambil semua akun dari Prisma
    await ensureDefaultAccountTypes(session.userId);
    const dbAccounts = await getAccountBalances(session.userId);

    let migrated = 0;
    let updated = 0;

    for (const acc of dbAccounts) {
      if (!existingSheetIds.has(acc.id)) {
        // Akun baru: append ke Sheets
        await appendAccount(user.sheetsId, accessToken, {
          name: acc.name,
          type: acc.accountType.name,
          classification: acc.accountType.classification,
          balance: acc.currentBalance.toNumber(),
          currency: acc.currency,
          color: acc.color,
          note: acc.note,
          tanggalSettlement: acc.tanggalSettlement,
          tanggalJatuhTempo: acc.tanggalJatuhTempo,
        });
        migrated++;
      } else {
        // Update saldo jika sudah ada
        await updateAccount(user.sheetsId, accessToken, acc.id, {
          balance: acc.currentBalance.toNumber(),
        });
        updated++;
      }
    }

    return NextResponse.json({ 
      message: `Migrated ${migrated} new accounts, updated ${updated} existing accounts`,
      migrated,
      updated,
    });
  } catch (e) {
    console.error("Migration failed:", e);
    return NextResponse.json({ error: "Gagal melakukan migrasi" }, { status: 500 });
  }
}
