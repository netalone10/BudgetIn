import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { createGoogleSheet } from "@/utils/sheets";
import { seedDefaultCategories } from "@/utils/seed-categories";
import { isAdmin } from "@/lib/is-admin";
import bcrypt from "bcryptjs";

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
            "https://www.googleapis.com/auth/spreadsheets",
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

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

      try {
        const dbUser = await prisma.user.upsert({
          where: { googleId: user.id! },
          update: {
            name: user.name ?? "",
            image: user.image ?? null,
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            tokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
          create: {
            googleId: user.id!,
            email: user.email!,
            name: user.name ?? "",
            image: user.image ?? null,
            accessToken: account.access_token ?? null,
            refreshToken: account.refresh_token ?? null,
            tokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
        });

        // Onboarding: buat Google Sheet + seed kategori default (sekali saja)
        if (!dbUser.sheetsId && account.access_token) {
          const sheetsId = await createGoogleSheet(
            account.access_token,
            user.name ?? "User"
          );
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { sheetsId },
          });
          // Seed kategori default untuk user baru
          await seedDefaultCategories(dbUser.id);
        }

        return true;
      } catch (error) {
        console.error("signIn error:", error);
        return "/auth/error?error=OnboardingFailed";
      }
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
          token.accessToken = undefined;
          token.isAdmin = isAdmin(dbUser?.email);
        } else if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({
            where: { googleId: user.id! },
            select: { id: true, sheetsId: true, email: true },
          });
          token.userId = dbUser?.id;
          token.sheetsId = dbUser?.sheetsId;
          token.accessToken = account.access_token ?? undefined;
          token.isAdmin = isAdmin(dbUser?.email);
        }
      }
      return token;
    },

    // ── Session ───────────────────────────────────────────────────────────────
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.sheetsId = token.sheetsId as string | null;
      session.accessToken = token.accessToken as string | null;
      // Expose isAdmin ke client — dihitung server-side, tidak bocorkan list email
      session.isAdmin = token.isAdmin as boolean ?? false;
      return session;
    },
  },

  pages: {
    signIn: "/auth",
    error: "/auth/error",
  },
};
