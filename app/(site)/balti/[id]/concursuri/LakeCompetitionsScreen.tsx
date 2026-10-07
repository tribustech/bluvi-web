'use client';

import { useRouter } from 'next/navigation';
import { useInfiniteQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeError, ListEmpty, ListFooter, ListGrid, ListHeader, ListPage, ListRegion, ListTabs, LiveDot, TextAction, useListUrlState } from '@/components/templates/T1';
import { DashboardRefresh, type RefreshResult } from '@/components/templates/T5';
import { Button } from '@/components/ui/Button';
import type { CompetitionCardsPage } from '@/core/competitions';
import { formatCount } from '@/core/realtime/chat/format';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { logEvent } from '../../../concursuri/_list/analytics';
import { CardSkeleton, cardItemClass, CompetitionCardItem, type PhotoRequest } from '../../../concursuri/_list/CompetitionCardItem';
import { PhotoViewer } from '../../../concursuri/_list/PhotoViewer';
import { RESULTS_REFRESH } from '../../../concursuri/_list/resultsChromeStyles';
import { firstReadFailed, SUB_TITLE_ID, SubListError, SubRetryFocus } from '../_sub/states';
import { useBack } from '../_sub/useBack';
import { lakeCompetitionCardsQuery, withoutLake } from './query';
import { LAKE_COMPETITION_TABS, LAKE_COMPETITIONS_CAPTION, NO_COMPETITIONS, tabOf, type LakeCompetitionTab } from './tabs';

/*
 * Concursuri la baltă — fish app/(app)/lakes/[lakeId]/concursuri.tsx (CompetitionTabs +
 * CompetitionsFullList per tab; parity lakes.competitions, T1). Also the target of the lake page's
 * «Vezi tot» rails (fish /competitions/{started|notStarted|completed}/{lakeId}, the per-lake lists of
 * competitions-list merged here):
 *  - c1 back control beside the lake's name, no promotional subtitle — the caption «Concursuri» under
 *    it says what the page is (at 375 the breadcrumb is hidden; the name over the tabs read as the
 *    lake page);
 *  - c2 Live · Viitoare · Trecute, Live first (the LIVE dot only while something IS live), each with
 *    its count pill (meta.counts, zero hidden); c6 `?tab=` picks the tab, a switch replaces the URL
 *    and logs fish's competition_list_tab_pressed; the bare URL opens `bareTab` (Live while
 *    something is live, else the first tab that has competitions — page.tsx) and stays bare;
 *  - c3 each tab 10 a page, more as the end comes into view; a card opens /concursuri/[id];
 *  - c4 the tab's own empty title («Niciun concurs live acum.» / «… programat.» / «… încheiat
 *    încă.»; fish's «Momentan nu este disponibil niciun concurs.» only when every count is 0) with
 *    the way to the next tab that has some (a tab switch like any other: logged, and focus lands on
 *    the newly active tab);
 *    c5 a failed tab: its error card, title / message / «Încearcă din nou» per describeError (fish
 *    ErrorScreen describeErrorWithQuality); no «Deconectează-te» — the read is public, and a dead
 *    session's cookie is already dropped by the proxy, so the retry reads anonymously;
 *  - fish pull-to-refresh (CompetitionsFullList onRefresh → the tab's refetch) is the /concursuri
 *    stand-in, DashboardRefresh «Reîmprospătează» in the header's action slot: it re-reads the open
 *    tab only, the cards stay on screen (spinning glyph, the region busy); a failed re-read keeps
 *    them under «Nu am putut actualiza lista.» with its own retry.
 * The cards are the /concursuri list's (CompetitionCardItem, compact «Listă», aligned footers):
 * the same competition looks the same on both pages — the unit («20/20 echipe»), the pending
 * registrations, the faces, the followers pill (its list), the poster opening whole — minus the
 * lake line, which would repeat this page's lake on every card.
 */

const PANEL_ID = 'concursuri-balta';
/** The first row's thumbnails carry the page's LCP (eager, high priority). */
const PRIORITY_CARDS = 4;

/** fish CompetitionTabs ids (GA merges web and app on them). */
const TAB_EVENT_ID: Record<LakeCompetitionTab, 'live' | 'upcoming' | 'past'> = { live: 'live', viitoare: 'upcoming', trecute: 'past' };
const COUNT_KEY = { live: 'started', viitoare: 'notStarted', trecute: 'completed' } as const;
const NEXT_LABEL: Record<LakeCompetitionTab, string> = {
  live: 'Vezi concursurile live',
  viitoare: 'Vezi concursurile viitoare',
  trecute: 'Vezi concursurile trecute',
};

type Counts = CompetitionCardsPage['meta']['counts'];

export function LakeCompetitionsScreen({
  lakeId,
  lakeName,
  initialTab,
  bareTab = 'live',
}: {
  lakeId: string;
  lakeName: string;
  initialTab: LakeCompetitionTab;
  /** The tab the bare URL opens (page.tsx): that tab keeps the URL bare. */
  bareTab?: LakeCompetitionTab;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const router = useRouter();
  const [tab, setTab] = useState<LakeCompetitionTab>(initialTab);
  useListUrlState({ tab: tab === bareTab ? null : tab });
  const back = useBack(routes.lake(lakeId));
  const [photo, setPhoto] = useState<PhotoRequest | null>(null);

  const q = useInfiniteQuery(lakeCompetitionCardsQuery(t, lakeId, tabOf(tab).status));
  // Every tab's size rides on each tab's read: kept across a switch so the LIVE dot never flickers.
  const [counts, setCounts] = useState<Counts | null>(null);
  const fresh = q.data?.pages[0]?.meta.counts ?? null;
  if (fresh && (!counts || fresh.started !== counts.started || fresh.notStarted !== counts.notStarted || fresh.completed !== counts.completed)) setCounts(fresh);

  // fish onRefresh: the active tab's refetch. A failed re-read over cards is said by the stale strip
  // (or the tab's error card) — 'reported', so DashboardRefresh does not announce it twice.
  const refresh = async (): Promise<RefreshResult> => {
    const r = await q.refetch();
    return r.isError ? 'reported' : true;
  };

  const select = (next: LakeCompetitionTab) => {
    if (next !== tab) logEvent('competition_list_tab_pressed', { tab_id: TAB_EVENT_ID[next], screen_name: 'Competitions List', screen_class: 'Competitions List' });
    setTab(next);
  };

  // The empty card's «Vezi concursurile …» unmounts with its tab (TabList is keyed by it): focus goes
  // to the newly active tab, never to <body> (WCAG 2.4.3).
  const focusTab = useRef(false);
  useEffect(() => {
    if (!focusTab.current) return;
    focusTab.current = false;
    document.getElementById(`${PANEL_ID}-tab-${tab}`)?.focus();
  }, [tab]);
  const selectFromEmpty = (next: LakeCompetitionTab) => {
    focusTab.current = true;
    select(next);
  };

  return (
    <ListPage
      header={
        <ListHeader
          title={lakeName || 'baltă'}
          titleId={SUB_TITLE_ID}
          description={LAKE_COMPETITIONS_CAPTION}
          back={{ label: 'Înapoi', onClick: back }}
          actions={
            // Below 768 the refresh takes the back square's framing (page ground); from 768 the labelled tool.
            <span className={RESULTS_REFRESH}>
              <DashboardRefresh onRefresh={refresh} />
            </span>
          }
          below={
            <ListTabs
              label="Concursuri la baltă"
              controls={PANEL_ID}
              active={tab}
              onSelect={select}
              tabs={LAKE_COMPETITION_TABS.map(x => {
                // Where the competitions are, before opening a tab (zero hidden by the kit).
                const count = counts?.[COUNT_KEY[x.key]];
                return {
                  key: x.key,
                  label: x.label,
                  leading: x.key === 'live' && counts && counts.started > 0 ? <LiveDot /> : undefined,
                  count,
                  accessibleLabel: count ? `${x.label}, ${count}` : undefined,
                };
              })}
            />
          }
        />
      }
    >
      <TabList key={tab} q={q} tab={tab} counts={counts} onTab={selectFromEmpty} onOpenPhoto={setPhoto} />
      <PhotoViewer
        photo={photo}
        onClose={() => setPhoto(null)}
        onOpenCompetition={id => {
          setPhoto(null);
          router.push(routes.competition(id));
        }}
      />
    </ListPage>
  );
}

type CardsQuery = UseInfiniteQueryResult<InfiniteData<CompetitionCardsPage>, Error>;

function TabList({
  q,
  tab,
  counts,
  onTab,
  onOpenPhoto,
}: {
  q: CardsQuery;
  tab: LakeCompetitionTab;
  counts: Counts | null;
  onTab: (tab: LakeCompetitionTab) => void;
  onOpenPhoto: (photo: PhotoRequest) => void;
}) {
  const meta = tabOf(tab);
  const items = useMemo(() => (q.data?.pages.flatMap(p => p.data) ?? []).map(withoutLake), [q.data]);
  const total = q.data?.pages[0]?.meta.pagination.total ?? items.length;
  const headingId = `${PANEL_ID}-titlu`;
  const failed = firstReadFailed(q);
  // Podium footers (Trecute) hug their rows; Live and Viitoare share one footer line per grid row.
  const aligned = tab !== 'trecute';
  // The empty tab points at the first other tab that has competitions (Viitoare, then Trecute, then Live).
  const next = counts ? (['viitoare', 'trecute', 'live'] as const).find(k => k !== tab && counts[COUNT_KEY[k]] > 0) : undefined;

  // A failed re-read (refresh, or a refetch on focus) over cards: the cards stay, marked.
  const stale = q.isRefetchError && items.length > 0;
  const [retryingStale, setRetryingStale] = useState(false);
  const retryStale = () => {
    if (retryingStale) return;
    setRetryingStale(true);
    void q.refetch().finally(() => setRetryingStale(false));
  };

  let body: ReactNode;
  if (failed) {
    // A dead session (auth) offers the retry too: the proxy already dropped the cookie (query-client
    // onSessionDead) and this read is public, so signing out has nothing left to fix.
    const d = describeError(q.error);
    body = (
      <SubListError
        title={d.title}
        description={d.kind === 'auth' ? 'Concursurile se văd și fără cont. Încearcă din nou.' : d.message}
        onRetry={d.canRetry || d.showSignOut ? () => void q.refetch() : undefined}
        retrying={q.isFetching}
        attempt={q.errorUpdateCount}
      />
    );
  } else if (q.isPending) {
    body = <CardsSkeleton />;
  } else if (items.length === 0) {
    body = (
      <>
        <SubRetryFocus target={headingId} />
        <ListEmpty
          icon={<TrophyIcon aria-hidden className="size-12" />}
          title={counts && counts.started + counts.notStarted + counts.completed === 0 ? NO_COMPETITIONS : meta.empty}
          action={
            next ? (
              <Button variant="secondary" onClick={() => onTab(next)}>
                {NEXT_LABEL[next]}
              </Button>
            ) : undefined
          }
        />
      </>
    );
  } else {
    body = (
      <>
        <SubRetryFocus target={headingId} />
        {/* Polite: a failed re-read is news, not an interruption. */}
        <div aria-live="polite" className="mb-3 empty:hidden">
          {stale ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-status-warning-bg px-3 py-2 t-caption text-status-warning-fg">
              <span>Nu am putut actualiza lista.</span>
              <TextAction onClick={retryStale} disabled={retryingStale}>
                {retryingStale ? 'Se actualizează…' : 'Încearcă din nou'}
              </TextAction>
            </p>
          ) : null}
        </div>
        <ListGrid min="md" labelledBy={headingId} className="gap-y-2.5">
          {items.map((c, i) => (
            <li key={c.documentId} className={cardItemClass(aligned)}>
              <CompetitionCardItem competition={c} aligned={aligned} onOpenPhoto={onOpenPhoto} priority={i < PRIORITY_CARDS} />
            </li>
          ))}
        </ListGrid>
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          error={q.isFetchNextPageError}
          shown={items.length}
          total={total}
          formatTotal={n => formatCount(n, 'concurs', 'concursuri')}
          errorLabel="Nu am putut încărca mai multe concursuri."
        />
      </>
    );
  }

  return (
    <ListRegion id={PANEL_ID} tabpanel labelledBy={`${PANEL_ID}-tab-${tab}`} busy={q.isFetching && !q.isFetchingNextPage && !!q.data}>
      <h2 id={headingId} className="sr-only">
        {meta.title}
      </h2>
      {body}
    </ListRegion>
  );
}

/** The cards' footprint while a tab loads (the /concursuri CardSkeleton, in the same grid). */
export function CardsSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Se încarcă concursurile…</span>
      <ListGrid min="md" className="gap-y-2.5">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </ListGrid>
    </div>
  );
}
