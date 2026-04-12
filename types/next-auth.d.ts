import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    userId: string;
    sheetsId: string | null;
    accessToken: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    sheetsId?: string | null;
    accessToken?: string;
  }
}
