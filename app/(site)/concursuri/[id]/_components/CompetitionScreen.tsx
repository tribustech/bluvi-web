'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  competitionKeys,
  competitionMyStatusQuery,
  competitionQuery,
  competitionsKeys,
  competitionWeighingStatisticsQuery,
  rankingsKeys,
  rankingsQuery,
  SIGNED_OUT_MY_STATUS,
  userStatuteForCompetitionQuery,
  competitionProfileKeys,
  type CompetitionDetail,
  type CompetitionWithMyStatus,
} from '@/core/competitions';
import { activeWeighingQuery, allocatedParticipantsQuery, competitionManagementKeys, weighingKeys } from '@/core/organizer';
import { plural } from '@/components/cards/format';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import {
  DetailActionBar,
  DetailBackButton,
  DetailBand,
  DetailBody,
  DetailError,
  DetailPage,
  DetailSection,
  DetailSignInAgain,
  DetailSignInPrompt,
  DetailTabs,
} from '@/components/templates/T3';
import { ButtonLink } from '@/components/ui/Button';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import type { Viewer } from '@/lib/server/viewer';
import { signInHref } from '../../../_shell/SiteHeader';
import { useViewer } from '../../../_shell/viewer-context';
import { ActiveWeighingBanner, MobileActionBar } from './ActionBar';
import { AllFishView } from './AllFishView';
import { ChatDock, ChatHeaderButton, MobileChatSheet, useChatBadge } from './ChatPanel';
import { CompetitionSkeleton } from './CompetitionSkeleton';
import { isOfflineEmpty, OFFLINE_TITLE } from './offline';
import { QueryRetry } from './QueryRetry';
import { PAGE_RETRY } from './retry-policy';
import { LOAD_ERROR_COPY, skeletonVariantOf } from './screen-state';
import { CompetitionHeader } from './CompetitionHeader';
import { DesktopStats } from './DesktopStats';
import type { PageViewer } from './Follow';
import { FullRankingDialog } from './FullRankingDialog';
import { CompetitionPreview } from './Preview';
import { buildRankingTable, weightDecimals, type RankingSort } from './ranking';
import { RankingView } from './RankingView';
import { StatisticsSkeleton, StatisticsView } from './StatisticsView';
import { pageTransport } from './transport';
import { ViewChips, ViewPanel, ViewTabs } from './ViewSwitch';
import { viewFromPath, viewFromSegment, viewPath, VIEW_PARAM, type RankingViewKey } from './views';
import { WeighingsView } from './WeighingsView';

/*
 * Concurs · Clasament on T3 «Detail with tabs» (components/templates/T3, demo /dev/templates/t3):
 *
 *   <DetailPage phoneGround="surface">       fish's white screen on the phone, page grey from 768
 *     <DetailBand>                           the white band under the top bar, full bleed
 *       <CompetitionHeader>                  fish CompetitionHeader (T3 DetailHeader, centred on the phone)
 *       <DetailTabs>                         fish ROUTES_LIST — Clasament is the page; the rest come in M1
 *     <DetailBody>                           no side columns: the ranking table takes the full width (ROADMAP §4)
 *       stats (from 768) · the four views · the view's content
 *     <DetailActionBar>                      phone: fish RankingActionBar, the weighing banner above it
 *
 * The page renders once, signed out, and never waits for the session: header, tabs and the whole
 * ranking are in the static shell. The session (the shell's cookie-bound promise) is read by one
 * small island behind its own Suspense, which hands it to the screen after hydration; only the
 * per-viewer parts (follow, statute, action bar, chat, the viewer's own row) change then. Until it
 * answers the viewer is `undefined` (unknown), never «signed out».
 */

export type CompetitionDates = {
  label: string;
  start: string;
  end: string;
  prose: string;
  /** «sâm, 11 oct. · 07:00»: the countdown's caption. */
  startShort: string;
};

/** The competition core with a ranking type core does not parse yet (feederRounds today). */
export type LooseCompetition = Omit<CompetitionDetail, 'rankingType'> & { rankingType: string };

type Props = {
  id: string;
  dates: CompetitionDates;
  /** Set when core cannot parse the ranking type: header + preview from this, ranking unavailable. */
  unsupported?: LooseCompetition;
  /** The status the server read: the client fallback skeleton takes its shape (preview or ranking). */
  statusHint?: string;
  /** The view the URL names (/cantare, /statistici, /capturi; Clasament otherwise): rendered by the server. */
  initialView?: RankingViewKey;
};

/** fish's universal link (AASA /competitions/*): the app on a phone, the stores page elsewhere. */
const appLink = (id: string) => `https://bluvi-app.wearetribus.com/competitions/${encodeURIComponent(id)}`;

/** Spoken with a route tab that has no web page yet. */
const SOON = 'În curând pe web';

/** A tab that comes back after this long re-reads the live parts (fish pull-to-refresh, parity clasament.c6). */
const REFRESH_ON_RETURN_MS = 30_000;

/**
 * A live competition left open re-reads its live parts this often while the tab is visible
 * (parity b.foreground-refresh; TanStack pauses the interval in a hidden tab).
 */
const LIVE_POLL_MS = 45_000;

export function CompetitionScreen(props: Props) {
  const [viewer, setViewer] = useState<PageViewer>(undefined);
  const onViewer = useCallback((v: Viewer | null) => setViewer(v), []);
  return (
    <>
      <Suspense fallback={null}>
        <ViewerIsland onViewer={onViewer} />
      </Suspense>
      <Screen {...props} viewer={viewer} />
    </>
  );
}

function ViewerIsland({ onViewer }: { onViewer: (v: Viewer | null) => void }) {
  const viewer = useViewer();
  useEffect(() => onViewer(viewer), [viewer, onViewer]);
  return null;
}

function Screen({ id, dates, viewer, unsupported, statusHint, initialView = 'clasament' }: Props & { viewer: PageViewer }) {
  const t = useMemo(() => pageTransport(), []);
  const qc = useQueryClient();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const breakpoint = useBreakpoint();
  const isAuthenticated = !!viewer;
  const session = { isAuthenticated };

  const competitionQ = useQuery({
    ...competitionQuery(t, id, session),
    ...PAGE_RETRY,
    // An unsupported core cannot be parsed by the browser either: it stays what the server read
    // (the follow mutation still updates it optimistically).
    ...(unsupported
      ? { enabled: false, initialData: { ...unsupported, ...SIGNED_OUT_MY_STATUS } as unknown as CompetitionWithMyStatus }
      : {}),
  });
  // Unsupported core: the viewer's overlay (isFollowing, registration) is read on its own.
  const myStatusQ = useQuery({ ...competitionMyStatusQuery(t, id, session), ...PAGE_RETRY, enabled: !!unsupported && isAuthenticated });
  const statuteQ = useQuery({ ...userStatuteForCompetitionQuery(t, id, session), ...PAGE_RETRY });
  // The server hydrated the signed-out overlay (isFollowing false): re-read it once with the session.
  // Until that answer lands the overlay is stale, so the follow pill waits (a bone) rather than
  // offering the wrong action — and if the re-read FAILS it is still stale: `failed`, and the follow
  // button only offers to check again (never a follow / unfollow decided on the signed-out overlay).
  const [overlayRead, setOverlayRead] = useState<'pending' | 'ok' | 'failed'>('pending');
  useEffect(() => {
    if (!isAuthenticated) return;
    let live = true;
    void qc.invalidateQueries({ queryKey: competitionsKeys.byId(id), exact: true }).then(() => {
      if (live) setOverlayRead(qc.getQueryState(competitionsKeys.byId(id))?.status === 'error' ? 'failed' : 'ok');
    });
    return () => {
      live = false;
    };
  }, [isAuthenticated, id, qc]);
  /** The follow button's «check again»: re-reads the overlay (and a failed statute); true when both answered. */
  const recheckOverlay = async (): Promise<boolean> => {
    await Promise.all([
      unsupported ? myStatusQ.refetch() : qc.invalidateQueries({ queryKey: competitionsKeys.byId(id), exact: true }),
      statuteQ.isError ? statuteQ.refetch() : undefined,
    ]);
    const overlayKey = unsupported ? competitionMyStatusQuery(t, id, session).queryKey : competitionsKeys.byId(id);
    const ok =
      qc.getQueryState(overlayKey)?.status !== 'error' &&
      qc.getQueryState(userStatuteForCompetitionQuery(t, id, session).queryKey)?.status !== 'error';
    if (!unsupported) setOverlayRead(ok ? 'ok' : 'failed');
    return ok;
  };

  const competition =
    unsupported && competitionQ.data && myStatusQ.data ? { ...competitionQ.data, ...myStatusQ.data } : competitionQ.data;
  const status = competition?.competitionStatus;
  // fish CompetitionRanking: only notStarted gets the preview; every other status (started,
  // completed, cancelled, draft) gets the views and the ranking (or «Nu există date de afișat»).
  const rankingVisible = !!status && status !== 'notStarted';

  const overlayPending = isAuthenticated && (unsupported ? myStatusQ.isPending : overlayRead === 'pending');
  const overlayFailed =
    isAuthenticated &&
    ((unsupported ? myStatusQ.isError && !myStatusQ.data : overlayRead === 'failed') || (statuteQ.isError && !statuteQ.data));
  const statute = statuteQ.data;
  const chatBadge = useChatBadge(id, viewer ?? null, statute);

  // The view is addressable as a path segment (/cantare, /statistici, /capturi — parity
  // tab-deep-links): the server renders the one the URL names (initialView). Switching keeps it in
  // the history with pushState (Next keeps its router and usePathname in sync, no navigation);
  // Back / Forward restore it. An old `?vedere=` link is replaced by its segment.
  const [view, setView] = useState<RankingViewKey>(initialView);
  useEffect(() => {
    const legacy = new URLSearchParams(window.location.search).get(VIEW_PARAM);
    if (legacy !== null) {
      // An old link: navigate (replace) to the view's segment, which the server renders open.
      const url = new URL(window.location.href);
      url.searchParams.delete(VIEW_PARAM);
      router.replace(`${viewPath(routes.competition(id), viewFromSegment(legacy))}${url.search}${url.hash}`, { scroll: false });
    }
    const read = () => setView(viewFromPath(window.location.pathname));
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [id, router]);
  const [sortBy, setSortBy] = useState<RankingSort>('stand');
  const [barMessage, setBarMessage] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);

  const live = status === 'started';
  const poll = { refetchInterval: live ? LIVE_POLL_MS : false } as const;
  const rankingsQ = useQuery({ ...rankingsQuery(t, id, status), ...PAGE_RETRY, ...poll, ...(unsupported ? { enabled: false } : {}) });
  const { data: activeWeighing } = useQuery({ ...activeWeighingQuery(t, id, session), ...PAGE_RETRY, ...poll });
  const isDesktop = breakpoint !== 'mobile';
  // The server prefetched it (page body): the stat row is painted with it, before hydration.
  const weighingStatsQ = useQuery({
    ...competitionWeighingStatisticsQuery(t, id, status, {
      enabled: !unsupported && (view === 'statistici' || (isDesktop && rankingVisible)),
    }),
    ...PAGE_RETRY,
  });
  // Poll the weighing statistics too (the «Cântar în curs» / «Ultimul cântar» tile).
  useEffect(() => {
    if (!live || unsupported) return;
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') void qc.invalidateQueries({ queryKey: competitionKeys.weighingStatistics(id) });
    }, LIVE_POLL_MS);
    return () => clearInterval(tick);
  }, [live, unsupported, id, qc]);
  const allocatedQ = useQuery({
    ...allocatedParticipantsQuery(t, id),
    ...PAGE_RETRY,
    enabled: !unsupported && (view === 'cantare' || (isDesktop && !!activeWeighing?.length)),
  });

  // fish builds the table from the stand order (default) or the place order (Sortare).
  const table = useMemo(() => buildRankingTable(rankingsQ.data, sortBy), [rankingsQ.data, sortBy]);
  // Desktop: the table sorts itself; its rows are built once, in place order.
  const placeTable = useMemo(() => buildRankingTable(rankingsQ.data, 'position'), [rankingsQ.data]);
  // One weight precision for the whole competition (the tiles line up on the comma).
  const decimals = useMemo(() => weightDecimals(placeTable), [placeTable]);

  /** fish `handleChipPress`: switching view refreshes that view's data (parity clasament.c5). */
  const selectView = (next: RankingViewKey) => {
    if (next !== view) {
      const url = new URL(window.location.href);
      url.pathname = viewPath(routes.competition(id), next);
      window.history.pushState(null, '', url);
    }
    setView(next);
    if (next === 'statistici' || next === 'clasament') {
      void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.rankingBestN(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.weighingStatistics(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.timelineSnapshot(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.catchThresholdCounts(id) });
    } else if (next === 'allFish') {
      // Every sort/filter variant of competitionKeys.catchesInfinite(id, …).
      void qc.invalidateQueries({ queryKey: [...competitionKeys.all, id, 'catches'] });
    } else if (next === 'cantare') {
      void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(id) });
    }
  };

  /**
   * fish `onRefresh` (pull-to-refresh) + refreshActionSheetQueries — on the web, when the reader
   * comes back to the tab after a while (parity clasament.c6).
   */
  const lastRefresh = useRef(0);
  useEffect(() => {
    lastRefresh.current = Date.now();
    const refresh = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRefresh.current < REFRESH_ON_RETURN_MS) return;
      lastRefresh.current = Date.now();
      for (const queryKey of [
        rankingsKeys.byCompetitionId(id),
        competitionKeys.rankingBestN(id),
        competitionKeys.weighingStatistics(id),
        competitionKeys.timelineSnapshot(id),
        [...competitionKeys.all, id, 'catches'],
        weighingKeys.byCompetitionId(id),
        competitionsKeys.byId(id),
        competitionProfileKeys.statuteForCompetition(id),
        competitionManagementKeys.allocatedParticipants(id),
      ]) {
        void qc.invalidateQueries({ queryKey });
      }
    };
    // A hidden tab coming back, or a window coming back to the front (focus without hiding).
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [id, qc]);

  /** fish `handleSortChange` + its bar message. */
  const changeSort = (by: RankingSort) => {
    setSortBy(by);
    setBarMessage(
      by === 'stand'
        ? 'Sortarea clasamentului după stand a fost efectuată.'
        : 'Sortarea clasamentului după poziția în clasament a fost efectuată.',
    );
  };

  if (!competition) {
    const offline = isOfflineEmpty(competitionQ);
    if (offline || competitionQ.isError) {
      const error = competitionQ.error;
      const dead = isApiError(error) && (error.code === 'SESSION_DEAD' || error.status === 401);
      return (
        <DetailError
          back={<DetailBackButton fallbackHref={routes.home()} ground="page" />}
          heading="Concursul nu a putut fi încărcat"
          description={offline ? OFFLINE_TITLE : dead ? 'Sesiunea ta a expirat. Intră din nou în cont.' : LOAD_ERROR_COPY}
          action={
            dead && !offline ? (
              <DetailSignInAgain signIn={signInHref(pathname)} />
            ) : (
              <QueryRetry fetching={competitionQ.isFetching} failed={offline || competitionQ.isError} onRetry={() => void competitionQ.refetch()} />
            )
          }
        />
      );
    }
    return <CompetitionSkeleton variant={skeletonVariantOf(statusHint, !!unsupported)} />;
  }

  const signIn = signInHref(pathname);
  const registered = competition.registrations.filter(r => r.registrationStatus === 'registered').length;
  // The bar's tiles (ActionBar.tsx): Înscrie-te before the start, the ranking tiles once there is a
  // ranking the web can show, Chat when signed in. Share is always the header's chip.
  const barHasActions =
    status === 'notStarted' ||
    ((status === 'started' || status === 'completed') && !unsupported) ||
    isAuthenticated ||
    hasBanner(activeWeighing);

  return (
    <DetailPage phoneGround={rankingVisible ? 'surface' : 'page'}>
      <DetailBand>
        <CompetitionHeader
          competition={competition}
          viewer={viewer}
          statute={statute}
          statutePending={isAuthenticated && ((statuteQ.isPending && statuteQ.fetchStatus !== 'paused') || overlayPending)}
          overlayFailed={overlayFailed}
          onRecheckOverlay={recheckOverlay}
          datesProse={dates.prose}
          signIn={signIn}
          // From 768, signed in: the chat is a header action (nothing floats over the table).
          chat={viewer ? <ChatHeaderButton badge={chatBadge} open={dockOpen} onToggle={() => setDockOpen(o => !o)} /> : undefined}
        />
        {/* fish ROUTES_LIST. Clasament is this page; the other tabs come with M1. */}
        <DetailTabs
          label="Secțiunile concursului"
          tabs={[
            { label: 'Clasament', href: routes.competition(id), current: true },
            // Not on the web yet (M1): shown greyed, no visible «curând» tag (it cut the phone strip
            // mid-word); the reason is spoken with each one.
            { label: 'Informații', absent: SOON },
            { label: 'Participanți', count: registered, absent: SOON },
            { label: 'Extra Cântare', absent: SOON },
            { label: 'Regulament', absent: SOON },
          ]}
        />
      </DetailBand>

      {rankingVisible ? (
        <DetailBody>
          {unsupported ? (
            // fish renders feeder legs (FeederLegTabs + FeederRankingTable); the web has no view for
            // them yet: a centred state at the prose measure, with the way to see it (the app).
            <DetailSection tone="plain">
              <AppOnlyState id={id} title="Clasamentul acestui tip de concurs nu este încă disponibil pe web." />
            </DetailSection>
          ) : (
            <>
              <div className="max-md:hidden">
                <DesktopStats
                  metadata={rankingsQ.data?.metadata}
                  rankings={table?.rows}
                  competition={competition}
                  activeWeighing={activeWeighing}
                  weighings={weighingStatsQ.data?.data}
                  weighingsLoading={weighingStatsQ.isPending && weighingStatsQ.fetchStatus !== 'idle'}
                  weighingsError={(weighingStatsQ.isError || weighingStatsQ.fetchStatus === 'paused') && !weighingStatsQ.data}
                  reserveWeighing={status === 'started' || status === 'completed'}
                  decimals={decimals}
                  onRetryWeighings={() => void weighingStatsQ.refetch()}
                  allocated={allocatedQ.data}
                  onAllWeighings={() => selectView('cantare')}
                />
              </div>
              <DetailSection tone="plain" className="flex flex-col gap-4 max-md:pt-2">
                <ViewChips value={view} onChange={selectView} />
                <ViewTabs
                  value={view}
                  onChange={selectView}
                  meta={{
                    clasament: placeTable ? `General · ${plural(placeTable.rows.length, 'pescar', 'pescari')}` : 'General',
                    cantare: weighingsMeta(
                      activeWeighing?.length ?? 0,
                      weighingStatsQ.data?.data,
                      weighingStatsQ.isPending,
                      weighingStatsQ.isError && !weighingStatsQ.data,
                    ),
                    statistici: 'Top 3/5/7 · pe sectoare',
                    allFish:
                      typeof rankingsQ.data?.metadata.totalCatchesCount === 'number'
                        ? plural(rankingsQ.data.metadata.totalCatchesCount, 'captură', 'capturi')
                        : 'Toate capturile',
                  }}
                  live={status === 'started' && !!activeWeighing?.length}
                />

                <ViewPanel value={view}>
                  {view === 'clasament' && (
                    <RankingView
                      appOnly={<AppOnlyState id={id} title="Clasamentul pe cluburi nu este încă disponibil pe web." />}
                      query={rankingsQ}
                      table={table}
                      placeTable={placeTable}
                      currentUserStandId={currentUserStandId(competition, viewer ?? null)}
                      onFullView={() => setFullOpen(true)}
                    />
                  )}
                  {view === 'statistici' &&
                    (viewer === null ? (
                      <DetailSignInPrompt message="Trebuie să fii autentificat pentru a vedea statisticile." href={signIn} />
                    ) : viewer ? (
                      <StatisticsView
                        t={t}
                        competition={competition}
                        metadata={rankingsQ.data?.metadata}
                        rankings={rankingsQ.data}
                        rankingRows={table?.rows}
                        weighingStats={weighingStatsQ}
                        decimals={decimals}
                      />
                    ) : (
                      // The session is not known yet: the view's shape, not an empty panel.
                      <StatisticsSkeleton />
                    ))}
                  {view === 'cantare' && (
                    <WeighingsView t={t} competition={competition} allocated={allocatedQ} isAuthenticated={isAuthenticated} />
                  )}
                  {view === 'allFish' && <AllFishView t={t} competition={competition} />}
                </ViewPanel>
              </DetailSection>
            </>
          )}
        </DetailBody>
      ) : (
        <CompetitionPreview competition={competition} dates={dates} />
      )}

      {/* Nothing to offer but what the header already has (its share chip): no bar at all. */}
      {barHasActions ? (
        <DetailActionBar
          label="Bara de acțiuni"
          above={hasBanner(activeWeighing) ? <ActiveWeighingBanner weighings={activeWeighing} onPress={() => selectView('cantare')} /> : undefined}
        >
          <MobileActionBar
            competition={competition}
            isAuthenticated={isAuthenticated}
            signIn={signIn}
            onSort={changeSort}
            onView={selectView}
            onFullView={() => setFullOpen(true)}
            fullViewDisabled={!table}
            onChat={isAuthenticated ? () => setChatOpen(true) : undefined}
            chatBadge={chatBadge}
            rankingAvailable={!unsupported}
            barMessage={barMessage}
            onBarMessageDismiss={() => setBarMessage(null)}
          />
        </DetailActionBar>
      ) : null}

      <FullRankingDialog open={fullOpen} onClose={() => setFullOpen(false)} title={competition.name} table={placeTable} />
      {/* From 768, signed in only: signed out it could only lead to «Intră în cont» (the phone bar has no Chat tile either). */}
      {viewer ? (
        <ChatDock
          open={dockOpen}
          onClose={() => setDockOpen(false)}
          competition={competition}
          viewer={viewer}
          statute={statute}
          signIn={signIn}
          badge={chatBadge}
        />
      ) : null}
      <MobileChatSheet
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        competition={competition}
        viewer={viewer ?? null}
        statute={statute}
        signIn={signIn}
      />
    </DetailPage>
  );
}

const hasBanner = (w: { stand: unknown }[] | undefined) => !!w?.length && !!w[0]?.stand;

/**
 * A ranking the web cannot draw yet (feeder legs, club rankings): centred at the prose measure, what
 * is missing and the way to see it — the competition in the Bluvi app.
 */
function AppOnlyState({ id, title }: { id: string; title: string }) {
  return (
    <div className="mx-auto flex w-full max-w-140 flex-col items-center gap-4 rounded-card bg-surface px-6 py-8 text-center shadow-e0 max-md:shadow-none">
      <div className="flex flex-col gap-1">
        <h2 className="t-heading text-ink">{title}</h2>
        <p className="t-body text-muted">Îl poți urmări în aplicația Bluvi.</p>
      </div>
      <ButtonLink href={appLink(id)}>Deschide în aplicație</ButtonLink>
    </div>
  );
}

/** The signed-in angler's stand (ranking `standId` is the stand's numeric id). */
function currentUserStandId(
  competition: { registrations: { registrationStatus: string; stand: { id: number } | null; participants: { documentId: string }[] }[] },
  viewer: Viewer | null,
): string | null {
  if (!viewer) return null;
  const mine = competition.registrations.find(
    r => r.registrationStatus === 'registered' && r.participants.some(p => p.documentId === viewer.documentId),
  );
  return mine?.stand ? String(mine.stand.id) : null;
}

function weighingsMeta(active: number, weighings: { endDate: string | null }[] | undefined, loading: boolean, failed: boolean): string {
  // A failed read is not «Pe standuri» (that reads as «no weighing yet»).
  if (!weighings && failed) return active > 0 ? `${active} în curs · Indisponibil` : 'Indisponibil';
  const done = weighings?.filter(w => w.endDate).length ?? 0;
  const parts = [active > 0 ? `${active} în curs` : null, weighings ? `${done} ${done === 1 ? 'finalizat' : 'finalizate'}` : null];
  // Until the statistics land the count is unknown: a neutral placeholder, not «Pe standuri».
  if (!weighings && loading) parts.push('…');
  return parts.filter(Boolean).join(' · ') || 'Pe standuri';
}
