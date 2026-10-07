import type { BrowserContext, Page, Route } from '@playwright/test';
import { setPartideNoPrefetch } from './partide-comunitate.fixtures';

/*
 * «Clasamente» (/partide/clasament) fixtures: `/feed/community/stats?period=` answers served with
 * page.route (direct to the CMS or through /api/cms). The page's server read is skipped per
 * context with the hub's dev-only `noprefetch` cookie, so the browser reads the stats itself. Read
 * only: nothing is written anywhere.
 */

export const IMG = 'https://fixtures.bluvi.test';

type Angler = { uid: string; name: string | null; avatarUrl: string | null; partide: number; catches: number; totalKg: number };

const angler = (uid: string, name: string | null, partide: number, catches: number, totalKg: number, avatar = false): Angler => ({
  uid,
  name,
  avatarUrl: avatar ? `${IMG}/poster.jpg` : null,
  partide,
  catches,
  totalKg,
});

export const ANGLERS: Angler[] = [
  angler('a-1', 'Andrei Popescu', 6, 21, 48.35, true),
  angler('a-2', 'Mihai Ionescu', 5, 18, 41.2),
  angler('a-3', 'Radu Stan', 4, 12, 30.05),
  angler('a-4', 'Ioana Dobre', 3, 9, 22.5),
  angler('a-5', 'Cristian Marin', 1, 1, 10.5),
  angler('a-6', null, 2, 4, 6.75),
];

export const VENUES = [
  { key: 'lake:lake-1', name: 'Lacul Chita', locality: 'Corbu', lakeId: 'lake-1', imageUrl: null, partide: 12, catches: 40, liveCount: 1 },
  { key: 'water:RO-12', name: 'Râul Argeș', locality: null, lakeId: null, imageUrl: null, partide: 1, catches: 1, liveCount: 0 },
];

export const SPECIES = [
  { name: 'Crap', count: 30, pct: 75 },
  { name: 'Caras', count: 9, pct: 22.5 },
  { name: 'Șalău', count: 1, pct: 2.5 },
];

type Stats = {
  period: 'week' | 'month' | 'year';
  totals: { partide: number; anglers: number; catches: number; totalKg: number };
  weeklySeries: unknown[];
  topAnglers: Angler[];
  topVenues: typeof VENUES;
  record: null;
  species: typeof SPECIES;
};

export function stats(period: Stats['period'], over: Partial<Omit<Stats, 'period'>> = {}): Stats {
  return {
    period,
    totals: { partide: 21, anglers: 12, catches: 65, totalKg: 159.35 },
    weeklySeries: [],
    topAnglers: ANGLERS,
    topVenues: VENUES,
    record: null,
    species: SPECIES,
    ...over,
  };
}

export const EMPTY = (period: Stats['period']) =>
  stats(period, { totals: { partide: 0, anglers: 0, catches: 0, totalKg: 0 }, topAnglers: [], topVenues: [], species: [] });

/** One answer per period: the stats, 'error' (a 500), or the stats after `delayMs`. */
export type StatsMock = Partial<Record<Stats['period'], Stats | 'error'>> & { delayMs?: Partial<Record<Stats['period'], number>> };

const json = (body: unknown, status = 200) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });

export async function mockStats(page: Page, mock: StatsMock) {
  const hits: string[] = [];
  const state = { ...mock };
  await page.route('**/feed/community/stats*', async (route) => {
    const url = new URL(route.request().url());
    const period = (url.searchParams.get('period') ?? 'month') as Stats['period'];
    hits.push(period);
    const delay = state.delayMs?.[period];
    if (delay) await new Promise((r) => setTimeout(r, delay));
    const answer = state[period];
    if (!answer || answer === 'error') return json({ error: { status: 500 } }, 500)(route);
    return json({ data: answer })(route);
  });
  return { hits, state };
}

export async function prepareContext(context: BrowserContext) {
  await setPartideNoPrefetch(context);
}
