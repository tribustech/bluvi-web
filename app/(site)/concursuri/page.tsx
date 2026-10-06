import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import { FilterBarSkeleton, ListHeader, ListPageSkeleton, ListSummary, PILL_H, TabsSkeleton } from '@/components/templates/T1';
import { DashboardRefresh } from '@/components/templates/T5';
import { AdjustmentsHorizontalIcon, ArrowLeftIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { SHELL_GUTTERS } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import {
  competitionCardsInfiniteQuery,
  featuredCompetitionQuery,
  PULSE_CARD_PARAMS,
  pulsePersonQuery,
  type CompetitionCard,
  type CompetitionCardsPage,
} from '@/core/competitions';
import { prefetchState } from '@/lib/client/hydration';
import { absoluteUrl, routes } from '@/lib/routes';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import { getShellSession } from '../_shell/session';
import { userOf } from '../_shell/viewer-state';
import { CompetitionsFallbackBody, CompetitionsScreen } from './_list/CompetitionsScreen';
import { DENSITY_COOKIE, parseDensity, type Density } from './_list/densityValue';
import { PulseSkeleton } from './_list/pulse/PulseBento';
import {
  chipLabels,
  headingFor,
  isResultsMode,
  listParamsFor,
  placeFromUrl,
  REGISTERED_PARAMS,
  resultsLabelFor,
  showsPulse,
  type ListPlace,
  type UrlParams,
} from './_list/place';
import { RESULTS_BACK, RESULTS_REFRESH, RESULTS_ROW, RESULTS_STACK, resultsCircleClass, resultsPillClass } from './_list/resultsChromeStyles';
import { ScreenBoundary } from './_list/ScreenBoundary';
import { bounded } from './_list/server';
import { jsonLdHtml } from '@/lib/json-ld';

/*
 * Concursuri — fish app/(app)/(tabs)/competitions/index.tsx on template T1 (parity
 * docs/parity/areas/competitions-list.yml: index, pulse, cards).
 *
 * Rendering: the place (tab, scope, search, filters) is in the URL, so the route reads
 * `searchParams` behind a <Suspense> whose fallback is the page's own frame. The data component
 * then prefetches, bounded (./_list/server.ts), every list the first paint shows — the bento's
 * Live / Viitoare / Rezultate pages (shared, tagged `competitions-list`, the CMS's Cache-Tag for
 * /feed/competition-cards) and, with a session, «Ale mele» and the followed-live count — and hands
 * them to the client list, which takes over the same core/ queries (HydrationBoundary). The cards
 * are in the streamed HTML (crawlers, first paint), with an ItemList of SportsEvent as JSON-LD.
 * Where the bento shows, its person (/feed/pulse-person) and featured competition are read too
 * (public, cached by the CMS's 30 min TTL): the first paint has the whole bento, not skeletons.
 * The «Listă» / «Afiș» choice comes from its cookie, so the cards (and their skeleton) render in it.
 */

const TITLE = 'Concursuri de pescuit';
const DESCRIPTION =
  'Concursurile de pescuit sportiv din România: cele care încep curând, cele live cu clasament în timp real și rezultatele celor încheiate. Înscrie-te și urmărește-le pe Bluvi.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: routes.competitions() },
  openGraph: {
    type: 'website',
    url: routes.competitions(),
    siteName: 'Bluvi',
    locale: 'ro_RO',
    title: `${TITLE} · Bluvi`,
    description: DESCRIPTION,
  },
  twitter: { card: 'summary', title: `${TITLE} · Bluvi`, description: DESCRIPTION },
};

type Props = { searchParams: Promise<UrlParams> };

export default function CompetitionsPage({ searchParams }: Props) {
  return (
    <ScreenBoundary>
      {/* The static shell (cacheComponents) is the same for every /concursuri URL: a mode-neutral
          frame — no tabs, bento, aside or summary title that a results or filtered URL would then
          swap out. Only the inner fallback, which knows the place, commits to index or results. */}
      <Suspense fallback={<NeutralFallback />}>
        <Routed searchParams={searchParams} />
      </Suspense>
      <StatusListsNav />
    </ScreenBoundary>
  );
}

const STATUS_LINKS = [
  { status: 'notStarted', label: 'Viitoare' },
  { status: 'started', label: 'Live' },
  { status: 'completed', label: 'Rezultate' },
] as const;

/**
 * The three status tabs as plain links (/concursuri?status=…; the old /concursuri/viitoare · /live
 * · /incheiate redirect there): at the page's end, in the static shell, so people and crawlers find
 * them — in the tabs' own order and names (Viitoare · Live · Rezultate). Inside the page's bottom
 * padding (ListPage pb-10 / pb-16), under the list.
 */
function StatusListsNav() {
  return (
    <nav aria-label="Concursuri pe stări" className={cn(SHELL_GUTTERS, '-mt-6 pb-10 xl:-mt-10 xl:pb-16')}>
      <p className="flex flex-wrap items-center gap-x-1 t-caption text-muted">
        Toate concursurile:
        {STATUS_LINKS.map((l, i) => (
          <span key={l.status} className="inline-flex items-center gap-x-1">
            {i > 0 ? <span aria-hidden className="text-faint">·</span> : null}
            <Link
              href={routes.competitions(l.status)}
              className="-mx-1 inline-flex min-h-6 items-center rounded-control px-1 text-accent-ink transition-colors duration-(--duration-fast) hover:underline"
            >
              {l.label}
            </Link>
          </span>
        ))}
      </p>
    </nav>
  );
}

async function Routed({ searchParams }: Props) {
  const place = placeFromUrl(await searchParams);
  const density = parseDensity((await cookies()).get(DENSITY_COOKIE)?.value) ?? 'compact';
  return (
    <Suspense fallback={<Fallback place={place} density={density} />}>
      <Data place={place} density={density} />
    </Suspense>
  );
}

type Prefetchable = Parameters<typeof prefetchState>[0][number];
const keyOf = (q: { queryKey: readonly unknown[] }) => JSON.stringify(q.queryKey);

async function Data({ place, density }: { place: ListPlace; density: Density }) {
  await connection();
  const t = bounded(createServerTransport());
  const token = await getSessionToken();

  const shared = [
    competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.upcoming, { isAuthenticated: false }),
    competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.live, { isAuthenticated: false }),
    competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.completed, { isAuthenticated: false }),
  ];
  const perUser = token
    ? [
        competitionCardsInfiniteQuery(t, REGISTERED_PARAMS, { isAuthenticated: true }),
        competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.followedLive, { isAuthenticated: true }),
      ]
    : [];
  // The list the URL asks for (a search, filters, «Urmărite»), when it is not one already read.
  const urlList = competitionCardsInfiniteQuery(t, listParamsFor(place), { isAuthenticated: place.scope !== 'all' });
  if (![...shared, ...perUser].some((q) => keyOf(q) === keyOf(urlList))) {
    if (place.scope === 'all') shared.push(urlList);
    else if (token) perUser.push(urlList);
  }

  // The bento's own reads. Featured is only shown when nothing is live (the client decides), but it
  // is read alongside rather than after the live page: a cached public read, never a second wait.
  const pulseExtras = showsPulse(place) ? [pulsePersonQuery(t, true), featuredCompetitionQuery(t, true)] : [];

  const [viewer, sharedState, mineState, pulseState] = await Promise.all([
    // The top bar's session read (shared per request, 4s): over it, «unknown» — never a 10s wait.
    getShellSession(),
    prefetchState(shared as Prefetchable[], ['competitions-list']),
    perUser.length ? prefetchState(perUser as Prefetchable[], []) : Promise.resolve(null),
    pulseExtras.length ? prefetchState(pulseExtras as Prefetchable[], []) : Promise.resolve(null),
  ]);
  // Unknown (a session cookie, the read over its deadline) is still signed in: the per-user reads
  // run through /api/cms, which knows the cookie. Only a real «no session» is signed out.
  const isAuthenticated = viewer !== null;
  // The hero stack's shuffle: once per visit, the same on the server render and in the browser.
  const seed = drawSeed();

  const user = userOf(viewer);
  const desktopViewer = user ? { id: user.id, documentId: user.documentId, username: user.username } : null;
  let screen: ReactNode = (
    <CompetitionsScreen initial={place} initialDensity={density} isAuthenticated={isAuthenticated} viewer={desktopViewer} seed={seed} />
  );
  if (mineState && isAuthenticated) screen = <HydrationBoundary state={mineState}>{screen}</HydrationBoundary>;
  if (pulseState) screen = <HydrationBoundary state={pulseState}>{screen}</HydrationBoundary>;
  screen = <HydrationBoundary state={sharedState}>{screen}</HydrationBoundary>;

  const listed = [...cardsOf(sharedState, shared[1]), ...cardsOf(sharedState, shared[0])];
  return (
    <>
      {listed.length ? (
        <script
          type="application/ld+json"
          // `<` escaped so no string can close the script tag.
          dangerouslySetInnerHTML={jsonLdHtml(itemListJsonLd(listed))}
        />
      ) : null}
      {screen}
    </>
  );
}

/** A per-request draw (after connection(): request time, never prerendered). */
function drawSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

/** The first page of a prefetched list, from the dehydrated state. */
function cardsOf(state: DehydratedState, q: { queryKey: readonly unknown[] }): CompetitionCard[] {
  const hit = state.queries.find((x) => JSON.stringify(x.queryKey) === keyOf(q));
  const data = hit?.state.data as { pages?: CompetitionCardsPage[] } | undefined;
  return data?.pages?.[0]?.data ?? [];
}

/** schema.org: the live and upcoming competitions on the page, as SportsEvents. */
function itemListJsonLd(cards: CompetitionCard[]) {
  const url = absoluteUrl(routes.competitions());
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url,
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: 'ro-RO',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: cards.slice(0, 30).map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'SportsEvent',
          name: c.name,
          url: absoluteUrl(routes.competition(c.documentId)),
          sport: 'Pescuit sportiv',
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          ...(c.startDate ? { startDate: c.startDate } : {}),
          ...(c.endDate ? { endDate: c.endDate } : {}),
          ...(c.lake ? { location: { '@type': 'Place', name: c.lake.name, url: absoluteUrl(routes.lake(c.lake.documentId)) } } : {}),
          ...(c.organizer ? { organizer: { '@type': 'Person', name: c.organizer.username } } : {}),
          ...((c.banner ?? c.lake?.image) ? { image: (c.banner ?? c.lake?.image)?.url } : {}),
        },
      })),
    },
  };
}

/**
 * The prerendered shell: what every /concursuri URL shares — the page's h1 (spoken) and plain card
 * bones. Nothing that names a mode (the filter bar is the browse mode's, or results' from 1280).
 */
function NeutralFallback() {
  return (
    <div aria-busy>
      <ListPageSkeleton
        title="Concursuri"
        header={<h1 className="sr-only">Concursuri</h1>}
        summaryTitle={null}
        summary={<span aria-hidden />}
        list={<CompetitionsFallbackBody withPulse={false} />}
      />
    </div>
  );
}

/** The filter bar's quick chips as the page draws them (Stare only in results mode, where the tabs are gone). */
function barChips(place: ListPlace, results: boolean): string[] {
  return [...(results ? ['Stare'] : []), 'Perioadă', 'Format', ...(place.status === 'notStarted' ? ['Locuri libere'] : []), 'Județ'];
}

/**
 * The page's frame while it reads, in the shape it will open in: the tabs (or the results chrome),
 * the search row and the filter bar, the bento where the list opens on it, the summary's
 * real title and compact card bones.
 */
function Fallback({ place, density = 'compact' }: { place: ListPlace; density?: Density }) {
  const results = isResultsMode(place);
  const heading = headingFor(place);
  // Only a results URL has chips; it is read after searchParams (request time), never prerendered.
  const chips = results ? chipLabels(place, new Date()) : [];
  const label = resultsLabelFor(place);
  // «Listă» from 1024: each tab's own rows (./_list/desktop), with no aside — the bones match them.
  const desktopRows = !results && density === 'compact' && place.status !== 'all';
  return (
    <div aria-busy>
      <ListPageSkeleton
        title="Concursuri"
        header={
          results ? (
            <ResultsChromeFrame label={label} chips={chips} filterCount={chips.length} band={heading} />
          ) : (
            <ListHeader title="Concursuri" below={<TabsSkeleton count={3} />} />
          )
        }
        // The filter bar under the search row (results mode: under the results row, from 1280 — the hero slot).
        filterBar={results ? undefined : <FilterBarSkeleton chips={barChips(place, false)} />}
        // Results mode has no aside (results.c14).
        aside={results || desktopRows ? 0 : 1}
        searchPlaceholder={results ? undefined : 'Concurs, baltă sau organizator'}
        summaryTitle={heading}
        // Results from 1280: the header's band carries the answer and the summary row takes no space.
        summary={results ? <ListSummary title={heading} loading titleHiddenFrom="xl" /> : undefined}
        list={<CompetitionsFallbackBody withPulse={false} density={density} desktopRows={desktopRows} />}
        // ≥1280 the results chrome sits in the centre column, in the search row's slot.
        hero={
          showsPulse(place) ? (
            <PulseSkeleton />
          ) : results ? (
            <div className="hidden flex-col gap-4 xl:flex">
              <ResultsRowFrame label={label} />
              <FilterBarSkeleton chips={barChips(place, true)} />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

/**
 * The results chrome while the list reads (results.c3, c7): the back square, the pill with what was
 * asked and its filters circle, the refresh, and the chip rail as still pills — the live chrome's
 * own classes (./_list/resultsChromeStyles), so nothing moves when the list lands. The back is a
 * real link, usable before hydration.
 */
function ResultsChromeFrame({ label, chips, filterCount, band }: { label: string; chips: string[]; filterCount: number; band: string }) {
  return (
    <div className={cn(RESULTS_STACK, 'pt-2 xl:p-0')}>
      {/* As the live screen: spoken below 1280; from 1280 the T1 header with its reserved band. */}
      <ListHeader title="Concursuri" reserveBelow={band} className="max-xl:sr-only" />
      <div className="contents xl:hidden">
        <ResultsRowFrame label={label} circle filterCount={filterCount} />
        {chips.length ? (
          <div aria-hidden className="-mx-4 flex items-center gap-2 overflow-hidden md:mx-0 md:flex-wrap">
            <div className="flex min-w-0 flex-1 gap-2 overflow-hidden px-4 md:contents">
              {chips.map((c) => (
                <span key={c} className={cn(PILL_H, 'flex shrink-0 items-center gap-1.5 rounded-full bg-accent-tint pr-2.5 pl-3 t-label whitespace-nowrap text-accent-ink')}>
                  {c}
                  <XMarkIcon className="size-4" />
                </span>
              ))}
            </div>
            {chips.length > 2 ? (
              <span className={cn(PILL_H, 'mr-4 flex shrink-0 items-center rounded-full bg-surface px-3 t-label whitespace-nowrap text-ink-2 shadow-e0 md:mr-0')}>
                Șterge tot
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** One results row (back, pill, refresh); `circle` below 1280, where the filter bar is not on screen. */
function ResultsRowFrame({
  label,
  circle = false,
  filterCount = 0,
  className,
}: {
  label: string;
  circle?: boolean;
  filterCount?: number;
  className?: string;
}) {
  return (
    <div className={cn(RESULTS_ROW, className)}>
      <Link href={routes.competitions()} aria-label="Înapoi la concursuri" className={RESULTS_BACK}>
        <ArrowLeftIcon aria-hidden />
      </Link>
      <div aria-hidden className={resultsPillClass(circle)}>
        <span className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-3.5">
          <MagnifyingGlassIcon className="size-5 shrink-0 text-muted" />
          <span className="truncate t-body text-ink">{label}</span>
        </span>
        {circle ? (
          <span className={cn(resultsCircleClass(filterCount > 0), 'pointer-events-none')}>
            <AdjustmentsHorizontalIcon />
          </span>
        ) : null}
      </div>
      <span className={RESULTS_REFRESH}>
        <DashboardRefresh />
      </span>
    </div>
  );
}
