import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import type { DehydratedState } from '@tanstack/react-query';
import { communityHistoryInfiniteQuery, communityOverviewQuery, getCommunityOverview, type CommunityOverviewDTO } from '@/core/partide';
import { ApiError, type Transport, type TransportRequest } from '@/core/transport';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';
import { e2eSkipPrefetch } from './e2e-faults';

/*
 * The server reads of Partide · Comunitate. Both are public, edge-cached CMS reads (`auth: 'none'`),
 * so they go through the cached public GET (lib/server/public-get.ts) under the CMS's own headers:
 * the overview 60s (`community-live`, purged on every partidă write), the history 5 min
 * (`community-history`). The page is therefore static and refreshes itself every minute, and the
 * browser's query takes the overview over and keeps polling it (c23).
 *
 * The first history page is read only when the overview has nothing live (fish AcasaScene: the
 * fallback section), so the HTML already carries «Ultimele partide» — never a flash of the empty
 * prose. A read that fails (or takes longer than READ_BUDGET_MS) is skipped and the page becomes
 * dynamic for that request (`connection()`), so a failure is never cached as the static page: the
 * browser then reads it itself, with the skeleton.
 */

const READ_BUDGET_MS = 5000;

function boundedTransport(): Transport {
  const t = createServerTransport();
  return {
    request<T>(req: TransportRequest) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ApiError({ message: `${req.path}: timeout`, status: 0, code: 'NETWORK', path: req.path })), READ_BUDGET_MS);
      });
      return Promise.race([t.request<T>(req), timeout]).finally(() => clearTimeout(timer));
    },
  };
}

const NONE: DehydratedState = { mutations: [], queries: [] };

/** The dehydrated overview (+ the first history page when nothing is live) for the client screen. */
export async function comunitateState(): Promise<DehydratedState> {
  if (await e2eSkipPrefetch()) {
    await connection();
    return NONE;
  }
  const t = boundedTransport();
  const first = await prefetchState([communityOverviewQuery(t)], ['community-live']);
  const overview = first.queries[0]?.state.data as CommunityOverviewDTO | undefined;
  if (!overview) {
    await connection();
    return first;
  }
  if (overview.activeVenues.length > 0) return first;
  const second = await prefetchState([communityHistoryInfiniteQuery(t, [])], ['community-history']);
  if (second.queries.length === 0) await connection();
  return { mutations: [], queries: [...first.queries, ...second.queries] };
}

/** The overview for the JSON-LD (the same cached read). Never throws. */
export const overviewForSeo = cache(async (): Promise<CommunityOverviewDTO | null> => {
  if (await e2eSkipPrefetch()) return null;
  try {
    return await getCommunityOverview(boundedTransport());
  } catch {
    return null;
  }
});
