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
    { source: '/balti/:id/rezerva/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/balti/:id/recenzie', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M5: registration (participant.register, team disclaimer, guests) — per user, signed in only.
    { source: '/concursuri/:id/inscriere/:path*', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: the viewer's own history (partide.istoric) — /feed/sessions/mine, signed in only.
    { source: '/partide/istoric', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: the viewer's own catch gallery (partide.capturile-mele) — /feed/sessions/mine/catches.
    { source: '/partide/capturile-mele', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: a partidă by its client id (PARTIDA_FINISHED / AUTO_CLOSE_WARN) — resolved per user.
    { source: '/partide/sesiune/:clientId', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: start a partidă (partide.incepe) — a per-user write, signed in only (?balta / ?apa kept).
    { source: '/partide/incepe', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: join a partidă with a code (partide.intra) — a per-user write, signed in only.
    { source: '/partide/intra', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M4: join a partidă with an invite code (partide.intra-cod) — sign-in first, then back.
    { source: '/partide/intra/:cod', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    // M5 raffle (participant.raffle-*): the intro + join, confirmation, «Șansele mele», the receipt
    // upload and «Bon încărcat» are per user. /tombola/castigatori stays public (not listed).
    { source: '/tombola', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/tombola/confirmare', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/tombola/sansele-mele', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/tombola/bon', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
    { source: '/tombola/bon-trimis', missing: [{ type: 'cookie', key: 'bluvi_session' }] },
  ],
};
