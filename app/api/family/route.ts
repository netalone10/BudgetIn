import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { getFamilyContext } from "@/lib/family";

// GET /api/family — info family + anggota + undangan pending (jika owner)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ family: null });
  }

  const isOwner = ctx.self.role === "owner";
  const pendingInvites = isOwner
    ? await prisma.familyInvite.findMany({
        where: { familyId: ctx.family.id, status: "pending" },
        select: { id: true, email: true, displayRole: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return NextResponse.json({
    family: ctx.family,
    members: ctx.members,
    self: ctx.self,
    pendingInvites,
  });
}

// POST /api/family — buat family baru, caller jadi owner
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const displayRole =
    typeof body.displayRole === "string" && body.displayRole.trim()
      ? body.displayRole.trim()
      : null;

  if (!name) {
    return NextResponse.json({ error: "Nama keluarga wajib diisi" }, { status: 400 });
  }

  // 1 user = 1 family (MVP)
  const existing = await prisma.familyMember.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Kamu sudah tergabung dalam sebuah keluarga" },
      { status: 409 }
    );
  }

  const family = await prisma.$transaction(async (tx) => {
    const fam = await tx.family.create({
      data: { name, ownerId: session.userId! },
    });
    await tx.familyMember.create({
      data: {
        familyId: fam.id,
        userId: session.userId!,
        role: "owner",
        displayRole,
      },
    });
    return fam;
  });

  return NextResponse.json({
    family: { id: family.id, name: family.name, ownerId: family.ownerId },
  });
}

// DELETE /api/family — bubarkan family (owner only)
export async function DELETE() {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getFamilyContext(session.userId);
  if (!ctx) {
    return NextResponse.json({ error: "Kamu tidak tergabung dalam keluarga" }, { status: 404 });
  }
  if (ctx.self.role !== "owner") {
    return NextResponse.json(
      { error: "Hanya pemilik yang bisa membubarkan keluarga" },
      { status: 403 }
    );
  }

  // Cascade menghapus FamilyMember + FamilyInvite. Buku tiap anggota tetap utuh.
  await prisma.family.delete({ where: { id: ctx.family.id } });

  return NextResponse.json({ ok: true });
}
