import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAccountTypes } from "@/utils/account-types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureDefaultAccountTypes(session.userId);

  const accountTypes = await prisma.accountType.findMany({
    where: { userId: session.userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ accountTypes });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, classification, icon, color, sortOrder } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Nama tipe akun tidak boleh kosong." }, { status: 400 });
  }
  if (name.trim().length > 30) {
    return NextResponse.json({ error: "Nama tipe akun maksimal 30 karakter." }, { status: 400 });
  }
  if (!["asset", "liability"].includes(classification)) {
    return NextResponse.json({ error: "Classification harus 'asset' atau 'liability'." }, { status: 400 });
  }

  try {
    const accountType = await prisma.accountType.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        classification,
        icon: icon ?? "wallet",
        color: color ?? "#6366f1",
        sortOrder: sortOrder ?? 0,
      },
    });
    return NextResponse.json({ accountType }, { status: 201 });
  } catch (error: unknown) {
    // P2002 = unique constraint violation
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: `Tipe akun "${name.trim()}" sudah ada.` }, { status: 409 });
    }
    console.error("[POST /api/account-types]", error);
    return NextResponse.json({ error: "Gagal membuat tipe akun." }, { status: 500 });
  }
}
