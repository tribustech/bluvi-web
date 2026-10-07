import 'server-only';
import { redirect } from 'next/navigation';
import { routes } from '@/lib/routes';
import { getViewerState } from '@/app/(site)/_shell/session';
import type { Viewer } from './viewer';

/**
 * Thrown when the session cannot be read (a cookie is there, but /users/me failed or gave no answer
 * in time): the route's error boundary shows «Serverul nu răspunde» with a retry. Never a redirect —
 * an unknown session is not a signed-out one (owner rule 4).
 */
export class SessionUnknownError extends Error {
  constructor() {
    super('Session unknown: /users/me did not answer');
    this.name = 'SessionUnknownError';
  }
}

/**
 * THE auth gate of every page that needs an account (parity account.b.signed-out-gate): edit
 * profile, own profile, connections, suggested anglers, notifications, settings… Every M2+ page
 * that is signed-in only imports this, unchanged.
 *
 * Contract:
 * - `await requireViewer(next)` returns the signed-in Viewer (lib/server/viewer.ts — narrow, safe to
 *   pass to a client component);
 * - signed out — no session cookie, or the CMS refused it (401 / SESSION_DEAD) →
 *   `redirect(routes.signIn(next))`, i.e. /intra?next=<next>, and the render stops (redirect throws
 *   NEXT_REDIRECT: never call it inside a try/catch that swallows errors);
 * - unknown — a cookie, but the CMS is down, slow (no answer in SESSION_READ_MS) or broke its
 *   contract → throws SessionUnknownError: the page's error boundary (its own `error.tsx`: the
 *   screen's frame + T4Gate danger «Serverul nu răspunde» + «Încearcă din nou», which re-renders the
 *   gate). A signed-in user is never sent to a sign-in form they do not need during a CMS blip.
 * - `next` is the page's own path WITH its query (what /intra must return to). Build it with
 *   lib/routes.ts, never from a request header.
 *
 * Where to call it (Cache Components): it reads the session cookie, so it is request-time data —
 * await it inside a <Suspense> boundary (a route `loading.tsx` is one), never at the top of a layout
 * and never inside a `'use cache'` scope:
 *
 *   export default function Page() {
 *     return <Suspense fallback={<Skeleton />}><Gated /></Suspense>;
 *   }
 *   async function Gated() {
 *     const viewer = await requireViewer(routes.x());
 *     return <Screen viewerId={viewer.id} />;
 *   }
 *
 * The redirect status: when the gate resolves before the first byte is flushed the response is a
 * real 307 to /intra?next=…; when the shell has already streamed (a slow CMS), Next emits the
 * redirect in the stream instead (a client-side replace) — the visitor lands on the same URL.
 *
 * The read is the shell's three-state one (app/(site)/_shell/session.ts getViewerState, React
 * `cache`d: the top bar and the gate share one /users/me per request). Each gated route ships an
 * `error.tsx` for the «unknown» case (app/(site)/setari/profil/error.tsx is the model).
 */
export async function requireViewer(next: string): Promise<Viewer> {
  const state = await getViewerState();
  if (state === null) redirect(routes.signIn(next));
  if ('status' in state) throw new SessionUnknownError();
  // Narrow to Viewer (this object may be handed to a client component).
  const { id, documentId, username, avatarUrl, role, isOrganizer, ownedLakes } = state;
  return { id, documentId, username, avatarUrl, role, isOrganizer, ownedLakes };
}
