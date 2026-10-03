import 'server-only';
import type { ReactNode } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { HydrationBoundary, QueryClient, type DehydratedState, type QueryKey } from '@tanstack/react-query';
import type { Transport } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';

/**
 * Server half of the server → browser query-cache bridge (the browser half is the
 * QueryClientProvider in app/providers.tsx). A Server Component prefetches `core/` query factories
 * with the server transport; client children `useQuery` the SAME factory with
 * `createBrowserTransport()` and start from that data instead of fetching on mount.
 *
 * @example
 * // app/(site)/concursuri/[id]/page.tsx (Server Component)
 * <HydrateQueries
 *   queries={(t) => [competitionQuery(t, id, { isAuthenticated: false })]}
 *   tags={[`competition:${id}`]}
 * >
 *   <CompetitionView id={id} />
 * </HydrateQueries>
 *
 * // CompetitionView.tsx ('use client')
 * const t = useMemo(() => createBrowserTransport(), []);
 * const { data } = useQuery(competitionQuery(t, id, { isAuthenticated: false }));
 *
 * Rules:
 * - Same factory, same arguments on both sides, or the keys differ and the client refetches.
 * - Public reads (`auth: 'none'`) keep the page prerenderable. A per-user factory reads the session
 *   cookie, so put that <HydrateQueries> inside a <Suspense> boundary.
 * - A failed prefetch is skipped (not thrown): the client query fetches and shows its own error.
 * - Infinite factories hydrate their first page.
 */
export async function HydrateQueries({
  queries,
  tags,
  children,
}: {
  queries: (t: Transport) => readonly Prefetchable[];
  /** CMS cache tags of the data (X-Cache-Tag, e.g. `competition:<id>`); see hydrationTime. */
  tags?: readonly string[];
  children: ReactNode;
}) {
  const state = await prefetchState(queries(createServerTransport()), tags ?? []);
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}

/** Structural view of what `queryOptions` / `infiniteQueryOptions` factories return. */
export type Prefetchable = {
  queryKey: QueryKey;
  queryFn?: unknown;
  enabled?: unknown;
  initialPageParam?: unknown;
};

type QueryFn = (ctx: Record<string, unknown>) => Promise<unknown>;

/**
 * Runs each factory's queryFn and builds the dehydrated state by hand. TanStack's own
 * `prefetchQuery` + `dehydrate` stamp `Date.now()`, which Cache Components rejects while
 * prerendering (blocking-prerender-current-time); the timestamp comes from hydrationTime instead
 * (pattern from node_modules/next/dist/docs/.../client-side-data-fetching/tanstack-query.md).
 */
export async function prefetchState(queries: readonly Prefetchable[], tags: readonly string[]): Promise<DehydratedState> {
  const qc = new QueryClient();
  const runnable = queries.filter((q) => typeof q.queryFn === 'function' && q.enabled !== false);
  const results = await Promise.allSettled(
    runnable.map(async (q) => {
      const infinite = 'initialPageParam' in q;
      const data = await (q.queryFn as QueryFn)({
        queryKey: q.queryKey,
        signal: new AbortController().signal,
        meta: undefined,
        client: qc,
        ...(infinite ? { pageParam: q.initialPageParam, direction: 'forward' } : {}),
      });
      return { queryKey: q.queryKey, data: infinite ? { pages: [data], pageParams: [q.initialPageParam] } : data };
    })
  );
  const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (ok.length === 0) return { mutations: [], queries: [] };

  const updatedAt = await hydrationTime(ok.map((q) => JSON.stringify(q.queryKey)).join('|'), [...tags]);
  for (const q of ok) qc.setQueryData(q.queryKey, q.data, { updatedAt });

  return {
    mutations: [],
    queries: qc
      .getQueryCache()
      .getAll()
      .map((query) => ({
        dehydratedAt: updatedAt,
        queryHash: query.queryHash,
        queryKey: query.queryKey,
        state: query.state,
      })),
  };
}

/**
 * "When was this data fetched", as a cached value so a static page can carry it. With the data's
 * cache tags it advances exactly when a purge refreshes the data; without them it is at most a
 * minute old (and the page using it revalidates every minute — pass tags on hot public pages).
 * The browser keeps whichever copy is newer, so an older stamp only costs one refetch.
 */
async function hydrationTime(key: string, tags: string[]): Promise<number> {
  'use cache';
  void key; // part of the cache key: one stamp per set of queries
  if (tags.length > 0) {
    cacheTag(...tags);
    cacheLife('max');
  } else {
    cacheLife('minutes');
  }
  return Date.now();
}
