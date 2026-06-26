import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";

// GET /api/family/invite/accept?token=... — info undangan (untuk halaman konfirmasi)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ error: "Token tidak ada" }, { status: 400 });
  }

  const invite = await prisma.familyInvite.findUnique({
    where: { token },
    select: {
      email: true,
      displayRole: true,
      status: true,
      expiresAt: true,
      family: { select: { name: true, owner: { select: { name: true } } } },
    },
  });

  if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Undangan tidak valid atau kedaluwarsa" }, { status: 404 });
  }

  return NextResponse.json({
    invite: {
      email: invite.email,
      displayRole: invite.displayRole,
      familyName: invite.family.name,
      inviterName: invite.family.owner.name,
    },
  });
}

// POST /api/family/invite/accept { token } — terima undangan (login required)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "Token tidak ada" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { email: true, familyMembership: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }
  if (user.familyMembership) {
    return NextResponse.json(
      { error: "Kamu sudah tergabung dalam sebuah keluarga" },
      { status: 409 }
    );
  }

  const invite = await prisma.familyInvite.findUnique({
    where: { token },
    select: { id: true, familyId: true, email: true, role: true, displayRole: true, status: true, expiresAt: true },
  });
  if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Undangan tidak valid atau kedaluwarsa" }, { status: 404 });
  }

  // Email penerima harus cocok dengan tujuan undangan.
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Undangan ini ditujukan untuk email lain" },
      { status: 403 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.familyMember.create({
      data: {
        familyId: invite.familyId,
        userId: session.userId!,
        role: "partner",
        displayRole: invite.displayRole,
      },
    });
    await tx.familyInvite.update({
      where: { id: invite.id },
      data: { status: "accepted" },
    });
  });

  return NextResponse.json({ ok: true, familyId: invite.familyId });
}
