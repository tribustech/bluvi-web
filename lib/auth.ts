import NextAuth from "next-auth";
import Apple from "next-auth/providers/apple";
import Credentials from "next-auth/providers/credentials";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL || "http://localhost:1337";

async function exchangeOAuthToken(provider: string, payload: Record<string, unknown>) {
  const response = await fetch(`${STRAPI_URL}/api/auth/${provider}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Could not exchange OAuth token with Strapi");
  }

  return response.json() as Promise<{
    jwt: string;
    user: Record<string, unknown>;
  }>;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        identifier: { label: "Email", type: "email" },
        password: { label: "Parola", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const response = await fetch(`${STRAPI_URL}/api/auth/local`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: credentials.identifier,
            password: credentials.password,
          }),
        });

        if (!response.ok) {
          return null;
        }

        const data = (await response.json()) as {
          jwt: string;
          user: Record<string, unknown> & { email?: string; username?: string };
        };

        return {
          id: String(data.user.id ?? data.user.documentId ?? data.user.email),
          email: data.user.email,
          name: data.user.username as string | undefined,
          strapiJwt: data.jwt,
          strapiUser: data.user,
        };
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? [
          Apple({
            clientId: process.env.APPLE_CLIENT_ID,
            clientSecret: process.env.APPLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account }) {
      if (!account || account.provider === "credentials") {
        return true;
      }

      try {
        const data = await exchangeOAuthToken(account.provider, {
          access_token: account.access_token,
          id_token: account.id_token,
        });

        account.strapiJwt = data.jwt;
        account.strapiUser = data.user;
        return true;
      } catch {
        return false;
      }
    },
    async jwt({ token, account, user }) {
      if (account?.strapiJwt) {
        token.strapiJwt = account.strapiJwt;
      }
      if (account?.strapiUser) {
        token.strapiUser = account.strapiUser;
      }
      if (user && "strapiJwt" in user) {
        token.strapiJwt = user.strapiJwt as string | undefined;
        token.strapiUser = user.strapiUser as Record<string, unknown> | undefined;
      }
      return token;
    },
    async session({ session, token }) {
      session.strapiJwt = token.strapiJwt as string | undefined;
      if (token.strapiUser) {
        session.user = {
          ...session.user,
          ...(token.strapiUser as Record<string, unknown>),
        };
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
});
