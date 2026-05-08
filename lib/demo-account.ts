import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";

export const DEMO_ACCOUNT = {
  email: "demo@budgetin.local",
  password: "DemoBudgetIn2026!",
  name: "BudgetIn Demo",
} as const;

const CACHE_TTL_MS = 60_000;

let cachedDemoUserId: string | null = null;
let cacheExpiry: number = 0;

async function getDemoUserId(): Promise<string | null> {
  const now = Date.now();
  if (cachedDemoUserId !== null && cacheExpiry > now) {
    return cachedDemoUserId;
  }

  const user = await prisma.user.findUnique({
    where: { email: DEMO_ACCOUNT.email },
    select: { id: true },
  });

  cachedDemoUserId = user?.id ?? null;
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedDemoUserId;
}

export async function isDemoUser(session: Session | null): Promise<boolean> {
  const userId = session?.userId;
  if (!userId) return false;
  const demoUserId = await getDemoUserId();
  return demoUserId !== null && userId === demoUserId;
}

export async function blockDemoResponse(
  session: Session | null,
): Promise<NextResponse | null> {
  if (await isDemoUser(session)) {
    return NextResponse.json(
      { error: "Akun demo bersifat read-only. Silakan buat akun baru untuk mengedit data." },
      { status: 403 },
    );
  }
  return null;
}
