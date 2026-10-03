import 'server-only';
import { cache } from 'react';
import { getMyBookingsUpcomingCount, getOwnedLakes } from '@/core/booking';
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
import { isApiError } from '@/core/transport';
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

async function quiet<T>(label: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
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
  return quiet('organizer dashboard', () => getOrganizerDashboard(createServerTransport()));
});

/**
 * fish OwnedLakesCard → `useOwnedLakes` + `useOwnedLakesStats(ownsLakes)`. The owned-lakes list is
 * the authoritative ownership signal: stats are read only when it is non-empty.
 */
export const loadOwnedLakes = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer) return null;
  const t = createServerTransport();
  const lakes = await quiet('owned lakes', () => getOwnedLakes(t));
  if (!lakes || lakes.length === 0) return null;
  const stats = await quiet('owned lakes stats', () => getOwnedLakesStats(t));
  return stats ? { lakes, stats } : null;
});

/** fish WidgetsList → `useMyBookingsCount({ enabled: isAuthenticated })`. */
export const loadMyBookingsCount = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer) return null;
  return quiet('bookings count', () => getMyBookingsUpcomingCount(createServerTransport()));
});

/** fish `useUnreadNotificationsCount` (the bell on the profile card). */
export const loadUnreadNotifications = cache(async () => {
  const viewer = await getHomeViewer();
  if (!viewer) return null;
  const res = await quiet('unread notifications', () => getUnreadNotificationsForLoggedInUser(createServerTransport()));
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
  const t = createServerTransport();
  const active = await quiet('active partida', () => getActiveSession(t));
  if (!active?.documentId) return null;
  const session = await quiet('active partida detail', () => getSession(t, active.documentId));
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
  const live = await quiet('live competition', () => getLiveCompetition(createServerTransport()));
  if (!live) return null;
  return { ...live, 'extra-scales': live['extra-scales'].filter((s) => s.extraStatus === 'new') };
});

/**
 * fish DashboardSheet `useActiveWeighing(competitionId)` — the weighings running right now in my
 * live competition, for the «Cântar în curs pe standul …» line. Empty when none (or no grant).
 */
export const loadActiveWeighing = cache(async (competitionId: string): Promise<CompetitionActiveWeighing[]> => {
  if (!(await getHomeViewer())) return [];
  return (await quiet('active weighing', () => getCompetitionActiveWeighing(createServerTransport(), competitionId))) ?? [];
});

/**
 * fish RaffleDashboardCard → `useRaffle` (`useRaffleActive` + `useRaffleParticipation`): the active
 * raffle session, null when there is none (the card is hidden). The session is public (cached by
 * the CMS headers); the participation is the signed-in user's own.
 */
export const loadRaffle = cache(async () => {
  const t = createServerTransport();
  const mediaOrigin = new URL(cmsUrl()).origin;
  const active = await quiet('raffle active', () => fetchActiveRaffle(t, { mediaOrigin }));
  if (!active?.session) return null;
  const viewer = await getHomeViewer();
  const participation = viewer ? await quiet('raffle participation', () => fetchRaffleParticipation(t, { mediaOrigin })) : null;
  const state = deriveRaffleState(active, participation, null);
  return state.sessionDocumentId ? { state, signedIn: !!viewer } : null;
});
