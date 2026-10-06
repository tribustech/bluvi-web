import 'server-only';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cacheLife, cacheTag } from 'next/cache';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { FilterBarSkeleton, ListHeader, ListPageSkeleton, ListSummary, PILL_H } from '@/components/templates/T1';
import { DashboardRefresh } from '@/components/templates/T5';
import { AdjustmentsHorizontalIcon, ArrowLeftIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import {
  COMPETITION_CARDS_PAGE_SIZE,
  competitionCardsInfiniteQuery,
  getCompetitionCards,
  getPulsePeople,
  PULSE_CARD_PARAMS,
  pulsePeopleQuery,
  type CompetitionCard,
  type PulsePerson,
  type CompetitionCardStatus,
} from '@/core/competitions';
import { prefetchState } from '@/lib/client/hydration';
import { absoluteUrl, routes } from '@/lib/routes';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import { getShellSession } from '../../_shell/session';
import { userOf } from '../../_shell/viewer-state';
import { CompetitionsFallbackBody, CompetitionsScreen } from './CompetitionsScreen';
import { LiveBand } from './upcoming/LiveBand';
import { SpotlightView } from './upcoming/Spotlight';
import { SPOTLIGHT_LIMIT, SpotlightSkeleton, UPCOMING_TOP } from './upcoming/SpotlightSkeleton';
import { UpcomingGroupsShell } from './upcoming/UpcomingGroups';
import {
  chipLabels,
  DEFAULT_PLACE,
  headingFor,
  isResultsMode,
  listParamsFor,
  placeFromUrl,
  REGISTERED_PARAMS,
  resultsLabelFor,
  TAB_LABEL,
  type ListPlace,
  type ListRoute,
  type UrlParams,
} from './place';
import { RESULTS_BACK, RESULTS_REFRESH, RESULTS_ROW, RESULTS_STACK, resultsCircleClass, resultsPillClass } from './resultsChromeStyles';
import { ScreenBoundary } from './ScreenBoundary';
import { bounded } from './server';
import { StatusTabs } from './StatusTabs';
import { jsonLdHtml } from '@/lib/json-ld';

/*
 * Concursuri — fish app/(app)/(tabs)/competitions/index.tsx on template T1 (parity
 * docs/parity/areas/competitions-list.yml: index, pulse, cards), shared by its four pages:
 *   /concursuri            Live when at least one competition is live, else Viitoare
 *   /concursuri/viitoare   /concursuri/live   /concursuri/rezultate   — each tab's own page
 * Each has its own title, description and canonical; search, filters and scope ride in the query
 * (a filtered or searched view canonicalises to its page). Static segments win over /concursuri/[id]
 * (competition ids are cuids, never «live»).
 *
 * Rendering (cacheComponents): the static shell is the page's frame — a tab page's own tabs (real
 * links), search row and filter bar; /concursuri's mode-neutral bones (a search URL lands there, so
 * nothing that results mode would swap out) — plus the JSON-LD of the tab's first page and, for
 * /concursuri, which tab it opens on: both from ONE cached read per status (listHead: 'use cache',
 * tag `competitions-list` — the CMS's Cache-Tag for /feed/competition-cards, purged on every write
 * through /api/revalidate). Behind <Suspense> the request-time part reads the query and the session,
 * prefetches, bounded (./server.ts), every list the first paint shows — the bento's Live / Viitoare
 * / Rezultate pages (the same cached public reads) and, with a session, «Ale mele» and the
 * followed-live count — and hands them to the client list, which takes over the same core/ queries
 * (HydrationBoundary). Where the bento shows, its person (/feed/pulse-person) and featured
 * competition are read too: the first paint has the whole bento, not skeletons.
 */

const META: Record<'index' | CompetitionCardStatus, { title: string; description: string }> = {
  index: {
    title: 'Concursuri de pescuit',
    description:
      'Concursurile de pescuit sportiv din România: cele care încep curând, cele live cu clasament în timp real și rezultatele celor încheiate. Înscrie-te și urmărește-le pe Bluvi.',
  },
  notStarted: {
    title: 'Concursuri de pescuit viitoare',
    description:
      'Concursurile de pescuit sportiv care urmează în România: date, bălți, organizatori și locuri libere. Alege următorul start și înscrie-te online pe Bluvi.',
  },
  started: {
    title: 'Concursuri de pescuit live',
    description:
      'Concursurile de pescuit sportiv în desfășurare acum: clasament live, cântăriri și cele mai mari capturi, actualizate în timp real pe Bluvi.',
  },
  completed: {
    title: 'Rezultate concursuri de pescuit',
    description:
      'Rezultatele concursurilor de pescuit sportiv încheiate: câștigători, podium, clasamente complete și statistici pentru fiecare concurs, pe Bluvi.',
  },
};

/** One page's <title>, description, canonical and social cards. */
export function competitionsMetadata(tab?: CompetitionCardStatus): Metadata {
  const { title, description } = META[tab ?? 'index'];
  const url = routes.competitions(tab);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, siteName: 'Bluvi', locale: 'ro_RO', title: `${title} · Bluvi`, description },
    twitter: { card: 'summary', title: `${title} · Bluvi`, description },
  };
}

type Props = { searchParams: Promise<UrlParams>; tab?: CompetitionCardStatus };

/** What the static shell needs of a status's first page: its cards (JSON-LD) and the per-status counts. */
type ListHead = { cards: CompetitionCard[]; counts: Record<CompetitionCardStatus, number> | null };

/**
 * A status's first page (the same public read the list makes), cached until the CMS purges
 * `competitions-list`, else re-read every minute — so a failed read (an empty head) never outlives
 * a CMS hiccup by more than that.
 */
async function listHead(status: CompetitionCardStatus): Promise<ListHead> {
  'use cache';
  cacheTag('competitions-list');
  // 'minutes' either way (revalidate 1 min): a shorter life would make it a dynamic hole, and this
  // read is part of the static shell. A good read is purged by its tag long before that.
  cacheLife('minutes');
  try {
    const page = await getCompetitionCards(createServerTransport(), {
      ...PULSE_CARD_PARAMS[STATUS_LIST[status]],
      page: 1,
      pageSize: COMPETITION_CARDS_PAGE_SIZE,
    });
    return { cards: page.data, counts: page.meta.counts };
  } catch (e) {
    console.error('[concursuri] list head failed', e);
    return { cards: [], counts: null };
  }
}

const STATUS_LIST = { notStarted: 'upcoming', started: 'live', completed: 'completed' } as const;

/**
 * «În lumina reflectoarelor»'s people (/feed/pulse-person?limit=6: public, 30 min at the edge, no
 * Cache-Tag), cached for the static shell and the request-time hydration alike — one answer, so the
 * shell's people are the ones the page then hydrates. Tag `pulse-person` (purgeable through
 * /api/revalidate); a failed read is null, re-read within minutes (as listHead).
 */
async function spotlightPeople(): Promise<PulsePerson[] | null> {
  'use cache';
  cacheTag('pulse-person');
  try {
    const people = await getPulsePeople(createServerTransport(), SPOTLIGHT_LIMIT);
    cacheLife({ stale: 300, revalidate: 1800, expire: 86_400 });
    return people;
  } catch (e) {
    console.error('[concursuri] spotlight people failed', e);
    cacheLife('minutes');
    return null;
  }
}

/** The shell's clock (Viitoare's time groups): one per cached shell, never a request-time read. */
async function shellClock(): Promise<number> {
  'use cache';
  cacheLife('minutes');
  return Date.now();
}

/**
 * Viitoare's public part, for the static shell: the live band (the Live list's count and first
 * posters), the spotlight's people and the tab's first page of cards — all cached reads.
 */
type UpcomingShell = { live: ListHead; upcoming: ListHead; people: PulsePerson[] | null; at: number };

async function upcomingShell(): Promise<UpcomingShell> {
  const [live, upcoming, people, at] = await Promise.all([listHead('started'), listHead('notStarted'), spotlightPeople(), shellClock()]);
  return { live, upcoming, people, at };
}

/**
 * Viitoare's Top (the live band, the spotlight) — on «Toate» and on «Urmărite» alike (the client
 * tab draws it on both: neither is about what the viewer follows).
 */
function showsUpcomingTop(place: ListPlace): boolean {
  return !isResultsMode(place) && place.status === 'notStarted' && (place.scope === 'all' || place.scope === 'followed');
}

/** /concursuri opens on Live when at least one competition is live, else on Viitoare. */
async function indexTab(): Promise<CompetitionCardStatus> {
  const live = await listHead('started');
  return (live.counts?.started ?? live.cards.length) > 0 ? 'started' : 'notStarted';
}

export async function CompetitionsRoute({ searchParams, tab }: Props) {
  const route: ListRoute = tab ? { tab } : { index: await indexTab() };
  const status = tab ?? ('index' in route ? route.index : 'notStarted');
  const [head, shell] = await Promise.all([listHead(status), status === 'notStarted' ? upcomingShell() : null]);
  return (
    <ScreenBoundary>
      {head.cards.length ? (
        <script
          type="application/ld+json"
          // `<` escaped so no string can close the script tag.
          dangerouslySetInnerHTML={jsonLdHtml(itemListJsonLd(head.cards, tab))}
        />
      ) : null}
      {/* A tab page's shell is that tab's frame; /concursuri's is mode-neutral (a search URL lands
          there): only the inner fallback, which knows the place, commits to index or results. */}
      <Suspense fallback={tab ? <Fallback place={{ ...DEFAULT_PLACE, status: tab }} shell={shell} /> : <NeutralFallback />}>
        <Routed searchParams={searchParams} route={route} shell={shell} />
      </Suspense>
    </ScreenBoundary>
  );
}

async function Routed({ searchParams, route, shell }: { searchParams: Promise<UrlParams>; route: ListRoute; shell: UpcomingShell | null }) {
  const place = placeFromUrl(await searchParams, route);
  return (
    <Suspense fallback={<Fallback place={place} shell={shell} />}>
      <Data place={place} indexTab={'index' in route ? route.index : null} />
    </Suspense>
  );
}

type Prefetchable = Parameters<typeof prefetchState>[0][number];
const keyOf = (q: { queryKey: readonly unknown[] }) => JSON.stringify(q.queryKey);

async function Data({ place, indexTab }: { place: ListPlace; indexTab: CompetitionCardStatus | null }) {
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

  // Viitoare draws «În lumina reflectoarelor» (./tabs/UpcomingTab): its people, from the same
  // cached read as the static shell (spotlightPeople) — the shell's people are the hydrated ones.
  const pulseExtras = showsUpcomingTop(place)
    ? [
        {
          ...pulsePeopleQuery(t, SPOTLIGHT_LIMIT, true),
          queryFn: async () => {
            const people = await spotlightPeople();
            if (!people) throw new Error('spotlight people unavailable');
            return people;
          },
        },
      ]
    : [];

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

  const user = userOf(viewer);
  const desktopViewer = user ? { id: user.id, documentId: user.documentId, username: user.username } : null;
  let screen: ReactNode = (
    <CompetitionsScreen initial={place} indexTab={indexTab} isAuthenticated={isAuthenticated} viewer={desktopViewer} />
  );
  if (mineState && isAuthenticated) screen = <HydrationBoundary state={mineState}>{screen}</HydrationBoundary>;
  if (pulseState) screen = <HydrationBoundary state={pulseState}>{screen}</HydrationBoundary>;
  screen = <HydrationBoundary state={sharedState}>{screen}</HydrationBoundary>;

  return screen;
}

/** schema.org: the page's competitions (its tab's first page), as SportsEvents. */
function itemListJsonLd(cards: CompetitionCard[], tab?: CompetitionCardStatus) {
  const url = absoluteUrl(routes.competitions(tab));
  const { title, description } = META[tab ?? 'index'];
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url,
    name: title,
    description,
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
        list={<CompetitionsFallbackBody />}
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
function Fallback({ place, shell }: { place: ListPlace; shell: UpcomingShell | null }) {
  const results = isResultsMode(place);
  if (showsUpcomingTop(place)) return <UpcomingFallback place={place} shell={shell} />;
  const heading = headingFor(place);
  // Only a results URL has chips; it is read after searchParams (request time), never prerendered.
  const chips = results ? chipLabels(place, new Date()) : [];
  const label = resultsLabelFor(place);
  // A status tab (or «Ale mele») takes the whole width, with no aside; its list's bones are the
  // tab module's own (./tabs).
  const desktopRows = !results && place.status !== 'all';
  const tab = desktopRows && place.scope !== 'registered' && place.status !== 'all' ? place.status : undefined;
  return (
    <div aria-busy>
      <ListPageSkeleton
        title="Concursuri"
        header={
          results ? (
            <ResultsChromeFrame label={label} chips={chips} filterCount={chips.length} band={heading} />
          ) : (
            <ListHeader title="Concursuri" below={<FallbackTabs active={place.scope === 'registered' || place.status === 'all' ? undefined : place.status} />} />
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
        list={<CompetitionsFallbackBody tab={tab} />}
        // ≥1280 the results chrome sits in the centre column, in the search row's slot.
        hero={
          results ? (
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
 * Viitoare's frame, in the tab's own order (./tabs/UpcomingTab under CompetitionsScreen): from 768
 * the live band and the spotlight, THEN the search row and the filter bar, then the list (the phone
 * keeps the search row first). With the cached shell (`shell`) it is the tab's public content
 * itself — the real band, people and first page of cards (start order: who reads is not known
 * here; a signed-in viewer's registrations take the lead of their group when the page lands) — so
 * it is prerendered, and only per-user parts arrive with the request. Without it (another tab's
 * route), bones in the same places. «Urmărite» lists per-user cards: bones under the public Top.
 */
function UpcomingFallback({ place, shell }: { place: ListPlace; shell: UpcomingShell | null }) {
  const liveCount = shell ? (shell.live.counts?.started ?? shell.live.cards.length) : 0;
  const cards = place.scope === 'all' ? (shell?.upcoming.cards ?? []) : [];
  const top = (
    <div className={UPCOMING_TOP}>
      {liveCount > 0 && shell ? <LiveBand count={liveCount} cards={shell.live.cards} /> : null}
      {shell?.people ? <SpotlightView people={shell.people} isAuthenticated={false} /> : shell ? null : <SpotlightSkeleton />}
    </div>
  );
  return (
    <div aria-busy>
      <ListPageSkeleton
        title="Concursuri"
        header={<ListHeader title="Concursuri" below={<FallbackTabs active="notStarted" />} />}
        filterBar={<FilterBarSkeleton chips={barChips(place, false)} />}
        searchPlaceholder="Concurs, baltă sau organizator"
        summaryTitle={headingFor(place)}
        hero={top}
        heroFirst
        list={cards.length && shell ? <UpcomingGroupsShell cards={cards} at={shell.at} /> : <CompetitionsFallbackBody tab="notStarted" />}
      />
    </div>
  );
}

/** The frame's tabs: already the real links (no counts yet — unknown is not shown, §4b.4). */
function FallbackTabs({ active }: { active?: CompetitionCardStatus }) {
  const keys: CompetitionCardStatus[] = ['notStarted', 'started', 'completed'];
  return <StatusTabs label="Stare concursuri" tabs={keys.map((key) => ({ key, label: TAB_LABEL[key], href: routes.competitions(key) }))} active={active} />;
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
