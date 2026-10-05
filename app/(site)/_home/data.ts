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
import { isApiError, type Transport } from '@/core/transport';
import { cmsUrl } from '@/lib/server/env';
import { createServerTransport } from '@/lib/server/transport';
import { getViewer, type Viewer } from '@/lib/server/viewer';

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
 * reveal) before it gives up and the block is hidden as if the read had failed.
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

/** A read that may fail or time out (bounded transport): null, never a thrown error. */
async function quiet<T>(label: string, read: (t: Transport) => Promise<T>): Promise<T | null> {
  try {
    return await read(boundedTransport());
  } catch (e) {
    // A 4xx is an answer (no grant for this role, nothing to show), not an outage: stay quiet.
    if (!(isApiError(e) && e.status >= 400 && e.status < 500)) console.error(`[acasa] ${label} failed`, e);
    return null;
  }
}

export type HomeViewer = Viewer & { isOrganizer: boolean };

/** fish `useOrganizerDashboard`: organiser = role «Organizer». */
export const getHomeViewer = cache(async (): Promise<HomeViewer | null> => {
  const viewer = await getViewer();
  return viewer ? { ...viewer, isOrganizer: viewer.role === 'Organizer' } : null;
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
 * the catches) for the dock.
 */
export const loadActivePartida = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer) return null;
  const active = await quiet('active partida', (t) => getActiveSession(t));
  if (!active?.documentId) return null;
  const session = await quiet('active partida detail', (t) => getSession(t, active.documentId));
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
  const live = await quiet('live competition', (t) => getLiveCompetition(t));
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
    viewer ? quiet('raffle participation', (t) => fetchRaffleParticipation(t, { mediaOrigin })) : null,
  ]);
  if (!active?.session) return null;
  const state = deriveRaffleState(active, participation, null);
  return state.sessionDocumentId ? { state, signedIn: !!viewer } : null;
});
