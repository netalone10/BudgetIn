import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Daftar testimoni yang sudah di-approve untuk landing page.
// Tidak perlu auth.
export async function GET() {
  const rows = await prisma.testimonial.findMany({
    where: { approved: true },
    orderBy: { approvedAt: "desc" },
    take: 9,
    select: {
      id: true,
      name: true,
      role: true,
      quote: true,
      rating: true,
      avatarBg: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ testimonials: rows });
}
