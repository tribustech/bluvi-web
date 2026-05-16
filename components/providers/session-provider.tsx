"use client";

import { SessionProvider as NextAuthSessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { setStrapiToken } from "@/lib/strapi-client";

function SessionTokenBridge() {
  const { data: session } = useSession();

  useEffect(() => {
    setStrapiToken(session?.strapiJwt ?? null);
  }, [session?.strapiJwt]);

  return null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionTokenBridge />
      {children}
    </NextAuthSessionProvider>
  );
}
