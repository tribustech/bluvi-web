import { NextResponse, type NextRequest } from 'next/server';
import { routes } from '@/lib/routes';
import { safeNext } from '@/app/(site)/intra/logic';
import { lakeRouteAction } from '@/lib/lake-slug-route';
import { getLakeSlugMap } from '@/lib/server/lake-slug-map';

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
 * /intra is the one `has` entry: there the cookie's presence sends the visitor away from the sign-in.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  if (pathname.startsWith('/balti/')) return lakePath(request);
  // A visitor with a session cookie never sees the sign-in again (owner 2026-10-11): /intra goes
  // to its safe `next`, else home. A dead cookie lands on that page, whose dead-session handling
  // signs out and sends the visitor back here without it.
  if (pathname === routes.signIn()) {
    return NextResponse.redirect(new URL(safeNext(searchParams.get('next')) ?? routes.home(), request.url), 307);
  }
  return NextResponse.redirect(new URL(routes.signIn(`${pathname}${search}`), request.url), 307);
}

/** The lake pages that need an account (booking flow, review form) — the gate's other entries' rule. */
const SIGNED_IN_LAKE_PAGE = /^\/balti\/[^/]+\/(?:rezerva(?:\/.*)?|recenzie)$/;

/**
 * Every /balti/<x>/… request (lib/lake-slug-route.ts): an old documentId URL goes to its slug URL
 * (308), a slug URL is served from the lake's page (rewrite), the site's own /balti pages pass. The
 * signed-out gate for the booking flow and the review form runs here too (they used to be matcher
 * entries of their own; a path matched by several entries still runs the proxy once).
 */
async function lakePath(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const action = lakeRouteAction(pathname, await getLakeSlugMap());
  if (action.kind === 'redirect') return NextResponse.redirect(new URL(`${action.path}${search}`, request.url), 308);
  if (!request.cookies.has('bluvi_session') && SIGNED_IN_LAKE_PAGE.test(pathname)) {
    return NextResponse.redirect(new URL(routes.signIn(`${pathname}${search}`), request.url), 307);
  }
  if (action.kind === 'rewrite') return NextResponse.rewrite(new URL(`${action.path}${search}`, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    // /intra with a session cookie: the signed-in visitor leaves the sign-in (see proxy above).
    { source: '/intra', has: [{ type: 'cookie', key: 'bluvi_session' }] },
    // /setari and below: settings, edit profile (M2).
    { source: '/setari/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // An angler's followers / following (account.connections): auth-scoped on the CMS.
    { source: '/pescari/:id/conexiuni', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // Angler search (partide.pescari): /feed/anglers/search and /suggested are per user.
    { source: '/pescari', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // Suggested anglers (account.suggested): per viewer, signed in only.
    { source: '/pescari/sugerati', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // /profil: the own profile (M2, account.own-profile).
    { source: '/profil', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // /profil/completeaza: complete profile (M2, account.complete-profile).
    { source: '/profil/completeaza', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M3 booking: my bookings and one booking (/rezervari, /rezervari/[id]), the booking flow
    // (/balti/[id]/rezerva and its steps) and the lake review form — per user, signed in only.
    { source: '/rezervari/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // Every lake URL: slug ↔ documentId (lakePath), and the signed-out gate of the booking flow
    // (/balti/[id]/rezerva and its steps) and the lake review form.
    { source: '/balti/:path+' },
    // M5: registration (participant.register, team disclaimer, guests) — per user, signed in only.
    { source: '/concursuri/:id/inscriere/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M5: the competition chat (participant.chat, participant.b.chat-signed-out) — signed in only.
    { source: '/concursuri/:id/chat/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: the viewer's own history (partide.istoric) — /feed/sessions/mine, signed in only.
    { source: '/partide/istoric', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: the viewer's own catch gallery (partide.capturile-mele) — /feed/sessions/mine/catches.
    { source: '/partide/capturile-mele', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: a partidă by its client id (PARTIDA_FINISHED / AUTO_CLOSE_WARN) — resolved per user.
    { source: '/partide/sesiune/:clientId', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M6 organizer (organizer.b.signed-out-gate): the panel and the create wizard, the edit wizard of
    // a published competition, and the competition's management pages (sectors, allocation, scale,
    // penalties). The role / author check is the page's (lib/server/require-organizer.ts).
    { source: '/organizator/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/concursuri/:id/editeaza/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/concursuri/:id/sectoare', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/concursuri/:id/alocare', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/concursuri/:id/cantar/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/concursuri/:id/penalizari/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M7 lake operator (operator.b.role-gating): the picker /operator and everything under it (panel,
    // inbox, blocks, walk-in, rate angler). Per owner; the CMS owner-gates every read.
    { source: '/operator/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
  ],
};
