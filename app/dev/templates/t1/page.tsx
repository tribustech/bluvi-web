import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import {
  FilterColumnSkeleton,
  ListHeader,
  ListPageSkeleton,
  ListSkeleton,
  ListSummary,
  TabsSkeleton,
} from '@/components/templates/T1';
import { competitionCardsInfiniteQuery, PULSE_CARD_PARAMS } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { prefetchState } from '@/lib/client/hydration';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import { CompetitionRowsHead } from './CompetitionItems';
import { CompetitionsDemo } from './CompetitionsDemo';
import {
  headingFor,
  initialFor,
  initialFromUrl,
  isResultsMode,
  listParamsFor,
  REGISTERED_PARAMS,
  rowEndFor,
  showsPulse,
  type DemoPlace,
  type UrlParams,
} from './demoInitial';
import { demoKey, forcesFirstPage } from './demoTransport';
import { PulseHeroSkeleton } from './PulseHero';
import { bounded, delayed, readViewer } from './serverReads';
import { DEMO_PATH, parseDemoState, type DemoState } from './StateSwitcher';

/*
 * /dev/templates/t1 — T1 «Listă cu filtre» rendered as its first user, Concursuri (fish
 * (tabs)/competitions/index.tsx), with real data from the local CMS through core/. `?state=` forces
 * each state (see StateSwitcher). Dev only: 404 in production builds, like /dev/kit (layout.tsx).
 *
 * The layout owns the top bar and the state band. The read is split in two:
 *  - Routed awaits only `searchParams` (no I/O) and picks the fallback in the shape the list will
 *    OPEN in (initialFromUrl, shared with the client list): tabs or the results header, bento or
 *    not, the summary's real title, cards or rows. Its own fallback (the static shell, before the
 *    URL is known) is the default place, Viitoare.
 *  - Demo does the bounded server reads (serverReads.ts: they all start together, a slow CMS costs
 *    one budget, then the browser's queries take over) and renders the list.
 * So the content fills the frame in place when the stream resolves — never a bento swapped for rows.
 */

export const metadata: Metadata = { title: 'T1 · Listă cu filtre', robots: { index: false } };

type Props = { searchParams: Promise<UrlParams> };

export default function T1DemoPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<DemoFallback place={initialFor('live')} />}>
      <Routed searchParams={searchParams} />
    </Suspense>
  );
}

async function Routed({ searchParams }: Props) {
  const url = await searchParams;
  const state = parseDemoState(url.state);
  const place = initialFromUrl(state, url);
  return (
    <Suspense fallback={<DemoFallback place={place} />}>
      <Demo url={url} state={state} place={place} />
    </Suspense>
  );
}

/** Two option sets read the same cache entry. */
const sameKey = (a: { queryKey: readonly unknown[] }, b: { queryKey: readonly unknown[] }) =>
  JSON.stringify(a.queryKey) === JSON.stringify(b.queryKey);

async function Demo({ url, state, place }: { url: UrlParams; state: DemoState; place: DemoPlace }) {
  const signedOut = state === 'signed-out' || state === 'gate';
  // Outages forced on page 1 live in the browser transport; a server prefetch would only be bypassed.
  // The other forced states (page ≥ 2, the followed scope) are read here like production, under the
  // state's own keys (demoKey), so their first paint is hydrated too.
  const prefetch = !forcesFirstPage(state);
  // ?state=slow-server: every server read starts past the budget, so the fallback hands over to the
  // browser's queries — the slow-CMS path, made visible.
  const inner: Transport = state === 'slow-server' ? delayed(createServerTransport()) : createServerTransport();
  const t = bounded(inner);

  // The list the URL asks for (Rezultate, a search, filters, «Urmărite»), when it is not one of the
  // lists read anyway (the pulse lists, «Ale mele») — so a deep link's first paint has its content
  // in the HTML (crawlers, no-JS, LCP) instead of a skeleton that fetches after hydration.
  const urlParams = listParamsFor(place);
  const shared = [
    competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.upcoming, { isAuthenticated: false }),
    competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.live, { isAuthenticated: false }),
  ];
  const perUser = [competitionCardsInfiniteQuery(t, REGISTERED_PARAMS, { isAuthenticated: true })];
  const urlList = competitionCardsInfiniteQuery(t, urlParams, { isAuthenticated: place.scope !== 'all' });
  if (![...shared, ...perUser].some((q) => sameKey(q, urlList))) {
    // Public lists go in the shared (tagged) state; a per-user list in the untagged one.
    (place.scope === 'all' ? shared : perUser).push(urlList);
  }

  // Started together, awaited together: the session, the shared lists (bento, aside, Viitoare, the
  // URL's public list) and — with a session cookie — the per-user lists, so the tabs, their badge
  // and the aside block are in the first paint instead of popping in after hydration.
  const token = signedOut ? undefined : await getSessionToken();
  const [viewer, sharedState, mine] = await Promise.all([
    token ? readViewer() : Promise.resolve(null),
    prefetch ? prefetchState(shared.map((q) => demoKey(q, state)), ['competitions-list']) : null,
    prefetch && token ? prefetchState(perUser.map((q) => demoKey(q, state)), []) : null,
  ]);

  // 'unknown' (a session cookie, but the read ran over budget) is still signed in: the per-user
  // queries run through the /api/cms proxy, which knows the cookie. Only a real «no session» is out.
  const isAuthenticated = viewer === 'unknown' || Boolean(viewer);
  // Keyed by state: each state starts from its own tab / search / filters (then the URL's).
  let demo: ReactNode = <CompetitionsDemo key={state} state={state} isAuthenticated={isAuthenticated} url={url} />;
  if (mine && isAuthenticated) demo = <HydrationBoundary state={mine}>{demo}</HydrationBoundary>;
  if (sharedState) demo = <HydrationBoundary state={sharedState}>{demo}</HydrationBoundary>;
  return demo;
}

/**
 * The loaded page's frame for a place, while the server reads: the results header (back square,
 * the question, the reserved band) or the tabs; the bento only where the list opens on it; the
 * summary's real title; rows for «Listă», cards for «Afiș»; the aside docked from 1440, as the list.
 */
function DemoFallback({ place }: { place: DemoPlace }) {
  const results = isResultsMode(place);
  const heading = headingFor(place);
  const label = 'Se încarcă concursurile…';
  const list =
    place.density === 'list' ? (
      <ListSkeleton variant="rows" count={6} label={label} head={<CompetitionRowsHead end={rowEndFor(place)} />} />
    ) : (
      <ListSkeleton variant="cards" min="sm" count={6} label={label} />
    );
  return (
    <div aria-busy>
      <ListPageSkeleton
        title="Competiții"
        header={
          results ? (
            <ListHeader title={heading} back={{ label: 'Înapoi la concursuri', href: DEMO_PATH }} reserveBelow="Se caută…" />
          ) : (
            <ListHeader title="Competiții" below={<TabsSkeleton count={3} />} />
          )
        }
        filters={<FilterColumnSkeleton switchRow sections={[5, 3]} />}
        aside={1}
        asideFrom="2xl"
        searchPlaceholder={place.search?.label ?? 'Concurs, baltă sau organizator'}
        hero={showsPulse(place) ? <PulseHeroSkeleton /> : undefined}
        summaryTitle={heading}
        summary={results ? <ListSummary variant="quiet" title="Se caută…" titleHiddenFrom="xl" /> : undefined}
        list={list}
        label={label}
      />
    </div>
  );
}
