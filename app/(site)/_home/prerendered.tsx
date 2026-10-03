import 'server-only';
import { cache } from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import { selectCompetitionCards } from '@/core/competitions';
import { createServerTransport } from '@/lib/server/transport';
import { CompetitionsView } from './CompetitionsSection';
import { LakesView } from './LakesSection';
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
export async function CompetitionsPrerendered({ layout }: { layout: 'rail' | 'grid' }) {
  const [live, upcoming] = await loadCompetitions();
  if (!live || !upcoming) {
    return <CompetitionsView layout={layout} isLive competitions={[]} total={0} status="loading" />;
  }
  const liveCards = selectCompetitionCards(live, { scope: 'all' }, SIGNED_OUT);
  const upcomingCards = selectCompetitionCards(upcoming, { scope: 'all' }, SIGNED_OUT);
  const isLive = liveCards.competitions.length > 0;
  const cards = isLive ? liveCards : upcomingCards;
  if (cards.competitions.length === 0) return null;
  return <CompetitionsView layout={layout} isLive={isLive} competitions={cards.competitions} total={cards.total} status="ready" />;
}

export async function LakesPrerendered({ layout }: { layout: 'rail' | 'grid' }) {
  const data = await loadLakes();
  if (!data) return <LakesView layout={layout} lakes={[]} total={undefined} status="loading" />;
  return (
    <LakesView
      layout={layout}
      lakes={data.pages.flatMap((p) => p.data)}
      total={data.pages[0]?.meta.pagination.total}
      status="ready"
    />
  );
}

export async function NewsPrerendered({ layout }: { layout: 'rail' | 'grid' }) {
  const data = await loadNews();
  return <NewsView layout={layout} news={data ? data.pages.flatMap((p) => p.data) : undefined} />;
}

export async function SponsorsPrerendered({ layout }: { layout: 'mobile' | 'desktop' }) {
  const data = await loadSponsors();
  return <SponsorsView layout={layout} sponsors={data?.data ?? []} />;
}
