import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MIN_QUOTE = 30;
const MAX_QUOTE = 400;
const MIN_ROLE = 3;
const MAX_ROLE = 80;

const AVATAR_PALETTE = ["#d04f99", "#6366f1", "#0ea5b4", "#f59e0b", "#22c55e", "#a83880"];

function pickAvatar(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// Submit testimoni baru. Auth wajib, masuk antrian moderasi (approved=false).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const quote = String(body.quote ?? "").trim();
  const role = String(body.role ?? "").trim();
  const ratingRaw = Number(body.rating);
  const rating = Number.isFinite(ratingRaw) ? Math.max(1, Math.min(5, Math.round(ratingRaw))) : 5;

  if (quote.length < MIN_QUOTE) {
    return NextResponse.json({ error: `Testimoni minimal ${MIN_QUOTE} karakter.` }, { status: 400 });
  }
  if (quote.length > MAX_QUOTE) {
    return NextResponse.json({ error: `Testimoni maksimal ${MAX_QUOTE} karakter.` }, { status: 400 });
  }
  if (role.length < MIN_ROLE) {
    return NextResponse.json({ error: `Posisi/role minimal ${MIN_ROLE} karakter.` }, { status: 400 });
  }
  if (role.length > MAX_ROLE) {
    return NextResponse.json({ error: `Posisi/role maksimal ${MAX_ROLE} karakter.` }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  // Anti-spam: kalau sudah submit dalam 24 jam terakhir, tolak.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.testimonial.findFirst({
    where: { userId: user.id, createdAt: { gte: since } },
    select: { id: true, approved: true },
  });
  if (recent) {
    return NextResponse.json(
      {
        error: recent.approved
          ? "Kamu sudah punya testimoni yang aktif. Tunggu 24 jam atau hubungi admin untuk edit."
          : "Testimoni kamu sedang menunggu review admin. Tunggu sebentar ya.",
      },
      { status: 429 }
    );
  }

  const created = await prisma.testimonial.create({
    data: {
      userId: user.id,
      name: user.name,
      role,
      quote,
      rating,
      avatarBg: pickAvatar(user.id),
      approved: false,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, testimonial: created });
}
