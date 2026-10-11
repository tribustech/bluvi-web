import 'server-only';
import { cache, Suspense, type ReactNode } from 'react';
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
 *
 * Each fallback's read sits in a <Suspense> of its own (the loading markup as ITS fallback), so a
 * fallback never suspends itself. At request time the live section can finish before its fallback's
 * read: an unwrapped fallback was then a pending segment («P:n») inside the outer boundary's fallback
 * region, React's batched reveal ($RV) removed that region, and the late segment's $RS threw
 * «Cannot read properties of null (reading 'parentNode')». A nested boundary is safe there: its late
 * $RC finds no boundary and drops the segment.
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

const competitionsLoading = <CompetitionsView isLive competitions={[]} total={0} status="loading" />;

export function CompetitionsPrerendered() {
  return (
    <Suspense fallback={competitionsLoading}>
      <CompetitionsRead />
    </Suspense>
  );
}

/** Same choice as CompetitionsSection: live while anything is live, else upcoming, else nothing. */
async function CompetitionsRead() {
  const [live, upcoming] = await loadCompetitions();
  if (!live || !upcoming) return competitionsLoading;
  const liveCards = selectCompetitionCards(live, { scope: 'all' }, SIGNED_OUT);
  const upcomingCards = selectCompetitionCards(upcoming, { scope: 'all' }, SIGNED_OUT);
  const isLive = liveCards.competitions.length > 0;
  const cards = isLive ? liveCards : upcomingCards;
  if (cards.competitions.length === 0) return null;
  return <CompetitionsView isLive={isLive} competitions={cards.competitions} total={cards.total} status="ready" />;
}

const lakesLoading = <LakesView lakes={[]} total={undefined} loading />;

export function LakesPrerendered() {
  return (
    <Suspense fallback={lakesLoading}>
      <LakesRead />
    </Suspense>
  );
}

async function LakesRead() {
  const data = await loadLakes();
  if (!data) return lakesLoading;
  return <LakesView lakes={data.pages.flatMap((p) => p.data)} total={data.pages[0]?.meta.pagination.total} loading={false} />;
}

export function NewsPrerendered() {
  return (
    <Suspense fallback={<NewsView news={undefined} />}>
      <NewsRead />
    </Suspense>
  );
}

async function NewsRead() {
  const data = await loadNews();
  return <NewsView news={data ? data.pages.flatMap((p) => p.data) : undefined} />;
}

/** Nothing while it reads: the rail renders nothing without sponsors either. */
export function SponsorsPrerendered() {
  return (
    <Suspense fallback={null}>
      <SponsorsRead />
    </Suspense>
  );
}

async function SponsorsRead() {
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
