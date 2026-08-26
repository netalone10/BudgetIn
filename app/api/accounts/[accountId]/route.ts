import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSingleAccountBalance } from "@/utils/account-balance";
import { getValidToken } from "@/utils/token";
import {
  updateAccount as updateAccountSheets,
  getAccounts,
  getAccountsWithBalance,
  ensureAccountHeader,
} from "@/utils/sheets";
import { blockDemoResponse } from "@/lib/demo-account";
import { invalidateDashboardCache } from "@/lib/cache";
import { checkRateLimit, RATE_LIMIT_ACCOUNT_MUTATION } from "@/lib/rate-limit";
import { Decimal } from "@prisma/client/runtime/library";

function rateLimitResponse(rl: { resetAt: number }) {
  return NextResponse.json(
    { error: "Terlalu banyak request. Tunggu sebentar sebelum mencoba lagi." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        "X-RateLimit-Limit": String(RATE_LIMIT_ACCOUNT_MUTATION.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
      },
    }
  );
}

type Params = { params: Promise<{ accountId: string }> };

const IDR_FORMAT = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`account-mutate:${session.userId}`, RATE_LIMIT_ACCOUNT_MUTATION);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { accountId } = await params;
   
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }
  const { accountTypeId, accountTypeName, classification, name, color, icon, note, currency, tanggalSettlement, tanggalJatuhTempo, creditLimit, billingCycleDay } = body;
  const restoring = body.action === "restore";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // Jika user Google Sheets, update di Sheets saja
  if (user?.sheetsId) {
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
    }

    try {
      const accessToken = await getValidToken(session.userId);
      await ensureAccountHeader(user.sheetsId, accessToken).catch(() => {});

      // Ambil data akun lama dari Sheets
      const allAccounts = await getAccounts(user.sheetsId, accessToken, { includeArchived: true });
      const existingAccount = allAccounts.find((a) => a.id === accountId);

      if (!existingAccount) {
        return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
      }

      if (restoring) {
        await updateAccountSheets(user.sheetsId, accessToken, accountId, { isActive: true });
        invalidateDashboardCache(session.userId);
        return NextResponse.json({ message: "Akun dipulihkan." });
      }

      // Update di Sheets
      await updateAccountSheets(user.sheetsId, accessToken, accountId, {
        name: name?.trim(),
        type: accountTypeName || existingAccount.type,
        classification: classification || existingAccount.classification,
        color: color ?? existingAccount.color,
        note: note ?? existingAccount.note,
        tanggalSettlement: tanggalSettlement ?? existingAccount.tanggalSettlement,
        tanggalJatuhTempo: tanggalJatuhTempo ?? existingAccount.tanggalJatuhTempo,
        creditLimit: creditLimit !== undefined ? creditLimit : existingAccount.creditLimit,
        billingCycleDay: billingCycleDay !== undefined ? billingCycleDay : existingAccount.billingCycleDay,
      });

      invalidateDashboardCache(session.userId);
      return NextResponse.json({ 
        account: { 
          id: accountId, 
          name: name?.trim() || existingAccount.name,
          accountType: { name: accountTypeName || existingAccount.type, classification: classification || existingAccount.classification },
          currency: currency || existingAccount.currency,
          color: color ?? existingAccount.color,
          note: note ?? existingAccount.note,
          currentBalance: existingAccount.balance.toString(),
          icon: null,
          transactionCount: 0,
          tanggalSettlement: tanggalSettlement ?? existingAccount.tanggalSettlement,
          tanggalJatuhTempo: tanggalJatuhTempo ?? existingAccount.tanggalJatuhTempo,
          creditLimit: creditLimit !== undefined ? creditLimit : existingAccount.creditLimit,
          billingCycleDay: billingCycleDay !== undefined ? billingCycleDay : existingAccount.billingCycleDay,
        } 
      });
    } catch (e) {
      console.error("Failed to update account in Sheets:", e);
      return NextResponse.json({ error: "Gagal mengupdate akun di Google Sheets" }, { status: 500 });
    }
  }

  // User non-Google: update di Prisma
  const existing = await prisma.account.findUnique({ where: { id: accountId } });
  if (!existing) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (restoring) {
    await prisma.account.update({ where: { id: accountId }, data: { isActive: true } });
    invalidateDashboardCache(session.userId);
    return NextResponse.json({ message: "Akun dipulihkan." });
  }

  if (currency && currency !== existing.currency) {
    const txCount = await prisma.transaction.count({ where: { accountId } });
    if (txCount > 0) {
      return NextResponse.json(
        { error: "Mata uang tidak bisa diubah setelah ada transaksi." },
        { status: 409 }
      );
    }
  }

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
  }

  let accountType:
    | { id: string; userId: string; name: string; classification: string; isActive: boolean }
    | null = null;

  if (accountTypeId !== undefined) {
    if (typeof accountTypeId !== "string" || accountTypeId.trim().length === 0) {
      return NextResponse.json({ error: "Tipe akun harus dipilih." }, { status: 400 });
    }

    accountType = await prisma.accountType.findUnique({ where: { id: accountTypeId } });
    if (!accountType || accountType.userId !== session.userId || !accountType.isActive) {
      return NextResponse.json({ error: "Tipe akun tidak valid." }, { status: 400 });
    }
  }

  if (tanggalSettlement !== undefined) {
    if (tanggalSettlement !== null && (tanggalSettlement < 1 || tanggalSettlement > 31)) {
      return NextResponse.json({ error: "Tanggal Settlement harus antara 1-31." }, { status: 400 });
    }
  }
  if (tanggalJatuhTempo !== undefined) {
    if (tanggalJatuhTempo !== null && (tanggalJatuhTempo < 1 || tanggalJatuhTempo > 31)) {
      return NextResponse.json({ error: "Tanggal Jatuh Tempo harus antara 1-31." }, { status: 400 });
    }
  }

  if (creditLimit !== undefined) {
    if (creditLimit !== null && (typeof creditLimit !== "number" || creditLimit < 0)) {
      return NextResponse.json({ error: "Credit limit harus angka positif atau null." }, { status: 400 });
    }
  }
  if (billingCycleDay !== undefined) {
    if (billingCycleDay !== null && (billingCycleDay < 1 || billingCycleDay > 31)) {
      return NextResponse.json({ error: "Billing cycle day harus antara 1-31." }, { status: 400 });
    }
  }

  const effectiveAccountTypeName = accountType?.name ?? (await prisma.accountType.findUnique({ where: { id: existing.accountTypeId }, select: { name: true } }))?.name;

  if (effectiveAccountTypeName === "Kartu Kredit") {
    const nextTanggalSettlement = tanggalSettlement !== undefined ? tanggalSettlement : existing.tanggalSettlement;
    const nextTanggalJatuhTempo = tanggalJatuhTempo !== undefined ? tanggalJatuhTempo : existing.tanggalJatuhTempo;

    if (nextTanggalSettlement == null) {
      return NextResponse.json({ error: "Tanggal Settlement (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
    }
    if (nextTanggalJatuhTempo == null) {
      return NextResponse.json({ error: "Tanggal Jatuh Tempo (1-31) wajib diisi untuk Kartu Kredit." }, { status: 400 });
    }
  }

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: {
      ...(accountType && { accountTypeId: accountType.id }),
      ...(name !== undefined && { name: name.trim() }),
      ...(color !== undefined && { color }),
      ...(icon !== undefined && { icon }),
      ...(note !== undefined && { note }),
      ...(currency !== undefined && { currency }),
      ...(tanggalSettlement !== undefined && { tanggalSettlement }),
      ...(tanggalJatuhTempo !== undefined && { tanggalJatuhTempo }),
      ...(creditLimit !== undefined && { creditLimit: creditLimit !== null ? new Decimal(creditLimit) : null }),
      ...(billingCycleDay !== undefined && { billingCycleDay }),
    },
    include: { accountType: true },
  });

  invalidateDashboardCache(session.userId);
  return NextResponse.json({ account: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = checkRateLimit(`account-mutate:${session.userId}`, RATE_LIMIT_ACCOUNT_MUTATION);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { accountId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  const recurringUsage = await prisma.recurringTransaction.count({
    where: {
      userId: session.userId,
      isActive: true,
      OR: [{ accountId }, { toAccountId: accountId }, { liabilityAccountId: accountId }],
    },
  });
  if (recurringUsage > 0) {
    return NextResponse.json(
      { error: `Akun masih dipakai oleh ${recurringUsage} cicilan/transaksi berulang aktif. Nonaktifkan dulu.` },
      { status: 409 }
    );
  }

  // Google Sheets juga soft archive. Row dan histori transaksi tetap utuh.
  if (user?.sheetsId) {
    try {
      const accessToken = await getValidToken(session.userId);
      await ensureAccountHeader(user.sheetsId, accessToken);
      const account = (await getAccountsWithBalance(user.sheetsId, accessToken, { includeArchived: true }))
        .find((item) => item.id === accountId);
      if (!account) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
      if (account.balance !== 0) {
        return NextResponse.json(
          { error: `Saldo akun ini masih ${IDR_FORMAT.format(account.balance)}. Transfer atau sesuaikan saldo ke 0 sebelum mengarsipkan.` },
          { status: 400 }
        );
      }
      await updateAccountSheets(user.sheetsId, accessToken, accountId, { isActive: false });
      invalidateDashboardCache(session.userId);
      return NextResponse.json({ message: "Akun diarsipkan." });
    } catch (e) {
      console.error("Failed to archive account in Sheets:", e);
      return NextResponse.json({ error: "Gagal mengarsipkan akun di Google Sheets" }, { status: 500 });
    }
  }

  const existing = await prisma.account.findUnique({ where: { id: accountId } });
  if (!existing) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const currentBalance = await getSingleAccountBalance(session.userId, accountId);
  if (!currentBalance.isZero()) {
    const formatted = IDR_FORMAT.format(currentBalance.toNumber());
    return NextResponse.json(
      { error: `Saldo akun ini masih ${formatted}. Transfer atau sesuaikan saldo ke 0 sebelum mengarsipkan.` },
      { status: 400 }
    );
  }

  await prisma.account.update({
    where: { id: accountId },
    data: { isActive: false },
  });
  invalidateDashboardCache(session.userId);
  return NextResponse.json({ message: "Akun diarsipkan." });
}
