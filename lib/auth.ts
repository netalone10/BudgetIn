import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { createGoogleSheet } from "@/utils/sheets";

export const authOptions: NextAuthOptions = {
  providers: [
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
          access_type: "offline",  // dapat refresh token
          prompt: "consent",       // paksa minta consent ulang supaya refresh token selalu dikasih
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    // Dipanggil saat user login — simpan/update user ke DB + trigger onboarding
    async signIn({ user, account }) {
      if (!account || account.provider !== "google") return false;

      try {
        // Upsert user ke DB
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

        // Onboarding: buat Google Sheet kalau belum ada
        if (!dbUser.sheetsId && account.access_token) {
          const sheetsId = await createGoogleSheet(
            account.access_token,
            user.name ?? "User"
          );
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { sheetsId },
          });
        }

        return true;
      } catch (error) {
        console.error("signIn error:", error);
        return "/auth/error?error=OnboardingFailed";
      }
    },

    // Tambahkan userId + accessToken ke JWT
    async jwt({ token, user, account }) {
      if (user && account) {
        const dbUser = await prisma.user.findUnique({
          where: { googleId: user.id! },
          select: { id: true, sheetsId: true },
        });
        token.userId = dbUser?.id;
        token.sheetsId = dbUser?.sheetsId;
        token.accessToken = account.access_token;
      }
      return token;
    },

    // Expose userId + accessToken ke session (client-accessible)
    async session({ session, token }) {
      session.userId = token.userId as string;
      session.sheetsId = token.sheetsId as string | null;
      session.accessToken = token.accessToken as string;
      return session;
    },
  },

  pages: {
    error: "/auth/error",  // halaman error custom
  },
};
