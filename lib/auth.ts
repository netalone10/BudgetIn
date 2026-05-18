import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { createGoogleSheet } from "@/utils/sheets";
import { seedDefaultCategories } from "@/utils/seed-categories";
import { isAdmin } from "@/lib/is-admin";
import { verifyTurnstile } from "@/lib/turnstile";
import { DEMO_ACCOUNT } from "@/lib/demo-account";
import { encryptSecret } from "@/lib/crypto";
import bcrypt from "bcryptjs";

const REQUIRED_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
];

function hasRequiredGoogleScopes(scope: unknown) {
  if (typeof scope !== "string") return false;
  const granted = new Set(scope.split(/\s+/).filter(Boolean));
  return REQUIRED_GOOGLE_SCOPES.every((required) => granted.has(required));
}

export const authOptions: NextAuthOptions = {
  providers: [
    // ── Google OAuth ──────────────────────────────────────────────────────────
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/drive.file",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),

    // ── Email / Password ──────────────────────────────────────────────────────
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Turnstile Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const isDemoLogin =
          credentials.email === DEMO_ACCOUNT.email &&
          credentials.password === DEMO_ACCOUNT.password;

        // Izinkan one-click access untuk akun demo publik tanpa CAPTCHA.
        if (!isDemoLogin) {
          const captchaOk = await verifyTurnstile(credentials.turnstileToken);
          if (!captchaOk) throw new Error("CAPTCHA_FAILED");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        // Blokir login jika email belum diverifikasi
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    // ── signIn — hanya untuk Google (Credentials ditangani di authorize) ──────
    async signIn({ user, account }) {
      if (!account) return false;

      // Credentials: user sudah di-validate di authorize(), boleh masuk
      if (account.provider === "credentials") return true;

      // Google flow
      if (account.provider !== "google") return false;
      if (!hasRequiredGoogleScopes(account.scope)) {
        return "/auth/error?error=GooglePermissionRequired";
      }

      let dbUser;
      try {
        const encryptedAccessToken = encryptSecret(account.access_token);
        const encryptedRefreshToken = encryptSecret(account.refresh_token);

        dbUser = await prisma.user.upsert({
          where: { googleId: user.id! },
          update: {
            name: user.name ?? "",
            image: user.image ?? null,
            accessToken: encryptedAccessToken,
            ...(encryptedRefreshToken ? { refreshToken: encryptedRefreshToken } : {}),
            tokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
          create: {
            googleId: user.id!,
            email: user.email!,
            name: user.name ?? "",
            image: user.image ?? null,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
        });
      } catch (error) {
        console.error("[signIn] DB upsert error:", error);
        return "/auth/error?error=OnboardingFailed";
      }

      // Onboarding: buat Google Sheet + seed kategori default (sekali saja)
      // Jika gagal, tetap izinkan login — akan dicoba ulang di next sign-in
      if (!dbUser.sheetsId && account.access_token) {
        try {
          const sheetsId = await createGoogleSheet(
            account.access_token,
            user.name ?? "User"
          );
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { sheetsId },
          });
          await seedDefaultCategories(dbUser.id);
        } catch (sheetsError) {
          console.error("[signIn] createGoogleSheet error:", sheetsError);
          return "/auth/error?error=GooglePermissionRequired";
        }
      }

      // Seed kategori jika belum ada (untuk user lama)
      if (dbUser.sheetsId) {
        seedDefaultCategories(dbUser.id).catch(() => {});
      }

      return true;
    },

    // ── JWT — sertakan userId ke token ────────────────────────────────────────
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "credentials") {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, sheetsId: true, email: true },
          });
          token.userId = dbUser?.id;
          token.sheetsId = dbUser?.sheetsId ?? undefined;
          token.isAdmin = isAdmin(dbUser?.email);
          token.isDemo = (dbUser?.email as string) === DEMO_ACCOUNT.email;
        } else if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({
            where: { googleId: user.id! },
            select: { id: true, sheetsId: true, email: true },
          });
          token.userId = dbUser?.id;
          token.sheetsId = dbUser?.sheetsId;
          token.isAdmin = isAdmin(dbUser?.email);
          token.isDemo = (dbUser?.email as string) === DEMO_ACCOUNT.email;
        }
      }
      return token;
    },

    // ── Session ───────────────────────────────────────────────────────────────
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.sheetsId = token.sheetsId as string | null;
      // Expose isAdmin ke client — dihitung server-side, tidak bocorkan list email
      session.isAdmin = token.isAdmin as boolean ?? false;
      session.isDemo = token.isDemo as boolean ?? false;
      return session;
    },
  },

  pages: {
    signIn: "/auth",
    error: "/auth/error",
  },
};
