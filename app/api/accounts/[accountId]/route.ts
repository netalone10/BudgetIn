import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSingleAccountBalance, getAccountBalances } from "@/utils/account-balance";
import { getValidToken } from "@/utils/token";
import { google } from "googleapis";
import { updateAccount as updateAccountSheets, deleteAccount as deleteAccountSheets, getAccounts } from "@/utils/sheets";

type Params = { params: Promise<{ accountId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId } = await params;
  const body = await req.json();
  const { accountTypeName, classification, name, color, icon, note, currency, tanggalSettlement, tanggalJatuhTempo } = body;

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
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const sheets = google.sheets({ version: "v4", auth });

      // Ambil data akun lama dari Sheets
      const allAccounts = await getAccounts(user.sheetsId, accessToken);
      const existingAccount = allAccounts.find((a) => a.id === accountId);

      if (!existingAccount) {
        return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
      }

      // Update di Sheets
      await updateAccountSheets(user.sheetsId, accessToken, accountId, {
        name: name?.trim(),
        type: accountTypeName || existingAccount.type,
        classification: classification || existingAccount.classification,
        color: color ?? existingAccount.color,
        note: note ?? existingAccount.note,
      });

      return NextResponse.json({ 
        account: { 
          id: accountId, 
          name: name?.trim() || existingAccount.name,
          accountType: { name: accountTypeName || existingAccount.type, classification: classification || existingAccount.classification },
          currency: currency || existingAccount.currency,
          color: color ?? existingAccount.color,
          note: note ?? existingAccount.note,
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

  if (currency && currency !== existing.currency) {
    const txCount = await prisma.transaction.count({ where: { accountId } });
    if (txCount > 0) {
      return NextResponse.json(
        { error: "Mata uang tidak bisa diubah setelah ada transaksi." },
        { status: 409 }
      );
    }
  }

  // accountTypeId validation for Prisma users only

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return NextResponse.json({ error: "Nama tidak boleh kosong." }, { status: 400 });
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

  const updated = await prisma.account.update({
    where: { id: accountId },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(accountTypeId !== undefined && { accountTypeId }),
      ...(color !== undefined && { color }),
      ...(icon !== undefined && { icon }),
      ...(note !== undefined && { note }),
      ...(currency !== undefined && { currency }),
      ...(tanggalSettlement !== undefined && { tanggalSettlement }),
      ...(tanggalJatuhTempo !== undefined && { tanggalJatuhTempo }),
    },
    include: { accountType: true },
  });

  return NextResponse.json({ account: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId } = await params;
  const { searchParams } = new URL(req.url);
  const hard = searchParams.get("hard") === "true";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { sheetsId: true },
  });

  // Jika user Google Sheets, hapus dari Sheets saja
  if (user?.sheetsId) {
    try {
      const accessToken = await getValidToken(session.userId);
      await deleteAccountSheets(user.sheetsId, accessToken, accountId);
      return NextResponse.json({ message: "Akun dihapus." });
    } catch (e) {
      console.error("Failed to delete account from Sheets:", e);
      return NextResponse.json({ error: "Gagal menghapus akun dari Google Sheets" }, { status: 500 });
    }
  }

  // User non-Google: hapus dari Prisma
  const existing = await prisma.account.findUnique({ where: { id: accountId } });
  if (!existing) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404 });
  if (existing.userId !== session.userId) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  if (hard) {
    const txCount = await prisma.transaction.count({ where: { accountId } });
    if (txCount > 0) {
      return NextResponse.json(
        { error: `Akun ini memiliki ${txCount} transaksi. Hapus semua transaksi terlebih dahulu.` },
        { status: 409 }
      );
    }
    await prisma.account.delete({ where: { id: accountId } });
    return NextResponse.json({ message: "Akun dihapus permanen." });
  }

  const currentBalance = await getSingleAccountBalance(session.userId, accountId);
  if (!currentBalance.isZero()) {
    const formatted = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
      currentBalance.toNumber()
    );
    return NextResponse.json(
      { error: `Saldo akun ini masih ${formatted}. Transfer atau sesuaikan saldo ke 0 sebelum mengarsipkan.` },
      { status: 400 }
    );
  }

  await prisma.account.update({
    where: { id: accountId },
    data: { isActive: false },
  });
  return NextResponse.json({ message: "Akun diarsipkan." });
}