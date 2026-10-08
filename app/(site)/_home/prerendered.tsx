import 'server-only';
import { cache, type ReactNode } from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import { selectCompetitionCards } from '@/core/competitions';
import { createServerTransport } from '@/lib/server/transport';
import { CompetitionsView } from './CompetitionsSection';
import { LakesSection, LakesView } from './LakesSection';
import { NewsView } from './NewsSection';
import { homeLakesQuery, homeNewsQuery, homeSponsorsQuery, liveCardsQuery, SIGNED_OUT, upcomingCardsQuery } from './queries';
import { SponsorsView } from './SponsorsSection';

/*
 * The public rails of Acasă as the static shell carries them. The live sections are TanStack
 * client components, and TanStack reads the current time while building query state, so during
 * prerender they suspend to their <Suspense> (page.tsx). These are those boundaries' fallbacks:
 * the same View markup from the same factories' first page, read through the cached public
 * transport — so the prerendered HTML has the titles and first cards (crawlers, first paint) and
 * the live section takes over with identical markup at request time.
 *
 * A failed read falls back to the loading skeleton: the live section shows its own error state.
 */

type Factory = { queryFn?: unknown; initialPageParam?: unknown };

/** Runs a factory's queryFn once (first page for infinite factories), the way prefetchState does. */
async function run<T>(q: Factory): Promise<T | null> {
  try {
    const infinite = 'initialPageParam' in q;
    const data = await (q.queryFn as (ctx: Record<string, unknown>) => Promise<unknown>)({
      signal: new AbortController().signal,
      meta: undefined,
      ...(infinite ? { pageParam: q.initialPageParam, direction: 'forward' } : {}),
    });
    return (infinite ? { pages: [data], pageParams: [q.initialPageParam] } : data) as T;
  } catch {
    return null;
  }
}

type Pages<F extends (...a: never[]) => { queryFn?: unknown }> = InfiniteData<
  Awaited<ReturnType<Extract<ReturnType<F>['queryFn'], (...a: never[]) => unknown>>>
>;

// Mobile and desktop compositions both mount each section: one read per render.
const loadCompetitions = cache(async () => {
  const t = createServerTransport();
  return Promise.all([
    run<Pages<typeof liveCardsQuery>>(liveCardsQuery(t)),
    run<Pages<typeof upcomingCardsQuery>>(upcomingCardsQuery(t)),
  ]);
});
const loadLakes = cache(() => run<Pages<typeof homeLakesQuery>>(homeLakesQuery(createServerTransport())));
const loadNews = cache(() => run<Pages<typeof homeNewsQuery>>(homeNewsQuery(createServerTransport())));
const loadSponsors = cache(() =>
  run<Awaited<ReturnType<Extract<ReturnType<typeof homeSponsorsQuery>['queryFn'], (...a: never[]) => unknown>>>>(
    homeSponsorsQuery(createServerTransport())
  )
);

/** Same choice as CompetitionsSection: live while anything is live, else upcoming, else nothing. */
export async function CompetitionsPrerendered() {
  const [live, upcoming] = await loadCompetitions();
  if (!live || !upcoming) return <CompetitionsView isLive competitions={[]} total={0} status="loading" />;
  const liveCards = selectCompetitionCards(live, { scope: 'all' }, SIGNED_OUT);
  const upcomingCards = selectCompetitionCards(upcoming, { scope: 'all' }, SIGNED_OUT);
  const isLive = liveCards.competitions.length > 0;
  const cards = isLive ? liveCards : upcomingCards;
  if (cards.competitions.length === 0) return null;
  return <CompetitionsView isLive={isLive} competitions={cards.competitions} total={cards.total} status="ready" />;
}

export async function LakesPrerendered() {
  const data = await loadLakes();
  if (!data) return <LakesView lakes={[]} total={undefined} loading />;
  return <LakesView lakes={data.pages.flatMap((p) => p.data)} total={data.pages[0]?.meta.pagination.total} loading={false} />;
}

export async function NewsPrerendered() {
  const data = await loadNews();
  return <NewsView news={data ? data.pages.flatMap((p) => p.data) : undefined} />;
}

export async function SponsorsPrerendered() {
  const data = await loadSponsors();
  return <SponsorsView sponsors={data?.data ?? []} />;
}

/** The live lakes section, handed the server's first page (see LakesSection `initial`). */
export async function LakesLive() {
  return <LakesSection initial={await loadLakes()} />;
}

/*
 * Gates for the stacked column's skeleton (page.tsx): its bones take the shape of what the column
 * will hold, from the public reads alone (no session). Each sits in its own <Suspense fallback={null}>
 * in the skeleton, so a short-lived read never reaches the page root.
 */

/** Its children only while sponsors exist (the Sponsori rail renders nothing without them). */
export async function IfSponsors({ children }: { children: ReactNode }) {
  const data = await loadSponsors();
  return data?.data.length ? children : null;
}
