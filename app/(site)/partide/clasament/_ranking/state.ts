import 'server-only';
import { connection } from 'next/server';
import type { DehydratedState } from '@tanstack/react-query';
import { communityStatsQuery, type CommunityStatsDTO } from '@/core/partide';
import { ApiError, type Transport, type TransportRequest } from '@/core/transport';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';
import { e2eSkipPrefetch } from '../../_comunitate/e2e-faults';
import { DEFAULT_PERIOD } from './place';

/*
 * The server read of «Clasamente» (partide.clasament): the community stats of the DEFAULT period
 * (luna), `GET /feed/community/stats?period=month` — public and edge-cached (`auth: 'none'`), so it
 * goes through the cached public GET (lib/server/public-get.ts) under the CMS's own headers and tag
 * (`community-stats`): the page is prerendered with it and the browser's query takes the same key
 * over. Another period from the URL (?perioada=) is read in the browser.
 *
 * A read that fails (or outlives READ_BUDGET_MS) is skipped and the page becomes dynamic for that
 * request (`connection()`), so a failure is never cached as the static page: the browser reads it
 * itself, behind the skeleton. The e2e switch is the hub's (../../_comunitate/e2e-faults.ts: a
 * per-context cookie, dev only).
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

/** The dehydrated default-period stats for the client screen (empty when skipped or failed). */
export async function rankingState(): Promise<DehydratedState> {
  if (await e2eSkipPrefetch()) {
    await connection();
    return NONE;
  }
  const state = await prefetchState([communityStatsQuery(boundedTransport(), DEFAULT_PERIOD)], ['community-stats']);
  if (state.queries.length < 1) await connection();
  return state;
}

/** The prefetched stats (the JSON-LD), or null. */
export function statsOf(state: DehydratedState): CommunityStatsDTO | null {
  const data = state.queries[0]?.state.data as CommunityStatsDTO | undefined;
  return data && typeof data === 'object' && 'totals' in data ? data : null;
}
