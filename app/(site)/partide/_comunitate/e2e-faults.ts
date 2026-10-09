import 'server-only';
import { cookies } from 'next/headers';
import type { DehydratedState } from '@tanstack/react-query';
import type { CommunityOverviewDTO, CommunityVenueDTO } from '@/core/partide';

/*
 * Development-only fault switch for the Partide e2e tests (tests/e2e/partide-comunitate.spec.ts,
 * tests/e2e/partide-hub-hydration.spec.ts). The overview and the first history page are read on the
 * server and hydrated, so page.route can neither shape nor slow them. A test sets the cookie
 * `bluvi-e2e-partide=<tokens>` (comma-separated) on ITS browser context, and only that context's
 * renders change:
 *  - `noprefetch`: the page skips its community reads; the browser makes them itself and the test
 *    serves them with page.route;
 *  - `hold:<ms>` (≤ 10 000): the community read waits that long first, so the Comunitate boundary
 *    streams in late — the shell hydrates (and the header's live probe answers) before it does,
 *    the race behind the M8 «/partide hydration mismatch»;
 *  - `selfvenue`: the hydrated overview's live section is one fixture venue (three partide: the
 *    leaderboard card) whose board holds the signed-in viewer (c15's self row, server-rendered).
 * Per request, not process-wide — the dev server is shared, so another test's /partide (the visual
 * spec) keeps the server prefetch, and a crashed spec leaves nothing behind.
 * In production builds this is a no-op (NODE_ENV is inlined, the cookie is never read), so the page
 * stays static.
 */

export const E2E_FAULT_COOKIE = 'bluvi-e2e-partide';

type Faults = { noprefetch: boolean; holdMs: number; selfVenue: boolean };
const NONE: Faults = { noprefetch: false, holdMs: 0, selfVenue: false };

export async function e2eFaults(): Promise<Faults> {
  if (process.env.NODE_ENV === 'production') return NONE;
  const raw = (await cookies()).get(E2E_FAULT_COOKIE)?.value;
  if (!raw) return NONE;
  const tokens = raw.split(',').map(s => s.trim());
  const hold = tokens.find(s => s.startsWith('hold:'));
  const holdMs = hold ? Math.min(10_000, Math.max(0, Number(hold.slice(5)) || 0)) : 0;
  return { noprefetch: tokens.includes('noprefetch'), holdMs, selfVenue: tokens.includes('selfvenue') };
}

/** `noprefetch`: this request's page leaves its community reads to the browser (dev only). */
export async function e2eSkipPrefetch(): Promise<boolean> {
  return (await e2eFaults()).noprefetch;
}

/** `hold:<ms>`: wait before the community read (dev only; 0 otherwise). */
export async function e2eHold(): Promise<void> {
  const { holdMs } = await e2eFaults();
  if (holdMs > 0) await new Promise(resolve => setTimeout(resolve, holdMs));
}

/** `selfvenue`: the overview's live section replaced by one venue with the viewer on its board. */
export function e2eSelfVenue(state: DehydratedState, viewerUid: string): DehydratedState {
  const q = state.queries[0];
  const overview = q?.state.data as CommunityOverviewDTO | undefined;
  if (!q || !overview) return state;
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const member = (uid: string, name: string) => ({ uid, name, avatarUrl: null });
  const venue: CommunityVenueDTO = {
    key: 'lake:e2e-self-venue',
    venueType: 'lake',
    lakeId: null,
    name: 'Lacul E2E',
    locality: 'Ilfov',
    imageUrl: null,
    sessions: [
      { documentId: 'e2e-self-1', startedAt: ago(300), members: [member('e2e-u-1', 'Vlad Matei')], catchCount: 6, maxKg: 9, totalKg: 31.4, standName: '3' },
      { documentId: 'e2e-self-2', startedAt: ago(280), members: [member('e2e-u-2', 'Dan Stoica')], catchCount: 4, maxKg: 7, totalKg: 18.9, standName: '5' },
      { documentId: 'e2e-self-3', startedAt: ago(250), members: [member(viewerUid, 'Eu')], catchCount: 1, maxKg: 3, totalKg: 3, standName: '9' },
    ],
  };
  return { ...state, queries: [{ ...q, state: { ...q.state, data: { ...overview, activeVenues: [venue] } } }, ...state.queries.slice(1)] };
}
