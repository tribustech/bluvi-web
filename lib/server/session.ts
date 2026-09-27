import 'server-only';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth/session-cookie';

/** The signed-in user's Strapi JWT, or undefined. Only callable in request scope. */
export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value || undefined;
}
