'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { notifyManager, useQueryClient, type InfiniteData, type QueryState } from '@tanstack/react-query';
import { ListHeader, ListPage, ListRegion, ListTabs, LiveDot } from '@/components/templates/T1';
import { DashboardRefresh, type RefreshResult } from '@/components/templates/T5';
import { filteredCompetitionsInfiniteQuery, type CompetitionListResponse } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { routes } from '@/lib/routes';
import { useBack } from '../../../balti/[id]/_sub/useBack';
import { RESULTS_REFRESH } from '../../_list/resultsChromeStyles';
import { STATUS_LIST_PAGINATION, STATUS_LISTS, STATUS_TAB_ORDER, type StatusListKey } from './config';
import { StatusListSkeleton } from './LegacyCompetitionCard';

/*
 * The status list's frame — header (back, title, count line, refresh, the status tabs) and the
 * list region — OUTSIDE the page's Suspense boundary (StatusListPage): the header is the same DOM
 * while the server's first page streams in, when the client screen mounts and when the cards land,
 * so its title never moves and a keyboard user who reached «Înapoi» during the stream keeps focus
 * (a Suspense fallback is replaced, never reused). Only the region's content is suspended.
 *
 * The header reads the list's query from the cache WITHOUT creating it (useSyncExternalStore on
 * the query cache): creating it here, before the screen's HydrationBoundary, would make that
 * boundary defer the server's page to an effect and the screen would hydrate a skeleton over the
 * server's cards. The screen (StatusListScreen) owns the query; the header follows it.
 */

export const TITLE_ID = 'concursuri-status-titlu';
export const PANEL_ID = 'concursuri-status';

/** The list's query key — the same factory and arguments as the screen and the server page. */
export function statusListQueryKey(list: StatusListKey) {
  return filteredCompetitionsInfiniteQuery(null as unknown as Transport, {
    status: STATUS_LISTS[list].status,
    pagination: STATUS_LIST_PAGINATION,
  }).queryKey;
}

type ListState = QueryState<InfiniteData<CompetitionListResponse>, Error> | undefined;

/** The list query's state, or undefined while no one has read it yet. Never creates the query. */
export function useStatusListState(list: StatusListKey): ListState {
  const qc = useQueryClient();
  const key = useMemo(() => statusListQueryKey(list), [list]);
  // Scheduled like TanStack's own observers: the cache changes while the screen's HydrationBoundary
  // renders, and the header must not update in the middle of another component's render.
  const subscribe = useCallback((cb: () => void) => qc.getQueryCache().subscribe(notifyManager.batchCalls(cb)), [qc]);
  const get = () => qc.getQueryCache().find<InfiniteData<CompetitionListResponse>>({ queryKey: key, exact: true })?.state as ListState;
  // The server renders the header before the page's data is in any cache: undefined on both sides.
  return useSyncExternalStore(subscribe, get, () => undefined);
}

/** Whether the first page failed with nothing on screen (the screen shows its error card). */
export function firstPageFailed(s: ListState) {
  if (!s || s.data) return false;
  return s.status === 'error' || s.fetchStatus === 'paused' || (s.fetchStatus === 'fetching' && s.errorUpdateCount > 0);
}

const Busy = createContext<{ refreshing: boolean; setRefreshing: (v: boolean) => void }>({
  refreshing: false,
  setRefreshing: () => {},
});
/** The user's own «Reîmprospătează» is running (the region is aria-busy; background reads stay silent). */
export const useRefreshing = () => useContext(Busy).refreshing;

/** The three global lists as link tabs (each its own indexable URL), Live with the on-air dot. */
export function StatusTabs({ active }: { active: StatusListKey }) {
  return (
    <ListTabs
      label="Concursuri după stare"
      active={active}
      tabs={STATUS_TAB_ORDER.map(k => ({
        key: k,
        label: STATUS_LISTS[k].tab,
        href: routes.competitionsByStatus(k),
        leading: k === 'live' ? <LiveDot /> : undefined,
      }))}
    />
  );
}

/** The count line while the total is unknown: a bar in the caption's own 16px line box. */
export function CountPlaceholder() {
  return <span aria-hidden className="inline-block h-3 w-32 animate-shimmer rounded-full align-middle" />;
}

/** A line box of the caption's height with nothing to say (the error card speaks): the header keeps its size. */
function EmptyLine() {
  return (
    <span aria-hidden className="invisible">
      ·
    </span>
  );
}

export function StatusListShell({ list, children }: { list: StatusListKey; children: ReactNode }) {
  const cfg = STATUS_LISTS[list];
  const qc = useQueryClient();
  const router = useRouter();
  const back = useBack(routes.competitions());
  const state = useStatusListState(list);
  const [refreshing, setRefreshing] = useState(false);
  const busy = useMemo(() => ({ refreshing, setRefreshing }), [refreshing]);

  const total = state?.data?.pages[0]?.meta.pagination.total;
  const failed = firstPageFailed(state);
  // The count line keeps its box in every state: the bar while the first page loads, the count
  // (also «0 …» when empty), an invisible line under the error card.
  const description = total !== undefined ? cfg.count(total) : failed ? <EmptyLine /> : <CountPlaceholder />;

  const refresh = async (): Promise<RefreshResult> => {
    const key = statusListQueryKey(list);
    if (!qc.getQueryCache().find({ queryKey: key, exact: true })) {
      // Nothing read yet (the server's page is still streaming): re-render the page.
      router.refresh();
      return 'reported';
    }
    setRefreshing(true);
    try {
      await qc.refetchQueries({ queryKey: key, exact: true });
      return qc.getQueryState(key)?.status !== 'error';
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Busy.Provider value={busy}>
      <ListPage
        header={
          <ListHeader
            title={cfg.title}
            titleId={TITLE_ID}
            back={{ label: 'Înapoi', onClick: back }}
            description={description}
            // Below 768 the refresh takes the back square's framing.
            actions={
              <span className={RESULTS_REFRESH}>
                <DashboardRefresh onRefresh={refresh} />
              </span>
            }
            below={<StatusTabs active={list} />}
          />
        }
      >
        {children}
      </ListPage>
    </Busy.Provider>
  );
}

/** The region while the server's first page streams in: the cards' skeleton, busy. */
export function StatusListFallback() {
  return (
    <ListRegion id={PANEL_ID} labelledBy={TITLE_ID} busy>
      <StatusListSkeleton />
    </ListRegion>
  );
}
