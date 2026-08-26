import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  getAccounts,
  getAccountsWithBalance,
  updateAccount,
  ensureTransaksiHeader,
  ensureAccountHeader,
} from "@/utils/sheets";
import { blockDemoResponse } from "@/lib/demo-account";
import { withCacheHeaders, withETag, handleConditionalRequest } from "@/lib/api-helpers";
import { ROUTE_CACHE_PROFILES } from "@/lib/cache-headers";
import { normalizePaginationParams } from "@/lib/pagination";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { invalidateDashboardCache } from "@/lib/cache";
import { createAccountWithOpeningBalance } from "@/utils/setup/create-account-with-balance";
import { accountMatchesStatus } from "@/lib/account-archive";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse pagination params
  const { searchParams } = new URL(req.url);
  const accountStatus = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const { page: normalizedPage, limit: normalizedLimit, skip } = normalizePaginationParams({ page, limit });

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
          range: "Akun!A1:M1",
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
              "creditLimit",
              "billingCycleDay",
              "isActive",
            ]],
          },
        });
      }

      await Promise.all([
        ensureAccountHeader(user.sheetsId, accessToken).catch(() => {}),
        ensureTransaksiHeader(user.sheetsId, accessToken).catch(() => {}),
      ]);
      // Pure-ledger: balance dihitung runtime dari sheet Transaksi, kolom Akun!E diabaikan.
      const sheetsAccounts = (await getAccountsWithBalance(user.sheetsId, accessToken, { includeArchived: true }))
        .filter((account) => accountMatchesStatus(account.isActive !== false, accountStatus));

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
        isActive: a.isActive !== false,
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

      // Apply pagination
      const total = accounts.length;
      const totalPages = Math.ceil(total / normalizedLimit);
      const paginatedAccounts = accounts.slice(skip, skip + normalizedLimit);

      const responseData = {
        accounts: paginatedAccounts,
        summary: {
          assets: assets.toString(),
          liabilities: liabilities.toString(),
          netWorth: netWorth.toString(),
        },
        pagination: {
          page: normalizedPage,
          limit: normalizedLimit,
          total,
          totalPages,
        },
      };

      // Handle conditional request (ETag / 304)
      const conditionalResponse = handleConditionalRequest(req, responseData);
      if (conditionalResponse) return conditionalResponse;

      // Build response with cache headers and ETag
      const profile = ROUTE_CACHE_PROFILES["/api/accounts"];
      let response = NextResponse.json(responseData);
      response = withCacheHeaders(response, profile);
      response = withETag(response, responseData);

      return response;
    } catch (e) {
      console.error("Failed to read accounts from Sheets:", e);
      const apiError = sanitizeErrorForProduction(e, "internal");
      return NextResponse.json(
        { error: apiError.error, code: apiError.code },
        { status: apiError.statusCode }
      );
    }
  }

  // User non-Google: baca dari Prisma
  await ensureDefaultAccountTypes(session.userId);
  const accounts = await getAccountBalances(session.userId, accountStatus !== "archived");
  const summary = calculateNetWorth(accounts);

  const serializedAccounts = accounts.map(serializeAccountWithBalance);
  const total = serializedAccounts.length;
  const totalPages = Math.ceil(total / normalizedLimit);
  const paginatedAccounts = serializedAccounts.slice(skip, skip + normalizedLimit);

  const responseData = {
    accounts: paginatedAccounts,
    summary: serializeNetWorth(summary),
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages,
    },
  };

  // Handle conditional request (ETag / 304)
  const conditionalResponse = handleConditionalRequest(req, responseData);
  if (conditionalResponse) return conditionalResponse;

  // Build response with cache headers and ETag
  const profile = ROUTE_CACHE_PROFILES["/api/accounts"];
  let response = NextResponse.json(responseData);
  response = withCacheHeaders(response, profile);
  response = withETag(response, responseData);

  return response;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
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
      const classif: "asset" | "liability" = classification === "liability" ? "liability" : "asset";

      const created = await createAccountWithOpeningBalance(
        session.userId,
        {
          name: name.trim(),
          classification: classif,
          typeName: accountTypeName,
          saldoAwal: parsedBalance,
          currency: currency ?? "IDR",
          color: color ?? null,
          note: note ?? "",
          tanggalSettlement: accountTypeName === "Kartu Kredit" ? tanggalSettlement : null,
          tanggalJatuhTempo: accountTypeName === "Kartu Kredit" ? tanggalJatuhTempo : null,
        },
        { sheetsId: user.sheetsId, accessToken }
      );

      invalidateDashboardCache(session.userId);
      return NextResponse.json({
        account: {
          id: created.id,
          name: created.name,
          currentBalance: created.currentBalance,
          accountType: { name: accountTypeName, classification: classif },
          icon: null,
          transactionCount: 0,
          tanggalSettlement: accountTypeName === "Kartu Kredit" ? tanggalSettlement : null,
          tanggalJatuhTempo: accountTypeName === "Kartu Kredit" ? tanggalJatuhTempo : null,
        }
      }, { status: 201 });
    } catch (e) {
      console.error("Failed to create account in Sheets:", e);
      const apiError = sanitizeErrorForProduction(e, "internal");
      return NextResponse.json(
        { error: apiError.error, code: apiError.code },
        { status: apiError.statusCode }
      );
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

  const created = await createAccountWithOpeningBalance(session.userId, {
    name: name.trim(),
    classification: accountType.classification === "liability" ? "liability" : "asset",
    typeName: accountType.name,
    accountTypeId,
    saldoAwal: parsedBalance,
    currency: currency ?? "IDR",
    color: color ?? null,
    icon: icon ?? null,
    note: note ?? "",
    tanggalSettlement: accountType.name === "Kartu Kredit" ? tanggalSettlement : null,
    tanggalJatuhTempo: accountType.name === "Kartu Kredit" ? tanggalJatuhTempo : null,
  });

  invalidateDashboardCache(session.userId);
  return NextResponse.json({ account: { id: created.id, name: created.name } }, { status: 201 });
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
          creditLimit: acc.creditLimit?.toNumber() ?? null,
          billingCycleDay: acc.billingCycleDay,
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
    const apiError = sanitizeErrorForProduction(e, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}
