import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/is-admin";
import { refreshAppMetrics } from "@/lib/app-metrics";

type Ctx = { params: Promise<{ id: string }> };

// Approve / unapprove. Body: { approved: boolean }
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "Body harus { approved: boolean }" }, { status: 400 });
  }

  const updated = await prisma.testimonial.update({
    where: { id },
    data: {
      approved: body.approved,
      approvedAt: body.approved ? new Date() : null,
    },
    select: { id: true, approved: true, approvedAt: true },
  });

  // Refresh metrik supaya avg rating & count testimoni di landing langsung akurat.
  void refreshAppMetrics().catch((err) => console.error("[admin/testimonials] refresh metrics failed", err));

  return NextResponse.json({ ok: true, testimonial: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  await prisma.testimonial.delete({ where: { id } });

  void refreshAppMetrics().catch((err) => console.error("[admin/testimonials] refresh metrics failed", err));

  return NextResponse.json({ ok: true });
}
