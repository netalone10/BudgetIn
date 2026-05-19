import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/is-admin";

// Admin: list semua testimoni (default urut terbaru, filter status).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status"); // "pending" | "approved" | null
  const where =
    status === "pending" ? { approved: false } : status === "approved" ? { approved: true } : {};

  const rows = await prisma.testimonial.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      role: true,
      quote: true,
      rating: true,
      avatarBg: true,
      approved: true,
      approvedAt: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  return NextResponse.json({ testimonials: rows });
}
