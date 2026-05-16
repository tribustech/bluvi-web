import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    strapiJwt?: string;
    user: DefaultSession["user"] & {
      id?: number;
      documentId?: string;
      username?: string;
      phone?: string | null;
      role?: { name?: string | null } | null;
      avatar?: { url?: string | null } | null;
    };
  }

  interface Account {
    strapiJwt?: string;
    strapiUser?: Record<string, unknown>;
  }

  interface User {
    strapiJwt?: string;
    strapiUser?: Record<string, unknown>;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    strapiJwt?: string;
    strapiUser?: Record<string, unknown>;
  }
}
