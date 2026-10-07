import 'server-only';
import { connection } from 'next/server';
import type { DehydratedState } from '@tanstack/react-query';
import { communityStatsQuery, type StatsPeriod } from '@/core/partide';
import { ApiError, type Transport, type TransportRequest } from '@/core/transport';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';
import { e2eSkipPrefetch } from '../../_comunitate/e2e-faults';

/*
 * The server read of «Statistici comunitate»: `/feed/community/stats?period=` is a public,
 * edge-cached CMS read (`auth: 'none'`, tag `community-stats`), so it goes through the cached public
 * GET (lib/server/public-get.ts) under the CMS's own headers — one cache entry per period, shared by
 * every visitor. The client query (core communityStatsQuery, staleTime 120s) takes the hydrated
 * answer over and reads the other periods itself.
 *
 * A read that fails or takes longer than READ_BUDGET_MS is skipped and the request becomes dynamic
 * (`connection()`), so a failure is never cached as the page: the browser reads it itself, with the
 * skeleton, and shows its own error (parity partide.statistici.c3).
 * The e2e tests switch the prefetch off per browser context (dev only, ../../_comunitate/e2e-faults)
 * to serve the reads with page.route.
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

/** The dehydrated period for the client screen (nothing when the read failed or is switched off). */
export async function statsState(period: StatsPeriod): Promise<DehydratedState> {
  if (await e2eSkipPrefetch()) {
    await connection();
    return NONE;
  }
  const state = await prefetchState([communityStatsQuery(boundedTransport(), period)], ['community-stats']);
  if (state.queries.length === 0) await connection();
  return state;
}

