import 'server-only';
import { cache } from 'react';
import { getMyBookingsUpcomingCount } from '@/core/booking';
import { getLiveCompetition } from '@/core/competitions';
import { getOwnedLakesStats } from '@/core/lakes';
import {
  deriveRaffleState,
  fetchActiveRaffle,
  fetchRaffleParticipation,
  getCompetitionActiveWeighing,
  getOrganizerDashboard,
  type CompetitionActiveWeighing,
} from '@/core/organizer';
import { getActiveSession, getSession } from '@/core/partide';
import { getUnreadNotificationsForLoggedInUser } from '@/core/social';
import type { DehydratedState } from '@tanstack/react-query';
import { isApiError, type Transport } from '@/core/transport';
import { prefetchState, type Prefetchable } from '@/lib/client/hydration';
import { cmsUrl } from '@/lib/server/env';
import { createServerTransport } from '@/lib/server/transport';
import { getShellSession, type ShellUser } from '../_shell/session';
import { isUnknownViewer } from '../_shell/viewer-state';

/*
 * Per-user reads of Acasă. They carry the session, so they run at request time behind a
 * <Suspense> and never inside a cached scope. Each is wrapped in React `cache` because the mobile
 * and desktop compositions both render the same block: one CMS call per request.
 *
 * A failure hides the block (fish: these blocks render nothing until their query has data); the
 * public parts of the page are unaffected.
 */

/**
 * How long one per-user read may hold its block (and, below 1280, the stacked column's single
 * reveal) — a deadline for the REVEAL, never one that silently drops the block: past it, a
 * TanStack block (poll, suggested anglers) mounts and finishes its read in the browser
 * (prefetchTracked), the live competition keeps its place with a retry (loadMyLiveCompetition
 * FAILED), the raffle says it could not check the registration, and the partidă hero stays (fish
 * shows it unless a partidă is confirmed live). Staging / prod add 2–3 s per request, so no budget
 * here would be «long enough»: the client takeover is what keeps the blocks.
 */
const READ_BUDGET_MS = 2500;

/**
 * The server transport with a time budget: every request carries an abort signal that fires after
 * READ_BUDGET_MS (combined with the caller's own signal, if any). A fresh budget per call, so each
 * read gets its own. Cached public GETs ignore it (they are answered from the cache).
 */
export function boundedTransport(): Transport {
  const t = createServerTransport();
  const budget = AbortSignal.timeout(READ_BUDGET_MS);
  return {
    request: (req) => t.request({ ...req, signal: req.signal ? AbortSignal.any([req.signal, budget]) : budget }),
  };
}

/** A transient failure gets one more try after this pause (fish's QueryClient retries 3×). */
const RETRY_PAUSE_MS = 300;

const FAILED = Symbol('failed');

/**
 * A read that may fail or time out (bounded transport): the value, or FAILED — never a thrown
 * error. A 4xx is an answer (no grant for this role, nothing to show): null, quietly. A transient
 * failure (5xx, a reset connection) is tried once more after RETRY_PAUSE_MS with a fresh budget —
 * one hiccup no longer hides a block for the life of the page; a read that ran out of budget is
 * not retried (a second wait would hold the column's reveal for another budget).
 */
async function attempt<T>(label: string, read: (t: Transport) => Promise<T>): Promise<T | null | typeof FAILED> {
  for (let i = 0; ; i++) {
    const started = Date.now();
    try {
      return await read(boundedTransport());
    } catch (e) {
      if (isApiError(e) && e.status >= 400 && e.status < 500) return null;
      const timedOut = Date.now() - started >= READ_BUDGET_MS - 50;
      if (i === 0 && !timedOut) {
        await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
        continue;
      }
      // A read that ran out of its reveal budget is handled (the block takes over in the browser,
      // or keeps a retry): a warning, not a console error. A real failure (5xx, a contract break)
      // stays an error.
      if (timedOut) console.warn(`[acasa] ${label}: no answer within ${READ_BUDGET_MS} ms`);
      else console.error(`[acasa] ${label} failed`, e);
      return FAILED;
    }
  }
}

/** attempt(), with a failure folded into null (the block is hidden, as fish hides it without data). */
async function quiet<T>(label: string, read: (t: Transport) => Promise<T>): Promise<T | null> {
  const value = await attempt(label, read);
  return value === FAILED ? null : value;
}

/**
 * prefetchState() for a per-user TanStack block, telling an ANSWER (data, or a 4xx: no grant —
 * nothing to show) from NO ANSWER (timed out, 5xx, network): `transient` is true when some request
 * failed without a 4xx. The slot then mounts the client block without data, so its query reads in
 * the browser (TanStack's retries) instead of the block vanishing for the life of the page.
 */
export async function prefetchTracked(build: (t: Transport) => readonly Prefetchable[]): Promise<{ state: DehydratedState; transient: boolean }> {
  const inner = boundedTransport();
  let transient = false;
  const t: Transport = {
    request: async (req) => {
      try {
        return await inner.request(req);
      } catch (e) {
        if (!(isApiError(e) && e.status >= 400 && e.status < 500)) transient = true;
        throw e;
      }
    },
  };
  const state = await prefetchState(build(t), []);
  if (state.queries.length === 0 && transient) console.warn('[acasa] per-user prefetch gave no answer: the block reads in the browser');
  return { state, transient };
}

export type HomeViewer = ShellUser & { isOrganizer: boolean };

/**
 * The session as Acasă reads it — the shell's own read (../_shell/session.ts, one CMS call per
 * request): the user, null (signed out), or 'unknown' (a session cookie, but /users/me failed or
 * gave no answer). Unknown is NEVER the signed-out page (fish keeps the session and shows its
 * ErrorScreen, (tabs)/index.tsx isErrorProfile): the personal blocks show the session error card
 * (HomeSessionError) and no guest prompt is rendered.
 */
export const getHomeSession = cache(async (): Promise<HomeViewer | null | 'unknown'> => {
  // The shell's bounded read (SHELL_SESSION_TIMEOUT_MS): the page and the top bar flip to «unknown»
  // on the same deadline, never one saying «failed» while the other still says «loading».
  const viewer = await getShellSession();
  if (isUnknownViewer(viewer)) return 'unknown';
  return viewer ? { ...viewer, isOrganizer: viewer.role === 'Organizer' } : null;
});

/**
 * The signed-in user, or null — for the per-user READS only (an unknown session has nothing to read
 * with). Anything that renders a signed-out variant must ask getHomeSession() and handle 'unknown'.
 */
export const getHomeViewer = cache(async (): Promise<HomeViewer | null> => {
  const session = await getHomeSession();
  return session === 'unknown' ? null : session;
});

/** fish OrganizerBanner → `useOrganizerDashboard` (organisers only). */
export const loadOrganizerDashboard = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer?.isOrganizer) return null;
  return quiet('organizer dashboard', (t) => getOrganizerDashboard(t));
});

/**
 * fish OwnedLakesCard → `useOwnedLakes` + `useOwnedLakesStats(ownsLakes)`. The owned-lakes list is
 * the authoritative ownership signal — the session already read it (Viewer.ownedLakes, the same
 * /feed/owned-lakes) — and stats are read only when it is non-empty. A failed stats read is NOT
 * «no card»: the operator keeps the card, its shortcuts and a retry (`stats: null`).
 */
export const loadOwnedLakes = cache(async () => {
  const viewer = await getHomeViewer();
  const lakes = viewer?.ownedLakes ?? [];
  if (lakes.length === 0) return null;
  const stats = await quiet('owned lakes stats', (t) => getOwnedLakesStats(t));
  return { lakes, stats };
});

/** fish WidgetsList → `useMyBookingsCount({ enabled: isAuthenticated })`. */
export const loadMyBookingsCount = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer) return null;
  return quiet('bookings count', (t) => getMyBookingsUpcomingCount(t));
});

/** fish `useUnreadNotificationsCount` (the bell on the profile card). */
export const loadUnreadNotifications = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer) return null;
  const res = await quiet('unread notifications', (t) => getUnreadNotificationsForLoggedInUser(t));
  return res?.count ?? null;
});

/**
 * fish `useActivePartida`. The app knows its live partidă from a local pointer + Firestore; the
 * web has neither, so it asks the CMS which partidă is live (`/feed/sessions/active`, the same
 * probe fish runs after sign-in) and reads that session over HTTP (rods with their deadlines, and
 * the catches) for the dock. Three answers: the live partidă, null (confirmed: none) or 'failed'
 * (could not tell) — «Începe o partidă» is only offered on a confirmed null (home.acasa.s-partida-failed).
 */
export const loadActivePartida = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer) return null;
  const active = await attempt('active partida', (t) => getActiveSession(t));
  if (active === FAILED) return 'failed' as const;
  if (!active?.documentId) return null;
  const session = await attempt('active partida detail', (t) => getSession(t, active.documentId));
  if (session === FAILED) return 'failed' as const;
  return session && session.status === 'active' ? session : null;
});

/**
 * fish `useLiveCompetitionWithNewExtraScales` — the competition the user is in right now. fish asks
 * `/competitions/live?extraStatus=new`; core ports only the unfiltered read, so the `new` filter
 * is applied here (same result).
 */
export const loadMyLiveCompetition = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer) return null;
  // FAILED is kept (never folded into «not in a live competition»): the slot keeps a retry.
  const live = await attempt('live competition', (t) => getLiveCompetition(t));
  if (live === FAILED) return 'failed' as const;
  if (!live) return null;
  return { ...live, 'extra-scales': live['extra-scales'].filter((s) => s.extraStatus === 'new') };
});

/**
 * fish DashboardSheet `useActiveWeighing(competitionId)` — the weighings running right now in my
 * live competition, for the «Cântar în curs pe standul …» line. Empty when none (or no grant).
 */
export const loadActiveWeighing = cache(async (competitionId: string): Promise<CompetitionActiveWeighing[]> => {
  if (!(await getHomeViewer())) return [];
  return (await quiet('active weighing', (t) => getCompetitionActiveWeighing(t, competitionId))) ?? [];
});

/**
 * fish RaffleDashboardCard → `useRaffle` (`useRaffleActive` + `useRaffleParticipation`): the active
 * raffle session, null when there is none (the card is hidden). The session is public (cached by
 * the CMS headers); the participation is the signed-in user's own.
 */
export const loadRaffle = cache(async () => {
  const mediaOrigin = new URL(cmsUrl()).origin;
  // The participation does not depend on the session's answer: both reads run together.
  const viewer = await getHomeViewer();
  const [active, participation] = await Promise.all([
    quiet('raffle active', (t) => fetchActiveRaffle(t, { mediaOrigin })),
    viewer ? attempt('raffle participation', (t) => fetchRaffleParticipation(t, { mediaOrigin })) : null,
  ]);
  if (!active?.session) return null;
  // A failed participation read is NOT «not registered»: the card shows no join CTA (and no
  // receipt prompt) but «Nu am putut verifica înscrierea · Reîncearcă» (as PartidaCtaSlot's 'failed').
  const participationFailed = participation === FAILED;
  const state = deriveRaffleState(active, participationFailed ? null : participation, null);
  return state.sessionDocumentId ? { state, signedIn: !!viewer, participationFailed } : null;
});
