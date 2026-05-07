import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/crypto";

const REFRESH_URL = "https://oauth2.googleapis.com/token";
const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // refresh 5 menit sebelum expiry

export async function getValidToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessToken: true, refreshToken: true, tokenExpiry: true },
  });

  if (!user?.accessToken) {
    throw new Error("No access token found for user");
  }

  const accessToken = decryptSecret(user.accessToken);
  const refreshToken = decryptSecret(user.refreshToken);
  if (!accessToken) {
    throw new Error("No access token found for user");
  }

  // Token masih valid (lebih dari 5 menit sebelum expiry)
  const now = Date.now();
  const expiry = user.tokenExpiry?.getTime() ?? 0;
  if (expiry - now > EXPIRY_BUFFER_MS) {
    if (!isEncryptedSecret(user.accessToken)) {
      await prisma.user.update({
        where: { id: userId },
        data: { accessToken: encryptSecret(accessToken) },
      });
    }
    return accessToken;
  }

  // Token expired atau hampir expired — refresh
  if (!refreshToken) {
    throw new Error("No refresh token — user must re-authenticate");
  }

  const res = await fetch(REFRESH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await res.json();
  const newExpiry = new Date(Date.now() + data.expires_in * 1000);

  // Simpan token baru ke DB
  await prisma.user.update({
    where: { id: userId },
    data: {
      accessToken: encryptSecret(data.access_token),
      ...(!isEncryptedSecret(user.refreshToken) ? { refreshToken: encryptSecret(refreshToken) } : {}),
      tokenExpiry: newExpiry,
    },
  });

  return data.access_token;
}
