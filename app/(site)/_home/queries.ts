import {
  competitionCardsInfiniteQuery,
  DEFAULT_COMPETITION_FILTERS,
  sponsorsQuery,
  type CompetitionCardsParams,
} from '@/core/competitions';
import { lakesInfiniteQuery } from '@/core/lakes';
import { newsInfiniteQuery } from '@/core/news';
import type { Transport } from '@/core/transport';

/*
 * The public reads of Acasă, built ONCE so the server prefetch (page.tsx → HydrateQueries) and the
 * browser (useQuery in the rails) use the same factory with the same arguments — same keys, so the
 * browser starts from the server's data instead of refetching.
 */

type CardParams = Omit<CompetitionCardsParams, 'page' | 'pageSize'>;

// fish (tabs)/index.tsx: same params as the Concursuri tab's default Live / Viitoare lists, so
// both screens share one cache entry.
const LIVE: CardParams = { scope: 'all', status: 'started', search: null, filters: DEFAULT_COMPETITION_FILTERS, sort: 'date' };
const UPCOMING: CardParams = { ...LIVE, status: 'notStarted' };

// `scope: 'all'` is the public endpoint: the session never changes the key or the response.
export const SIGNED_OUT = { isAuthenticated: false } as const;

export const liveCardsQuery = (t: Transport) => competitionCardsInfiniteQuery(t, LIVE, SIGNED_OUT);
export const upcomingCardsQuery = (t: Transport) => competitionCardsInfiniteQuery(t, UPCOMING, SIGNED_OUT);

/** fish `useLakes({ pageSize: 10 })` */
export const homeLakesQuery = (t: Transport) => lakesInfiniteQuery(t, { pageSize: 10 });

/** fish `useNews({ pageSize: 10 })` */
export const homeNewsQuery = (t: Transport) => newsInfiniteQuery(t, { pageSize: 10 });

/** fish `useSponsors` */
export const homeSponsorsQuery = (t: Transport) => sponsorsQuery(t);

/** Everything public on Acasă, for the server prefetch. */
export const publicHomeQueries = (t: Transport) => [
  liveCardsQuery(t),
  upcomingCardsQuery(t),
  homeLakesQuery(t),
  homeNewsQuery(t),
  homeSponsorsQuery(t),
];

/** The CMS cache tags (X-Cache-Tag) of those reads: a purge of any of them refreshes the stamp. */
export const PUBLIC_HOME_TAGS = ['competitions-list', 'lakes-list', 'announcements-list', 'sponsors'];
