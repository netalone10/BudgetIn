import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFamilyContext } from "@/lib/family";
import { getAccountBalances } from "@/utils/account-balance";
import { getAccountsWithComputedBalance } from "@/lib/sheets-data";

interface MemberAccounts {
  userId: string;
  name: string;
  displayRole: string | null;
  isSelf: boolean;
  accounts: { id: string; name: string }[];
  error: boolean;
}

// GET /api/family/accounts — daftar akun tiap anggota (untuk form transfer antar-anggota).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ members: [] });
  }

  const members: MemberAccounts[] = await Promise.all(
    ctx.members.map(async (m) => {
      try {
        const accounts = m.sheetsId
          ? (await getAccountsWithComputedBalance(m.userId, m.sheetsId)).map((a) => ({
              id: a.id,
              name: a.name,
            }))
          : (await getAccountBalances(m.userId)).map((a) => ({ id: a.id, name: a.name }));
        return {
          userId: m.userId,
          name: m.name,
          displayRole: m.displayRole,
          isSelf: m.isSelf,
          accounts,
          error: false,
        };
      } catch (error) {
        console.error(`[family/accounts] gagal memuat akun ${m.userId}:`, error);
        return {
          userId: m.userId,
          name: m.name,
          displayRole: m.displayRole,
          isSelf: m.isSelf,
          accounts: [],
          error: true,
        };
      }
    })
  );

  return NextResponse.json({ members });
}
