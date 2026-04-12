import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/verify-email?token=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth?error=invalid_token", req.url));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
      select: {
        id: true,
        emailVerified: true,
        verificationTokenExpiry: true,
      },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/auth?error=invalid_token", req.url));
    }

    if (user.emailVerified) {
      return NextResponse.redirect(new URL("/auth?verified=already", req.url));
    }

    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      return NextResponse.redirect(new URL("/auth?error=token_expired", req.url));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return NextResponse.redirect(new URL("/auth?verified=true", req.url));
  } catch (error) {
    console.error("[verify-email]", error);
    return NextResponse.redirect(new URL("/auth?error=invalid_token", req.url));
  }
}
