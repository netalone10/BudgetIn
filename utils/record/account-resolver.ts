/**
 * Tujuan: Resolve nama akun dari AI ke accountId — match, ambiguous, atau auto-create
 * Caller: utils/record/intent-handlers.ts
 * Dependensi: prisma, utils/sheets, utils/account-types
 * Main Functions: buildAccountResolver
 * Side Effects: DB write / Sheets write saat auto-create akun baru
 */

import { prisma } from "@/lib/prisma";
import { appendAccount } from "@/utils/sheets";
import { ensureDefaultAccountTypes } from "@/utils/account-types";

export type RuntimeAccount = {
  id: string;
  name: string;
  classification: "asset" | "liability";
};

export interface AccountResolverContext {
  userId: string;
  prompt: string;
  useSheets: boolean;
  sheetsId?: string;
  accessToken?: string;
  userAccounts: RuntimeAccount[];
}

function inferAccountSpec(accountName: string, prompt: string) {
  const combined = `${prompt.toLowerCase()} ${accountName.toLowerCase()}`;
  if (/(kartu kredit|credit card|\bcc\b)/.test(combined))
    return { classification: "liability" as const, typeName: "Kartu Kredit" };
  if (/(paylater|hutang|utang|cicilan|pinjaman|loan)/.test(combined))
    return { classification: "liability" as const, typeName: "Hutang" };
  if (/(cash|tunai|kas)/.test(combined))
    return { classification: "asset" as const, typeName: "Kas" };
  if (/(ovo|gopay|dana|shopeepay|linkaja|e-wallet|ewallet|dompet)/.test(combined))
    return { classification: "asset" as const, typeName: "E-Wallet" };
  if (/(bca|bni|bri|mandiri|cimb|permata|jago|seabank|bank)/.test(combined))
    return { classification: "asset" as const, typeName: "Bank" };
  return { classification: "asset" as const, typeName: "Lainnya" };
}

export function buildAccountResolver(ctx: AccountResolverContext) {
  const { userId, prompt, useSheets, sheetsId, accessToken, userAccounts } = ctx;

  function matchAccount(accountName?: string) {
    if (!accountName) return null;
    const normalized = accountName.toLowerCase().trim();
    const matches = userAccounts.filter(
      (a) =>
        a.name.toLowerCase().includes(normalized) ||
        normalized.includes(a.name.toLowerCase())
    );
    if (matches.length === 1) return { id: matches[0].id };
    if (matches.length > 1) return { ambiguous: true, matches: matches.map((a) => a.name) };
    return null;
  }

  function getCandidates(accountName?: string): RuntimeAccount[] {
    if (!accountName) return [];
    const normalized = accountName.toLowerCase().trim();
    const combined = `${prompt.toLowerCase()} ${normalized}`;
    const rawTokens = combined.split(/[^a-z0-9]+/).filter(Boolean);
    const ignored = new Set(["pakai","dari","ke","rekening","rek","bank","kartu","kredit","credit","card","cc","transfer","bayar","pake","via"]);
    const tokens = Array.from(new Set(rawTokens.filter((t) => t.length >= 3 && !ignored.has(t))));
    const prefersLiability = /(kartu kredit|credit card|\bcc\b|paylater|hutang|utang|cicilan)/.test(combined);
    return userAccounts.filter((a) => {
      if (prefersLiability && a.classification !== "liability") return false;
      const name = a.name.toLowerCase();
      return tokens.some((t) => name.includes(t));
    });
  }

  async function createMissingAccount(accountName: string): Promise<RuntimeAccount> {
    const trimmedName = accountName.trim().slice(0, 50);
    const inferred = inferAccountSpec(trimmedName, prompt);

    if (useSheets) {
      const created = await appendAccount(sheetsId!, accessToken!, {
        name: trimmedName,
        type: inferred.typeName,
        classification: inferred.classification,
        balance: 0,
        currency: "IDR",
        color: null,
        note: "Auto-created from transaction input",
        tanggalSettlement: inferred.typeName === "Kartu Kredit" ? 17 : null,
        tanggalJatuhTempo: inferred.typeName === "Kartu Kredit" ? 5 : null,
      });
      const account: RuntimeAccount = { id: created.id, name: created.name, classification: inferred.classification };
      userAccounts.push(account);
      return account;
    }

    await ensureDefaultAccountTypes(userId);
    const directType = await prisma.accountType.findFirst({
      where: { userId, isActive: true, name: inferred.typeName },
      select: { id: true },
    });
    const fallbackType = directType ?? await prisma.accountType.findFirst({
      where: { userId, isActive: true, classification: inferred.classification },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    const created = await prisma.account.create({
      data: {
        userId,
        accountTypeId: fallbackType!.id,
        name: trimmedName,
        initialBalance: 0,
        currency: "IDR",
        note: "Auto-created from transaction input",
        ...(inferred.typeName === "Kartu Kredit" && { tanggalSettlement: 17, tanggalJatuhTempo: 5 }),
      },
      select: { id: true, name: true },
    });
    const account: RuntimeAccount = { id: created.id, name: created.name ?? trimmedName, classification: inferred.classification };
    userAccounts.push(account);
    return account;
  }

  async function resolveAccount(
    accountName: string | undefined,
    transactionType: "expense" | "income"
  ): Promise<{ accountId: string; accountCreated?: string } | { clarification: string }> {
    const result = matchAccount(accountName);
    if (result && "id" in result) return { accountId: result.id as string };
    if (result && "ambiguous" in result) {
      const list = result.matches.join(", ");
      return { clarification: `Akun mana yang dimaksud? Pilih salah satu: ${list}. Contoh: "${prompt} pakai ${result.matches[0]}"` };
    }
    const candidates = getCandidates(accountName);
    if (candidates.length === 1) return { accountId: candidates[0].id };
    if (candidates.length > 1) {
      const list = candidates.map((a) => a.name).join(", ");
      return { clarification: `Akun mana yang dimaksud? Pilih salah satu: ${list}. Contoh: "${prompt} pakai ${candidates[0].name}"` };
    }
    if (accountName?.trim()) {
      const created = await createMissingAccount(accountName);
      return { accountId: created.id, accountCreated: created.name };
    }
    return { clarification: askAccountSelection(transactionType) };
  }

  function askAccountSelection(transactionType: "expense" | "income"): string {
    if (userAccounts.length === 0)
      return "Belum ada akun. Buat akun dulu di menu Akun sebelum input transaksi.";
    const label = transactionType === "income" ? "masuk ke akun mana" : "dari akun mana";
    const list = userAccounts.map((a) => a.name).join(", ");
    return `Transaksi ${label}? Pilih salah satu: ${list}. Contoh: "${prompt} pakai ${userAccounts[0].name}"`;
  }

  async function validateAccount(accountId: string): Promise<{ error: string; status: number } | null> {
    if (useSheets) {
      const account = userAccounts.find((a) => a.id === accountId);
      if (!account) return { error: "Akun tidak ditemukan", status: 400 };
      return null;
    }
    const account = await prisma.account.findUnique({ where: { id: accountId } });
    if (!account) return { error: "Akun tidak ditemukan", status: 400 };
    if (account.userId !== userId) return { error: "Akun tidak valid", status: 400 };
    if (!account.isActive) return { error: "Akun sudah dinonaktifkan", status: 400 };
    return null;
  }

  return { resolveAccount, validateAccount };
}
