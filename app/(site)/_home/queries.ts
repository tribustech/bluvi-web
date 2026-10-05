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
 * The public reads of Acasă, built ONCE so the server prefetch (hydrate.tsx, one per rail) and the
 * browser (useQuery in the rails) use the same factory with the same arguments — same keys, so the
 * browser starts from the server's data instead of refetching.
 */

type CardParams = Omit<CompetitionCardsParams, 'page' | 'pageSize'>;

/**
 * Fresh on arrival. The server stamps the hydrated data with the time of its last cache-tag purge
 * (lib/client/hydration `hydrationTime`, cacheLife 'max'), so with the factories' own staleTime
 * (minutes) the browser would find it stale at once and refetch every public rail on every visit —
 * requests that can only fail while the CMS is down. On Acasă the data is as fresh as the page:
 * a new server render (navigation, router.refresh) hydrates the newer copy, and «Reîmprospătează»
 * refetches explicitly (HomeRefresh). Other screens sharing a key keep their own staleTime.
 */
const AS_FRESH_AS_THE_PAGE = { staleTime: Infinity } as const;

// fish (tabs)/index.tsx: same params as the Concursuri tab's default Live / Viitoare lists, so
// both screens share one cache entry.
const LIVE: CardParams = { scope: 'all', status: 'started', search: null, filters: DEFAULT_COMPETITION_FILTERS, sort: 'date' };
const UPCOMING: CardParams = { ...LIVE, status: 'notStarted' };

// `scope: 'all'` is the public endpoint: the session never changes the key or the response.
export const SIGNED_OUT = { isAuthenticated: false } as const;

export const liveCardsQuery = (t: Transport) => ({ ...competitionCardsInfiniteQuery(t, LIVE, SIGNED_OUT), ...AS_FRESH_AS_THE_PAGE });
export const upcomingCardsQuery = (t: Transport) => ({ ...competitionCardsInfiniteQuery(t, UPCOMING, SIGNED_OUT), ...AS_FRESH_AS_THE_PAGE });

/** fish `useLakes({ pageSize: 10 })` */
export const homeLakesQuery = (t: Transport) => ({ ...lakesInfiniteQuery(t, { pageSize: 10 }), ...AS_FRESH_AS_THE_PAGE });

/** fish `useNews({ pageSize: 10 })` */
export const homeNewsQuery = (t: Transport) => ({ ...newsInfiniteQuery(t, { pageSize: 10 }), ...AS_FRESH_AS_THE_PAGE });

/** fish `useSponsors` */
export const homeSponsorsQuery = (t: Transport) => ({ ...sponsorsQuery(t), ...AS_FRESH_AS_THE_PAGE });
