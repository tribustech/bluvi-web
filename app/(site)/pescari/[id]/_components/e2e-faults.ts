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

/*
 * Development-only stand-in for the public header (GET /feed/anglers/:id/public, CMS PR #113) while
 * the local CMS may not have it: the read is server-side, so page.route cannot answer it. A test
 * POSTs to /pescari/<id>/e2e-public (../e2e-public/route.ts) `{ profile }` (the DTO), `{ missing:
 * true }` (404 ANGLER:NOT_FOUND), `{ unavailable: true }` (a CMS without the route: the pre-#113
 * page, whatever the local CMS has) or `{}` to clear; the next renders of THAT id see it. Keyed by
 * id, never by cookie: the metadata reads it too. No-op in production.
 */
type PublicStub = { kind: 'ok'; profile: unknown } | { kind: 'missing' } | { kind: 'unavailable' };
const gp = globalThis as typeof globalThis & { __bluviAnglerPublicStubs?: Map<string, PublicStub> };

export function e2ePublicStubStore(): Map<string, PublicStub> {
  gp.__bluviAnglerPublicStubs ??= new Map();
  return gp.__bluviAnglerPublicStubs;
}

export function e2ePublicStub(id: string): PublicStub | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  return gp.__bluviAnglerPublicStubs?.get(id);
}
