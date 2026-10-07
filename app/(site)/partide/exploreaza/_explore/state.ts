import 'server-only';
import { connection } from 'next/server';
import type { DehydratedState } from '@tanstack/react-query';
import { communityActiveInfiniteQuery, communityHistoryInfiniteQuery, type CommunityHistoryPage } from '@/core/partide';
import { ApiError, type Transport, type TransportRequest } from '@/core/transport';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';
import { e2eSkipPrefetch } from '../../_comunitate/e2e-faults';

/*
 * The server reads of Partide · Explorează: live page 1 and finished page 1 of the UNFILTERED view
 * (partide.exploreaza). Both are public, edge-cached CMS reads (`auth: 'none'`), so they go through
 * the cached public GET (lib/server/public-get.ts) under the CMS's own headers and tags
 * (`community-live`, `community-history`, purged on every partidă write): the page is static, and the
 * browser's infinite queries take the same keys over and load the next pages.
 *
 * A filtered view (?live, ?filtru, ?loc) is read in the browser — the chips filter these same pages,
 * a venue changes the query key (c4). A read that fails (or outlives READ_BUDGET_MS) is skipped and
 * the page becomes dynamic for that request (`connection()`), so a failure is never cached as the
 * static page: the browser reads it itself, behind the list skeleton. The e2e switch is the hub's
 * (../../_comunitate/e2e-faults.ts: a per-context cookie, dev only).
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

/** The dehydrated live page 1 + finished page 1 (unfiltered) for the client screen. */
export async function exploreState(): Promise<DehydratedState> {
  if (await e2eSkipPrefetch()) {
    await connection();
    return NONE;
  }
  const t = boundedTransport();
  const state = await prefetchState(
    [communityActiveInfiniteQuery(t, []), communityHistoryInfiniteQuery(t, [])],
    ['community-live', 'community-history'],
  );
  if (state.queries.length < 2) await connection();
  return state;
}

/** The finished rows of the prefetched first page (the JSON-LD list), or none. */
export function prefetchedHistory(state: DehydratedState): CommunityHistoryPage['data'] {
  const q = state.queries.find(x => x.queryKey[1] === 'history');
  const data = q?.state.data as { pages?: CommunityHistoryPage[] } | undefined;
  return data?.pages?.[0]?.data ?? [];
}
