/**
 * Cloudflare Turnstile server-side verification.
 * Returns true if token is valid, or if TURNSTILE_SECRET_KEY is not set (dev mode).
 */
export async function verifyTurnstile(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Production: wajib ada secret & token
  if (process.env.NODE_ENV === "production") {
    if (!secret || !token) return false;
  } else {
    // Development: skip jika secret belum dikonfigurasi
    if (!secret) return true;
    if (!token) return false;
  }

  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, response: token }),
      }
    );
    const data = await res.json() as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
