import { NextResponse, type NextRequest } from 'next/server';
import { routes } from '@/lib/routes';

/**
 * The signed-out gate's fast path (parity account.b.signed-out-gate). Pages that need an account
 * await lib/server/require-viewer.ts inside a Suspense boundary (Cache Components), so by the time
 * it decides, the static shell has already been sent and Next can only redirect in the stream (a
 * 200 with a client-side replace). This proxy answers the common case before rendering: no session
 * cookie at all → a real 307 to /intra?next=<path+query>. It only looks at the cookie's presence
 * (the matcher's `missing` runs it for cookie-less requests only); a dead or revoked cookie is still
 * requireViewer's call.
 *
 * Signed-in-only pages add their path pattern to `matcher` (a static list: Next reads it at build).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(routes.signIn(`${pathname}${search}`), request.url), 307);
}

export const config = {
  matcher: [
    // /setari and below: settings, edit profile (M2).
    { source: '/setari/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
  ],
};
