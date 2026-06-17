/**
 * Tujuan: Buat 1 akun + transaksi "Saldo Awal" (opening balance) — sumber kebenaran tunggal
 *         untuk pembuatan akun bersaldo, dipakai POST /api/accounts dan setup akun via AI.
 * Caller: app/api/accounts/route.ts, app/api/setup/accounts/route.ts
 * Dependensi: prisma, utils/sheets, utils/account-types
 * Side Effects: DB write / Sheets write (akun + transaksi saldo awal)
 */

import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { appendAccount, appendTransaction } from "@/utils/sheets";
import { ensureDefaultAccountTypes } from "@/utils/account-types";

export interface CreateAccountInput {
  name: string;
  classification: "asset" | "liability";
  /** Nama tipe akun (mis. "Bank", "E-Wallet"). Wajib untuk Sheets, dipakai resolve tipe untuk DB. */
  typeName: string;
  /** Tipe akun eksplisit (DB). Jika kosong, di-resolve dari typeName/classification. */
  accountTypeId?: string;
  saldoAwal?: number;
  currency?: string;
  color?: string | null;
  icon?: string | null;
  note?: string;
  tanggalSettlement?: number | null;
  tanggalJatuhTempo?: number | null;
}

export interface SheetsContext {
  sheetsId: string;
  accessToken: string;
}

export interface CreatedAccount {
  id: string;
  name: string;
  currentBalance: string;
}

/**
 * Buat satu akun beserta transaksi saldo awal (jika saldo > 0).
 * Saldo awal dicatat sebagai transaksi "Saldo Awal" (isInitialBalance) — auditable & revertable;
 * saldo riil tetap dihitung dari ledger (lihat utils/account-balance).
 * `type` mengikuti classification: asset → income, liability → expense.
 *
 * Asumsi: input sudah divalidasi caller (nama ≤ 50, saldo ≥ 0 & finite, tanggal KK 1-31).
 */
export async function createAccountWithOpeningBalance(
  userId: string,
  input: CreateAccountInput,
  sheetsCtx?: SheetsContext | null
): Promise<CreatedAccount> {
  const name = input.name.trim();
  const classification = input.classification;
  const currency = input.currency ?? "IDR";
  const note = input.note ?? "";
  const saldo = input.saldoAwal && input.saldoAwal > 0 ? input.saldoAwal : 0;
  const isKartuKredit = input.typeName === "Kartu Kredit";
  const tanggalSettlement = isKartuKredit ? input.tanggalSettlement ?? null : null;
  const tanggalJatuhTempo = isKartuKredit ? input.tanggalJatuhTempo ?? null : null;
  const today = new Date().toISOString().slice(0, 10);

  // ── Google Sheets user ──────────────────────────────────────────────────────
  if (sheetsCtx) {
    const created = await appendAccount(sheetsCtx.sheetsId, sheetsCtx.accessToken, {
      name,
      type: input.typeName,
      classification,
      balance: 0,
      currency,
      color: input.color ?? null,
      note,
      tanggalSettlement,
      tanggalJatuhTempo,
    });

    if (saldo > 0) {
      if (classification === "asset") {
        await appendTransaction(sheetsCtx.sheetsId, sheetsCtx.accessToken, {
          date: today,
          amount: saldo,
          category: "Saldo Awal",
          note: `Saldo awal akun ${name}`,
          type: "income",
          toAccountId: created.id,
          toAccountName: name,
        });
      } else {
        await appendTransaction(sheetsCtx.sheetsId, sheetsCtx.accessToken, {
          date: today,
          amount: saldo,
          category: "Saldo Awal",
          note: `Saldo awal akun ${name}`,
          type: "expense",
          fromAccountId: created.id,
          fromAccountName: name,
        });
      }
    }

    return { id: created.id, name: created.name, currentBalance: saldo.toString() };
  }

  // ── DB user ─────────────────────────────────────────────────────────────────
  let accountTypeId = input.accountTypeId;
  if (!accountTypeId) {
    await ensureDefaultAccountTypes(userId);
    const byName = await prisma.accountType.findFirst({
      where: { userId, isActive: true, name: input.typeName },
      select: { id: true },
    });
    const fallback =
      byName ??
      (await prisma.accountType.findFirst({
        where: { userId, isActive: true, classification },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      }));
    if (!fallback) throw new Error("Tipe akun tidak ditemukan.");
    accountTypeId = fallback.id;
  }

  const saldoDecimal = new Decimal(saldo);

  const account = await prisma.$transaction(async (tx) => {
    const newAccount = await tx.account.create({
      data: {
        userId,
        accountTypeId: accountTypeId!,
        name,
        initialBalance: saldoDecimal,
        currency,
        color: input.color ?? null,
        icon: input.icon ?? null,
        note,
        ...(isKartuKredit && { tanggalSettlement, tanggalJatuhTempo }),
      },
    });

    if (saldoDecimal.greaterThan(0)) {
      await tx.transaction.create({
        data: {
          userId,
          accountId: newAccount.id,
          type: classification === "asset" ? "income" : "expense",
          amount: saldoDecimal,
          category: "Saldo Awal",
          date: today,
          note: `Saldo awal akun ${newAccount.name}`,
          isInitialBalance: true,
        },
      });
    }

    return newAccount;
  });

  return { id: account.id, name: account.name, currentBalance: saldo.toString() };
}
