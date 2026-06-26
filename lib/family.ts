/**
 * Family Mode — membership & scope helpers.
 *
 * Family adalah grup konsolidasi read-only: tiap anggota tetap punya buku
 * sendiri (DB atau Sheets), Family hanya "lensa" agregat. Keanggotaan selalu
 * disimpan di Postgres (model FamilyMember), independen dari storage ledger.
 */
import "server-only";

import { prisma } from "@/lib/prisma";

export interface FamilyMemberInfo {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  sheetsId: string | null; // null = DB user, ada = Sheets user
  role: string; // "owner" | "partner"
  displayRole: string | null; // label bebas: "Suami" | "Istri" | dll
  isSelf: boolean;
}

export interface FamilyContext {
  family: { id: string; name: string; ownerId: string };
  members: FamilyMemberInfo[];
  self: FamilyMemberInfo;
}

/**
 * Konteks family milik `userId`, atau null jika user tidak tergabung di family.
 * Owner pun punya baris FamilyMember (role "owner"), jadi cukup lookup via
 * keanggotaan lalu ambil seluruh anggota family-nya.
 */
export async function getFamilyContext(
  userId: string
): Promise<FamilyContext | null> {
  const membership = await prisma.familyMember.findUnique({
    where: { userId },
    select: {
      family: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          members: {
            select: {
              userId: true,
              role: true,
              displayRole: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  image: true,
                  sheetsId: true,
                },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
  });

  if (!membership?.family) return null;

  const fam = membership.family;
  const members: FamilyMemberInfo[] = fam.members.map((m) => ({
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
    sheetsId: m.user.sheetsId,
    role: m.role,
    displayRole: m.displayRole,
    isSelf: m.userId === userId,
  }));

  const self = members.find((m) => m.isSelf);
  if (!self) return null; // inkonsisten — anggap solo

  return {
    family: { id: fam.id, name: fam.name, ownerId: fam.ownerId },
    members,
    self,
  };
}

/**
 * Daftar userId yang masuk scope konsolidasi untuk `userId`.
 * Fallback `[userId]` kalau user solo — sehingga caller bisa selalu memakai
 * `where: { userId: { in: await getFamilyMemberIds(uid) } }`.
 */
export async function getFamilyMemberIds(userId: string): Promise<string[]> {
  const ctx = await getFamilyContext(userId);
  if (!ctx) return [userId];
  return ctx.members.map((m) => m.userId);
}
