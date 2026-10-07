import 'server-only';
import { cookies } from 'next/headers';

/*
 * Development-only fault switch for the Comunitate e2e tests (tests/e2e/partide-comunitate.spec.ts).
 * The overview and the first history page are read on the server and hydrated, so page.route can
 * neither shape nor slow them. A test sets the cookie `bluvi-e2e-partide=noprefetch` on ITS browser
 * context, and only that context's renders skip the server reads: the browser makes the community
 * reads itself and the test serves them with page.route. Per request, not process-wide — the dev
 * server is shared, so another test's /partide (the visual spec) keeps the server prefetch, and a
 * crashed spec leaves nothing behind.
 * In production builds this is a no-op (NODE_ENV is inlined, the cookie is never read), so the page
 * stays static.
 */

export const E2E_FAULT_COOKIE = 'bluvi-e2e-partide';

/** `noprefetch`: this request's page leaves its community reads to the browser (dev only). */
export async function e2eSkipPrefetch(): Promise<boolean> {
  if (process.env.NODE_ENV === 'production') return false;
  return (await cookies()).get(E2E_FAULT_COOKIE)?.value === 'noprefetch';
}
