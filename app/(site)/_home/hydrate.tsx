import 'server-only';
import { cache, type ReactNode } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';
import { homeLakesQuery, homeNewsQuery, homeSponsorsQuery, liveCardsQuery, upcomingCardsQuery } from './queries';

/*
 * The server prefetch of each public rail, INSIDE that rail's <Suspense> (page.tsx), never at the
 * page root. A read that fails or comes back short-lived (cacheLife 'seconds', or a stale time the
 * App Shell leaves out) is a dynamic hole: inside a boundary it stays behind that rail's
 * prerendered fallback; at the root it blocked the whole route (no static shell) and turned a CMS
 * outage during `next build` into a prerender error. One prefetch per rail per request (React
 * `cache`), though the stacked and the column compositions both mount it.
 */

const RAILS = {
  competitions: { queries: () => [liveCardsQuery(createServerTransport()), upcomingCardsQuery(createServerTransport())], tags: ['competitions-list'] },
  lakes: { queries: () => [homeLakesQuery(createServerTransport())], tags: ['lakes-list'] },
  news: { queries: () => [homeNewsQuery(createServerTransport())], tags: ['announcements-list'] },
  sponsors: { queries: () => [homeSponsorsQuery(createServerTransport())], tags: ['sponsors'] },
} as const;

export type PublicRail = keyof typeof RAILS;

const railState = cache((rail: PublicRail) => prefetchState(RAILS[rail].queries(), RAILS[rail].tags));

export async function HydrateRail({ rail, children }: { rail: PublicRail; children: ReactNode }) {
  return <HydrationBoundary state={await railState(rail)}>{children}</HydrationBoundary>;
}
