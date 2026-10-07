'use client';

import { Suspense, useId, useMemo, type ReactNode } from 'react';
import { useQuery, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query';
import {
  endReachedTarget,
  filterHistoryRows,
  filterVenues,
  followedAnglerUidsQuery,
  sessionFollowsQuery,
  shouldShowLiveHeader,
  type CommunityActivePage,
  type CommunityHistoryPage,
  type CommunityHistorySessionDTO,
  type CommunityVenueDTO,
  type FilterVenuesOptions,
} from '@/core/partide';
import { CommunityHistoryCard } from '@/components/partide/community/CommunityHistoryCard';
import { NoActiveCta, NoActiveCtaSkeleton } from '@/components/partide/community/NoActiveCta';
import { VenueGroup } from '@/components/partide/community/VenueGroup';
import { DeadFishIcon } from '@/components/icons/brand';
import { ListEmpty, ListError, ListFooter, TextAction } from '@/components/templates/T1';
import { Button } from '@/components/ui/Button';
import { createBrowserTransport } from '@/lib/client/transport';
import { partideHrefs, signedInHref } from '@/lib/partide-pages';
import { isUnknownViewer, userOf, useViewerState } from '../../../_shell/viewer-context';
import { ExploreGrid, ExploreListSkeleton, ExploreSection } from './parts';
import { EMPTY_FETCH_LIMIT, type ExplorePlace } from './place';

/*
 * The list of Partide · Explorează (fish CommunityScene's rows + ListEmptyComponent). Everything
 * public renders at once; what depends on the viewer — the «Cu notificări» / «Prieteni» sets, the
 * viewer's own leaderboard row, the hero's sign-in detour — waits for the session under Suspense
 * (owner rule 4: an unknown set is a skeleton, never «nothing matches»). Signed out both sets are
 * empty (c21): the filtered-empty copy, never a guess.
 */

export type ExploreData = {
  place: ExplorePlace;
  live: UseInfiniteQueryResult<InfiniteData<CommunityActivePage, unknown>>;
  /** Live page 1 has never answered yet (c16): the only time the whole list is a skeleton. */
  liveFirstLoad: boolean;
  history: UseInfiniteQueryResult<InfiniteData<CommunityHistoryPage, unknown>>;
  liveAll: CommunityVenueDTO[];
  historyAll: CommunityHistorySessionDTO[];
  streak: number;
  loadMore: (opts: FilterVenuesOptions, manual: boolean) => Promise<void>;
  onSeeAllLive: () => void;
  onClearFilters: () => void;
};

/** A follow set: known, still loading, or failed (with its retry). */
type FollowSet = { status: 'ok'; ids: Set<string> } | { status: 'pending' } | { status: 'error'; retry: () => void };

type ExploreViewer = { kind: 'pending' } | { kind: 'guest' } | { kind: 'viewer'; uid: string; sessions: FollowSet; anglers: FollowSet };

const EMPTY_SET = new Set<string>();

export function ExploreList(props: ExploreData) {
  return (
    <Suspense fallback={<ListBody {...props} viewer={{ kind: 'pending' }} />}>
      <ListForViewer {...props} />
    </Suspense>
  );
}

function ListForViewer(props: ExploreData) {
  const state = useViewerState();
  if (isUnknownViewer(state)) return <ListBody {...props} viewer={{ kind: 'pending' }} />;
  const user = userOf(state);
  if (!user) return <ListBody {...props} viewer={{ kind: 'guest' }} />;
  return <SignedInList {...props} uid={user.documentId} />;
}

function followSet(q: { data?: Set<string> | string[]; isPending: boolean; isError: boolean; refetch: () => unknown }): FollowSet {
  if (q.data !== undefined) return { status: 'ok', ids: q.data instanceof Set ? q.data : new Set(q.data) };
  if (q.isError) return { status: 'error', retry: () => void q.refetch() };
  return { status: 'pending' };
}

/** fish useSessionFollows (signed in only, c21) + useFollowedAnglerUids (every /following page). */
function SignedInList(props: ExploreData & { uid: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const follows = useQuery(sessionFollowsQuery(t, true));
  const anglers = useQuery(followedAnglerUidsQuery(t, props.uid));
  return <ListBody {...props} viewer={{ kind: 'viewer', uid: props.uid, sessions: followSet(follows), anglers: followSet(anglers) }} />;
}

/** fish NoActiveCta's targets, as the flags stand: with neither page on the web there is no hero. */
const HERO_ON = partideHrefs.start() != null || partideHrefs.join() != null;

function ListBody({
  place,
  live,
  liveFirstLoad,
  history,
  liveAll,
  historyAll,
  streak,
  loadMore,
  onSeeAllLive,
  onClearFilters,
  viewer,
}: ExploreData & { viewer: ExploreViewer }) {
  const liveId = useId();
  const doneId = useId();
  const { liveOnly, chip, venueKey } = place;
  const venueKeys = venueKey ? [venueKey] : [];

  // The set the chip needs: none for «toate»; empty for a guest (c21); unknown while it loads.
  const needed: FollowSet | null =
    chip === 'active'
      ? null
      : viewer.kind === 'guest'
        ? { status: 'ok', ids: EMPTY_SET }
        : viewer.kind === 'pending'
          ? { status: 'pending' }
          : chip === 'urmarite'
            ? viewer.sessions
            : viewer.anglers;
  const filterOpts: FilterVenuesOptions = {
    chip,
    followedSessionIds: chip === 'urmarite' && needed?.status === 'ok' ? needed.ids : EMPTY_SET,
    followedAnglerUids: chip === 'prieteni' && needed?.status === 'ok' ? needed.ids : EMPTY_SET,
    venueKeys,
  };

  // c16 — the full skeleton only until live page 1 has answered once (fish hasLoadedLiveOnceRef);
  // an unknown set too. After that a new venue key reads its pages section by section (below).
  if (liveFirstLoad || needed?.status === 'pending') return <ExploreListSkeleton />;
  if (needed?.status === 'error') {
    return (
      <ListError
        title={chip === 'urmarite' ? 'Nu am putut încărca partidele urmărite.' : 'Nu am putut încărca pescarii pe care îi urmărești.'}
        description="Verifică conexiunea și încearcă din nou."
        onRetry={needed.retry}
      />
    );
  }

  const pages = live.data?.pages ?? [];
  // c7 — outside live-only only live page 1; in live-only every page loaded so far.
  const liveRows = liveOnly ? liveAll : (pages[0]?.data ?? []);
  const filteredLive = filterVenues(liveRows, filterOpts);
  // c5 — «Vezi toate» only when page 1 has a next cursor and live-only is off.
  const showLiveSeeAll = !liveOnly && !!pages[0]?.meta?.nextCursor;
  const showLive = shouldShowLiveHeader(filteredLive.length, showLiveSeeAll);
  const historyRows = filterHistoryRows(historyAll, filterOpts);
  const showDone = !liveOnly && historyRows.length > 0;
  const viewerUid = viewer.kind === 'viewer' ? viewer.uid : null;

  const target = endReachedTarget({ liveOnly, liveHasNextPage: !!live.hasNextPage, historyHasNextPage: !!history.hasNextPage });
  const targetQuery = target === 'live' ? live : history;
  const footer =
    target === 'none' ? null : (
      <ListFooter
        hasMore
        loadingMore={targetQuery.isFetchingNextPage}
        onLoadMore={() => void loadMore(filterOpts, true)}
        error={targetQuery.isFetchNextPageError}
        errorLabel="Nu am putut încărca mai multe partide."
        auto={streak < EMPTY_FETCH_LIMIT}
        moreLabel={showLive || showDone ? 'Încarcă mai multe' : 'Caută mai departe'}
        spinner
      />
    );
  // The list reads its next page through the footer; the footer reports the filters it was seen with.
  const autoFooter = footer ? <AutoFooter key={`${chip}|${venueKey}|${liveOnly}`}>{footer}</AutoFooter> : null;

  if (!showLive && !showDone) {
    // fish ListEmptyComponent, in its order.
    if (live.isError) {
      return <ListError title="Nu am putut încărca partidele." onRetry={() => void live.refetch()} retrying={live.isFetching} />;
    }
    // A section still in flight is never «nothing matches» (owner rule 4).
    if (live.isPending) return <ExploreListSkeleton label="Se încarcă partidele live…" testId="explore-section-skeleton" />;
    if (!liveOnly && history.isPending) return <ExploreListSkeleton label="Se încarcă partidele încheiate…" testId="explore-section-skeleton" />;
    if (!liveOnly && history.isError && historyRows.length === 0) {
      return (
        <ListError
          title="Nu am putut încărca partidele încheiate."
          description="Verifică conexiunea și încearcă din nou."
          onRetry={() => void history.refetch()}
          retrying={history.isFetching}
        />
      );
    }
    const noFilters = chip === 'active' && !venueKey && !liveOnly;
    if (noFilters) return <OverallEmpty viewer={viewer} />;
    const clear = (
      <Button variant="secondary" onClick={onClearFilters}>
        Șterge filtrele
      </Button>
    );
    if (liveOnly) {
      return (
        <div className="flex flex-col gap-2" data-testid="explore-empty-live">
          <ListEmpty icon={<DeadFishIcon size={64} />} title="Nicio partidă live acum." action={clear} />
          {autoFooter}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2" data-testid="explore-empty-filtered">
        <ListEmpty
          icon={<DeadFishIcon size={64} />}
          title={
            chip === 'prieteni'
              ? 'Nu ești singur — pescuitul leagă prietenii. Urmărește profilul unui pescar și vei fi mereu la curent cu partidele lui.'
              : 'Nicio partidă încheiată pentru filtrele alese.'
          }
          action={clear}
        />
        {autoFooter}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8" data-testid="explore-list">
      {showLive ? (
        <ExploreSection
          id={liveId}
          title="În direct"
          live
          testId="live-section"
          action={
            showLiveSeeAll ? (
              <TextAction onClick={onSeeAllLive} aria-label="Vezi toate partidele live">
                Vezi toate
              </TextAction>
            ) : undefined
          }
        >
          {filteredLive.length === 0 ? (
            // c6 — page 1 filtered to nothing while more live pages exist.
            <p className="px-1 t-caption text-muted" data-testid="live-hint">
              Niciun rezultat pe această pagină cu acest filtru. Atinge „Vezi toate” pentru toate partidele live.
            </p>
          ) : (
            <ExploreGrid label="Partide live" testId="live-grid">
              {filteredLive.map(v => (
                <li key={v.key}>
                  <VenueGroup venue={v} viewerUid={viewerUid} />
                </li>
              ))}
            </ExploreGrid>
          )}
        </ExploreSection>
      ) : live.isPending ? (
        <ExploreListSkeleton label="Se încarcă partidele live…" testId="explore-section-skeleton" />
      ) : live.isError ? (
        <InlineError text="Nu am putut încărca partidele live." onRetry={() => void live.refetch()} />
      ) : null}

      {showDone ? (
        <ExploreSection id={doneId} title="Încheiate" testId="finished-section">
          <ExploreGrid label="Partide încheiate" testId="finished-grid">
            {historyRows.map(row => (
              <li key={row.documentId}>
                <CommunityHistoryCard row={row} />
              </li>
            ))}
          </ExploreGrid>
        </ExploreSection>
      ) : !liveOnly && history.isPending ? (
        <ExploreListSkeleton label="Se încarcă partidele încheiate…" testId="explore-section-skeleton" />
      ) : !liveOnly && history.isError ? (
        <InlineError text="Nu am putut încărca partidele încheiate." onRetry={() => void history.refetch()} />
      ) : null}

      {autoFooter}
    </div>
  );
}

/** Keyed by the filters, so a filter change re-arms the footer's observer from scratch. */
function AutoFooter({ children }: { children: ReactNode }) {
  return <div data-testid="explore-footer">{children}</div>;
}

function InlineError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-baseline gap-x-2 px-1">
      <p className="t-body text-ink-2">{text}</p>
      <TextAction onClick={onRetry}>Încearcă din nou</TextAction>
    </div>
  );
}

/** c12 — nothing public at all: the caption and the «Ești la pescuit?» hero (fish NoActiveCta). */
function OverallEmpty({ viewer }: { viewer: ExploreViewer }) {
  const signedIn = viewer.kind === 'viewer';
  return (
    <div className="mx-auto flex w-full max-w-180 flex-col items-center gap-4 pt-6 text-center" data-testid="explore-empty">
      <p className="t-body-strong text-muted">Nicio partidă publică activă acum.</p>
      {HERO_ON ? (
        viewer.kind === 'pending' ? (
          <div className="w-full">
            <NoActiveCtaSkeleton layout="mobile" hasActions />
          </div>
        ) : (
          <div className="w-full text-left">
            <NoActiveCta layout="mobile" start={signedInHref(partideHrefs.start(), signedIn)} join={signedInHref(partideHrefs.join(), signedIn)} />
          </div>
        )
      ) : null}
    </div>
  );
}
