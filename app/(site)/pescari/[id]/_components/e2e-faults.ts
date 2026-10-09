import 'server-only';
import { cookies } from 'next/headers';

/*
 * Development-only fault switch for tests/e2e/pescar.spec.ts: a browser context that sets the cookie
 * `bluvi-e2e-pescar=throw` makes ITS render of the profile throw on the server, so the e2e can see
 * the route's error boundary ((profil)/error.tsx). Per request, never process-wide: the dev server
 * is shared. In production builds this is a no-op (NODE_ENV is inlined, the cookie is never read).
 */

export const E2E_PESCAR_FAULT_COOKIE = 'bluvi-e2e-pescar';

export async function e2eThrowProfile(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;
  if ((await cookies()).get(E2E_PESCAR_FAULT_COOKIE)?.value === 'throw') throw new Error('e2e: the profile render failed (dev fault switch)');
}
