/**
 * Default account types seeding + helper untuk first-time setup.
 */

import { prisma } from "@/lib/prisma";
import type { Account, AccountType } from "@prisma/client";

const DEFAULT_TYPES: Omit<AccountType, "id" | "userId" | "createdAt" | "updatedAt">[] = [
  { name: "Kas",          classification: "asset",     icon: "wallet",          color: "#10b981", sortOrder: 10,  isActive: true },
  { name: "Bank",         classification: "asset",     icon: "landmark",        color: "#3b82f6", sortOrder: 20,  isActive: true },
  { name: "E-Wallet",     classification: "asset",     icon: "smartphone",      color: "#8b5cf6", sortOrder: 30,  isActive: true },
  { name: "Investasi",    classification: "asset",     icon: "trending-up",     color: "#f59e0b", sortOrder: 40,  isActive: true },
  { name: "Kripto",       classification: "asset",     icon: "bitcoin",         color: "#f97316", sortOrder: 50,  isActive: true },
  { name: "Properti",     classification: "asset",     icon: "home",            color: "#14b8a6", sortOrder: 60,  isActive: true },
  { name: "Kendaraan",    classification: "asset",     icon: "car",             color: "#06b6d4", sortOrder: 70,  isActive: true },
  { name: "Piutang",      classification: "asset",     icon: "handshake",       color: "#84cc16", sortOrder: 80,  isActive: true },
  { name: "Hutang",       classification: "liability", icon: "credit-card",     color: "#ef4444", sortOrder: 90,  isActive: true },
  { name: "Kartu Kredit", classification: "liability", icon: "credit-card",     color: "#dc2626", sortOrder: 95,  isActive: true },
  { name: "Lainnya",      classification: "asset",     icon: "more-horizontal", color: "#6b7280", sortOrder: 100, isActive: true },
];

/**
 * Seed 10 default account types jika user belum punya satu pun.
 * Idempotent — aman dipanggil berkali-kali.
 */
export async function ensureDefaultAccountTypes(userId: string): Promise<void> {
  const existing = await prisma.accountType.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.accountType.createMany({
    data: DEFAULT_TYPES.map((t) => ({ ...t, userId })),
    skipDuplicates: true,
  });
}

/**
 * Pastikan user punya minimal 1 akun aktif.
 * Kalau belum ada, buat "Kas Utama" pakai type "Kas".
 */
export async function ensureDefaultAccount(userId: string): Promise<Account> {
  await ensureDefaultAccountTypes(userId);

  const existing = await prisma.account.findFirst({
    where: { userId, isActive: true },
  });
  if (existing) return existing;

  const kasType = await prisma.accountType.findFirst({
    where: { userId, name: "Kas" },
  });

  return prisma.account.create({
    data: {
      userId,
      accountTypeId: kasType!.id,
      name: "Kas Utama",
      initialBalance: 0,
      currency: "IDR",
    },
  });
}
