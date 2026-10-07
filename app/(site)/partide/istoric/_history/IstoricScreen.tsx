'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import { ICON_BUTTON_SIZE } from '@/components/nav/IconButton';
import { useBack } from '@/components/nav/useBack';
import { JournalKpiGrid } from '@/components/partide/own/JournalStatCard';
import { AsideSection, AsideSkeleton, filterChipClass, ListEmpty, ListError, ListHeader, ListPage } from '@/components/templates/T1';
import { DashboardRefresh } from '@/components/templates/T5';
import { cn } from '@/components/ui/cn';
import { computeHistoryStats, partideHistoryQuery } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { HistoryFilterBar } from './FilterBar';
import { IstoricSkeleton } from './IstoricSkeleton';
import { MonthGroups } from './MonthGroups';
import { VenueMultiFilterDialog } from './VenueMultiFilterDialog';
import { entryCount, filtersKey, hasFilters, historySections, PAGE_SIZE, toSessions, venueOptions, windowSections, type HistoryFilters } from './view';
import { WeightList } from './WeightList';

/*
 * /partide/istoric — «Istoric partide»: fish app/(app)/partide/istoric.tsx (parity partide.istoric
 * c1–c8), template T1, behind the page's requireViewer gate.
 *
 * Per user and client-side only: the own-sessions list (core partideHistoryQuery — every page of
 * /feed/sessions/mine, the cache Ale mele shares), summary-only as fish ships it. Only finished
 * partide are listed (the live one never is: it has no end).
 *
 *  - Filters (c1, c3–c5): the T1 horizontal bar — «Greutate», the venue chip, «Cu capturi». They
 *    live in the URL (c8: fish's in-memory atoms; replaceState, no history entry per tap), so a
 *    reload, the back button from a partidă and a shared link keep them. Nothing else persists them.
 *  - Body: months (sticky labels, card grids) or, with «Greutate», one flat grid by record kg.
 *  - Window (c6): 10 partide, 10 more each time the end nears (IntersectionObserver); any filter
 *    change starts again at 10.
 *  - States (c7): the first read → skeleton; nothing after filtering → «Nicio partidă pentru
 *    filtrele selectate.»; a failed first read → an error card with a retry (owner rule 4: never an
 *    empty history we are not sure of). The header's refresh refetches the list (c8, fish pull-to-
 *    refresh).
 */

export const TITLE = 'Istoric partide';

/** «Partide › Ale mele › Istoric partide» on the ≥768 band. */
export const TRAIL: Crumb[] = [
  { label: 'Partide', href: routes.partide() },
  { label: 'Ale mele', href: routes.partideMine() },
  { label: TITLE },
];

const NO_ROWS: never[] = [];

export function IstoricScreen({ initial }: { initial: HistoryFilters }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const back = useBack(routes.partideMine());
  const history = useQuery(partideHistoryQuery(t));
  const [filters, setFilters] = useState<HistoryFilters>(initial);
  const [venuesOpen, setVenuesOpen] = useState(false);
  useHistoryUrl(filters);

  const rows = history.data?.data ?? NO_ROWS;
  const sessions = useMemo(() => toSessions(rows), [rows]);
  const options = useMemo(() => venueOptions(sessions), [sessions]);
  const sections = useMemo(() => historySections(sessions, filters), [sessions, filters]);
  const total = useMemo(() => entryCount(sections), [sections]);
  const stats = useMemo(() => computeHistoryStats(sections.flatMap(s => s.entries.map(e => e.session)), {}), [sections]);
  const anyFinished = options.length > 0;

  // c4/c8 — a `balti` from the URL (an old or shared link, a renamed lake, the last partidă there
  // deleted) that none of the finished partide carries would stick: the picker has no row to
  // uncheck. Once the list has answered, such venues are dropped (and the URL follows).
  if (history.isSuccess && filters.venues.length > 0) {
    const known = new Set(options.map(o => o.value));
    if (filters.venues.some(v => !known.has(v))) setFilters(f => ({ ...f, venues: f.venues.filter(v => known.has(v)) }));
  }

  // c6 — the window, keyed by the filters: ANY change (going back to an earlier combination too)
  // starts again at PAGE_SIZE (fish's reset effect on every filter change).
  const key = filtersKey(filters);
  const [win, setWin] = useState({ key, count: PAGE_SIZE });
  if (win.key !== key) setWin({ key, count: PAGE_SIZE });
  const count = win.key === key ? win.count : PAGE_SIZE;
  const shown = useMemo(() => windowSections(sections, count), [sections, count]);
  const more = count < total;

  const refresh = async () => {
    const r = await history.refetch();
    return !r.isError;
  };

  let body;
  if (history.isPending) body = <IstoricSkeleton />;
  else if (history.isError && !history.data)
    body = (
      <ListError
        title="Istoricul nu s-a putut încărca."
        onRetry={() => void history.refetch()}
        retrying={history.isFetching}
      />
    );
  else if (shown.length === 0)
    body = (
      <div data-testid="history-empty">
        {hasFilters(filters) || sessions.some(s => s.endedAt != null) ? (
          <ListEmpty title="Nicio partidă pentru filtrele selectate." />
        ) : (
          // No finished partidă at all (and no filter): Ale mele's own words (partide.ale-mele.c15).
          <ListEmpty title="Nicio partidă încheiată încă." />
        )}
      </div>
    );
  else
    body = (
      <>
        {filters.byWeight ? <WeightList section={shown[0]} now={null} /> : <MonthGroups sections={shown} now={null} />}
        {more ? <WindowSentinel onNear={() => setWin({ key, count: count + PAGE_SIZE })} count={count} /> : null}
      </>
    );

  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <ListPage
        header={
          <ListHeader
            title={TITLE}
            back={{ label: 'Înapoi', onClick: back }}
            actions={<DashboardRefresh onRefresh={refresh} />}
          />
        }
        // From 1440 the history's figures beside the cards (owner rule 1: the width is used; Ale
        // mele's stat language), on the late 320 track: at 1280 a docked column would squeeze the
        // cards under their 292 (the duration truncates), so 1280 keeps four columns of cards.
        // Below that nothing: Ale mele already leads with the figures.
        aside={
          history.isPending ? (
            <AsideSkeleton rows={2} />
          ) : history.data && anyFinished ? (
            <HistorySummary stats={stats} filtered={hasFilters(filters)} />
          ) : null
        }
        asideLabel="Istoricul în cifre"
        asideFrom="2xl"
        asideInline={false}
        asideBusy={history.isPending}
      >
        <HistoryFilterBar
          filters={filters}
          onChange={setFilters}
          onOpenVenues={() => setVenuesOpen(true)}
          venuesOpen={venuesOpen}
          disabled={history.isPending}
        />
        <div aria-busy={history.isFetching || undefined} data-testid="history-body">
          {body}
        </div>
      </ListPage>
      <VenueMultiFilterDialog
        open={venuesOpen}
        onClose={() => setVenuesOpen(false)}
        options={options}
        selected={filters.venues}
        onApply={venues => {
          setFilters(f => ({ ...f, venues }));
          setVenuesOpen(false);
        }}
      />
    </>
  );
}

/**
 * The summary column (≥1440): partide, capturi, kg in total and the record over the partide the
 * list shows (every finished one, or those the filters keep), as Ale mele's bento tiles.
 */
function HistorySummary({ stats, filtered }: { stats: ReturnType<typeof computeHistoryStats>; filtered: boolean }) {
  return (
    <AsideSection bare title="În cifre">
      <p className="-mt-2 t-caption text-muted" data-testid="history-summary-scope">
        {filtered ? 'Pentru filtrele selectate' : 'Toate partidele încheiate'}
      </p>
      <JournalKpiGrid stats={stats} label="Istoricul în cifre" className="gap-3" />
    </AsideSection>
  );
}

/**
 * The end of the window: once it comes within ~1.5 screens of the viewport, 10 more partide render
 * (fish onEndReached, threshold 0.4 + drawDistance 1200). A new observer per window size, so a
 * sentinel still in range after the cards land asks again.
 */
function WindowSentinel({ onNear, count }: { onNear: () => void; count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onNear);
  useEffect(() => {
    cb.current = onNear;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) cb.current();
      },
      { rootMargin: '0px 0px 600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [count]);
  return <div ref={ref} aria-hidden className="h-px" data-testid="history-sentinel" />;
}

/** c8 — the filters mirrored into the URL (replaceState; other params kept), one `balti` per venue. */
function useHistoryUrl(f: HistoryFilters) {
  const target = routes.partideHistory(f);
  useEffect(() => {
    const url = new URL(window.location.href);
    for (const k of ['sortare', 'balti', 'cu-capturi']) url.searchParams.delete(k);
    for (const [k, v] of new URL(target, url.origin).searchParams) url.searchParams.append(k, v);
    if (url.href !== window.location.href) window.history.replaceState(null, '', url);
  }, [target]);
}

/**
 * The whole page while the gate reads the session (loading.tsx and the page's Suspense fallback):
 * the real title, the back control's and the refresh's places, the chips (inert) and the skeleton.
 */
export function IstoricPageLoading() {
  return (
    <>
      <SetBreadcrumb trail={TRAIL} />
      <ListPage
        header={
          <div className="flex min-h-12 items-center gap-3 xl:min-h-10">
            <span aria-hidden className={cn(ICON_BUTTON_SIZE, 'shrink-0 rounded-control bg-surface shadow-e0')} />
            <h1 className="min-w-0 flex-1 t-title1 text-ink">{TITLE}</h1>
          </div>
        }
        aside={<AsideSkeleton rows={2} />}
        asideFrom="2xl"
        asideInline={false}
        asideBusy
      >
        <FilterChipsSkeleton />
        <IstoricSkeleton />
      </ListPage>
    </>
  );
}

/** The three chips, inert, in their places (no «Filtre»: the history has nothing beyond them). */
function FilterChipsSkeleton() {
  return (
    <div aria-hidden className="flex min-w-0 items-center gap-2 overflow-hidden opacity-60">
      {['Greutate', 'Baltă', 'Cu capturi'].map(c => (
        <span key={c} className={cn(filterChipClass(), 'pointer-events-none')}>
          {c}
        </span>
      ))}
    </div>
  );
}
