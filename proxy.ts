import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Host header allowlist — cegah Host Header Injection meskipun Cloudflare WAF
// sudah jadi first line of defense. Skip cek di non-production supaya preview
// deployment (*.vercel.app) dan dev tooling tetap jalan.
const ALLOWED_HOSTS = new Set([
  "budget.amuharr.com",
  "localhost:3000",
  "127.0.0.1:3000",
]);

export async function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const host = request.headers.get("host");
    if (host && !ALLOWED_HOSTS.has(host)) {
      return new NextResponse("Bad Host", { status: 400 });
    }
  }

  const { pathname } = request.nextUrl;

  // ── Landing page (/) ──
  // Bila user sudah login, redirect di edge ke /dashboard agar landing
  // tetap fully static (tanpa `getServerSession()` di server component).
  if (pathname === "/") {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (token?.userId) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        return NextResponse.redirect(url);
      }
    } catch {
      // Token invalid / decrypt error → tampilkan landing static.
    }
    return NextResponse.next();
  }

  // ── Route yang butuh auth ──
  const protectedPaths = ["/dashboard"];
  const isProtected = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtected) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET!,
    });

    if (!token) {
      const signInUrl = new URL("/api/auth/signin", request.url);
      signInUrl.searchParams.set("callbackUrl", request.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
