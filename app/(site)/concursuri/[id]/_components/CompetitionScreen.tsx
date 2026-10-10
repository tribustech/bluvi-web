'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExclamationTriangleIcon, LockClosedIcon, PlusCircleIcon, ScaleIcon, XCircleIcon } from '@heroicons/react/24/outline';
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
  canRequestExtraScale,
  defaultFeederTab,
  getRegistrationByStandId,
  hasRequestedExtraScale,
  isNationalChampionshipRankings,
  registrationAction,
  type CompetitionDetail,
  type CompetitionWithMyStatus,
  type FeederRoundsRanking,
  type FeederTab,
} from '@/core/competitions';
import {
  activeWeighingQuery,
  allocatedParticipantsQuery,
  type CompetitionActiveWeighing,
  competitionManagementKeys,
  deleteExtraScaleRequestMutation,
  extraScalesListQuery,
  requestExtraScaleMutation,
  weighingKeys,
} from '@/core/organizer';
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
  DetailSectionState,
  DetailSignInAgain,
  DetailTabs,
} from '@/components/templates/T3';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Dialog } from '@/components/surfaces/Dialog';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import type { Viewer } from '@/lib/server/viewer';
import { signInHref } from '../../../_shell/SiteHeader';
import { isUnknownViewer, useViewerState } from '../../../_shell/viewer-context';
import { ActionsSheet } from './ActionsSheet';
import { ActiveWeighingBanner, FLOATING_ACTIONS_BAR, MobileActionBar, SORT_OPTION, type BarConfirm } from './ActionBar';
import { FeederHelp, FeederLegTabs, FeederRankingTable, feederLegEmpty, type FeederData } from './FeederRanking';
import { FishFeederLegTabs, FishFeederTable } from './FishFeeder';
import { FishNcPills, FishNcTable } from './FishNc';
import { NcRankingTable, NcSectorPills, NcSortControl, ncSortFor, type NcSort, type NcView } from './NcRanking';
import { useSiteToast } from '../../../_shell/Toast';
import { AllFishView } from './AllFishView';
import { ChatHeaderButton, markChatFromCompetition, useChatBadge, useChatHref } from './ChatPanel';
import { CompetitionSkeleton } from './CompetitionSkeleton';
import { isOfflineEmpty, OFFLINE_TITLE } from './offline';
import { cn } from '@/components/ui/cn';
import { SignInGate } from '@/components/templates/SignInGate';
import { COLUMN_STICKY_TOP_BELOW_TABS } from '@/components/templates/T3/metrics';
import { QueryRetry } from './QueryRetry';
import { RefreshRetry } from './RefreshRetry';
import { LIVE_POLL_MS, PAGE_RETRY } from './retry-policy';
import { LOAD_ERROR_COPY, skeletonVariantOf } from './screen-state';
import { CompetitionHeader, shareText } from './CompetitionHeader';
import { CompetitionStickyTabs } from './CompetitionStickyTabs';
import { DesktopStats, entrantCounts, weighingTileTone } from './DesktopStats';
import type { PageViewer } from './Follow';
import { FullRankingDialog } from './FullRankingDialog';
import { imageQueryFor, imageQueryString } from '../clasament/imagine/model';
import { trackRankingImage } from '../clasament/imagine/analytics';
import { FullViewButtons } from './rankingShell';
import { CompetitionPreview } from './Preview';
import { buildRankingTable, rawWeightDecimals, weightDecimals, type RankingSort } from './ranking';
import { RankingView } from './RankingView';
import { StatisticsSkeleton, StatisticsView } from './StatisticsView';
import { pageTransport } from './transport';
import { ViewChips, ViewPanel, ViewTabs, type ViewBadge } from './ViewSwitch';
import { viewFromPath, viewFromSegment, viewPath, VIEW_PARAM, type RankingViewKey } from './views';
import { WeighingsView } from './WeighingsView';
import { AnglerStats } from './AnglerStats';
import { PRESSABLE_ROWS, useRowPress } from './rowPress';
import { COMPETITION_TABS, type CompetitionTab } from './tabs';
import { TABS_MARK, useCompetitionAnalytics } from './analytics';
import { PublishConfetti } from './PublishConfetti';
import { TabBody } from './TabBody';
import { isNationalType } from './stand';
import { ManagerWeighingNotice, scaleHrefOf } from './organizer/ActiveWeighingBanner';
import { ORGANIZER_MENU_OPEN, OrganizerMenu } from './organizer/OrganizerMenu';
import { canWeigh, organizerSheetItems, penaltiesTile, refereeScaleTile, refereeSheetItems, roleOf } from './organizer/model';
import { useOrganizer } from './organizer/useOrganizer';

/*
 * Concurs · Clasament on T3 «Detail with tabs» (components/templates/T3, demo /dev/templates/t3):
 *
 *   <DetailPage phoneGround="surface">       fish's white screen on the phone, page grey from 768
 *     <DetailBand>                           the white band under the top bar, full bleed
 *       <CompetitionHeader>                  fish CompetitionHeader (T3 DetailHeader, centred on the phone)
 *       <DetailTabs>                         fish ROUTES_LIST — Clasament is the page; the rest come in M1
 *     <DetailBody>                           no side columns at any width: the ranking table takes the whole
 *                                            shell column (ROADMAP §4 «tables take all the available width»;
 *                                            e2e full-width.spec)
 *       stats strip (from 768, one row from 1280) · the four views · the view's content
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
  /** «sâm, 11 oct 2026 · 07:00»: the details' facts (one line in the narrow left column). */
  startCompact: string;
  endCompact: string;
};

/** The competition core with a ranking type core does not parse (one added to the CMS after this build). */
export type LooseCompetition = Omit<CompetitionDetail, 'rankingType'> & {
  rankingType: string;
};

type Props = {
  id: string;
  dates: CompetitionDates;
  /** Set when core cannot parse the ranking type: header + preview from this, ranking unavailable. */
  unsupported?: LooseCompetition;
  /** The status the server read: the client fallback skeleton takes its shape (preview or ranking). */
  statusHint?: string;
  /** The view the URL names (/cantare, /statistici, /capturi; Clasament otherwise): rendered by the server. */
  initialView?: RankingViewKey;
  /** The route tab the URL names (/informatii, /participanti, /extra-cantare, /regulament; Clasament otherwise). */
  tab?: CompetitionTab;
};

/** fish's universal link (AASA /competitions/*): the app on a phone, the stores page elsewhere. */
const appLink = (id: string) => `https://bluvi-app.wearetribus.com/competitions/${encodeURIComponent(id)}`;

/** A tab that comes back after this long re-reads the live parts (fish pull-to-refresh, parity clasament.c6). */
const REFRESH_ON_RETURN_MS = 30_000;

export function CompetitionScreen(props: Props) {
  const [viewer, setViewer] = useState<PageViewer>(undefined);
  const [sessionUnknown, setSessionUnknown] = useState(false);
  const onViewer = useCallback((v: Viewer | null) => setViewer(v), []);
  return (
    <>
      <Suspense fallback={null}>
        <ViewerIsland onViewer={onViewer} onUnknown={setSessionUnknown} />
      </Suspense>
      <Screen {...props} viewer={viewer} sessionUnknown={viewer === undefined && sessionUnknown} />
      {/* parity shell.c27: ?fromPublish=1 → a one-shot confetti, the param dropped. */}
      <PublishConfetti />
    </>
  );
}

/**
 * Hands the session to the screen. An unknown session (a cookie whose read failed —
 * ../../../_shell/session.ts) is never handed down as «signed out»: the screen keeps it pending
 * (`undefined`, no guest prompt); it is flagged instead (`onUnknown`), so the parts waiting for it
 * say so and offer to check again rather than staying a skeleton.
 */
function ViewerIsland({ onViewer, onUnknown }: { onViewer: (v: Viewer | null) => void; onUnknown: (unknown: boolean) => void }) {
  const viewer = useViewerState();
  useEffect(() => {
    const unknown = isUnknownViewer(viewer);
    onUnknown(unknown);
    if (!unknown) onViewer(viewer);
  }, [viewer, onViewer, onUnknown]);
  return null;
}

function Screen({
  id,
  dates,
  viewer,
  sessionUnknown,
  unsupported,
  statusHint,
  initialView = 'clasament',
  tab = 'clasament',
}: Props & { viewer: PageViewer; sessionUnknown: boolean }) {
  // The route tab (parity competition-page.b.tab-deep-links): Clasament (the ranking and its views)
  // or one of Informații / Participanți / Extra Cântare / Regulament, each its own page.
  const onClasament = tab === 'clasament';
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
      ? {
          enabled: false,
          initialData: {
            ...unsupported,
            ...SIGNED_OUT_MY_STATUS,
          } as unknown as CompetitionWithMyStatus,
        }
      : {}),
  });
  // Unsupported core: the viewer's overlay (isFollowing, registration) is read on its own.
  const myStatusQ = useQuery({
    ...competitionMyStatusQuery(t, id, session),
    ...PAGE_RETRY,
    enabled: !!unsupported && isAuthenticated,
  });
  const statuteQ = useQuery({
    ...userStatuteForCompetitionQuery(t, id, session),
    ...PAGE_RETRY,
  });
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
      unsupported
        ? myStatusQ.refetch()
        : qc.invalidateQueries({
            queryKey: competitionsKeys.byId(id),
            exact: true,
          }),
      statuteQ.isError ? statuteQ.refetch() : undefined,
    ]);
    const overlayKey = unsupported ? competitionMyStatusQuery(t, id, session).queryKey : competitionsKeys.byId(id);
    const ok =
      qc.getQueryState(overlayKey)?.status !== 'error' &&
      qc.getQueryState(userStatuteForCompetitionQuery(t, id, session).queryKey)?.status !== 'error';
    if (!unsupported) setOverlayRead(ok ? 'ok' : 'failed');
    return ok;
  };

  const competition = unsupported && competitionQ.data && myStatusQ.data ? { ...competitionQ.data, ...myStatusQ.data } : competitionQ.data;
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
  const chatHref = useChatHref(id);
  // parity shell.c18 / c21: competition_page_tab_pressed and share_competition (analytics.ts).
  useCompetitionAnalytics(id, competition?.name, tab);

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
  // Bumped by every Sortare pick, the same value too: the phone table starts over in the order the
  // bar names even after a header sort (fish's Sortare always leaves the rows in that order).
  const [sortNonce, setSortNonce] = useState(0);
  const [barMessage, setBarMessage] = useState<string | null>(null);
  const [fullOpen, setFullOpen] = useState(false);

  const live = status === 'started';
  const poll = { refetchInterval: live ? LIVE_POLL_MS : false } as const;
  const rankingsQ = useQuery({
    ...rankingsQuery(t, id, status),
    ...PAGE_RETRY,
    ...poll,
    // The other route tabs show no ranking: it is read (and polled) on Clasament only.
    ...(unsupported || !onClasament ? { enabled: false } : {}),
  });
  const { data: activeWeighing } = useQuery({
    ...activeWeighingQuery(t, id, session),
    ...PAGE_RETRY,
    ...poll,
  });
  const isDesktop = breakpoint !== 'mobile';
  // The server prefetched it (page body): the stat row is painted with it, before hydration.
  const weighingStatsQ = useQuery({
    ...competitionWeighingStatisticsQuery(t, id, status, {
      enabled: !unsupported && onClasament && (view === 'statistici' || (isDesktop && rankingVisible)),
    }),
    ...PAGE_RETRY,
  });
  // Poll the weighing statistics too (the «Cântar în curs» / «Ultimul cântar» tile).
  useEffect(() => {
    if (!live || unsupported || !onClasament) return;
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible')
        void qc.invalidateQueries({
          queryKey: competitionKeys.weighingStatistics(id),
        });
    }, LIVE_POLL_MS);
    return () => clearInterval(tick);
  }, [live, unsupported, onClasament, id, qc]);
  // The author / a referee: their menu and «Acțiuni» rows depend on who is seated (fish
  // areSomeParticipantsAllocated), on every tab.
  const role = isAuthenticated ? roleOf(statute?.userRole) : null;
  // Owner rule 4: the role is unknown until the statute has answered (signed out: known, nobody).
  // Nothing that depends on it (the organizer slot, a referee's scale, everyone else's «Penalizări»)
  // is drawn on a guess: pending → a bone in the header's organizer slot; failed → its recheck.
  const roleKnown = viewer === null || (isAuthenticated && statute !== undefined);
  const roleFailed = isAuthenticated && statuteQ.isError && !statute;
  const rolePending = isAuthenticated && !roleKnown && !roleFailed;
  const allocatedQ = useQuery({
    ...allocatedParticipantsQuery(t, id),
    ...PAGE_RETRY,
    enabled: (!unsupported && onClasament && (view === 'cantare' || (isDesktop && !!activeWeighing?.length))) || role !== null,
  });

  // fish builds the table from the stand order (default) or the place order (Sortare).
  const table = useMemo(() => buildRankingTable(rankingsQ.data, sortBy), [rankingsQ.data, sortBy]);
  // Desktop: the table sorts itself; its rows are built once, in place order.
  const placeTable = useMemo(() => buildRankingTable(rankingsQ.data, 'position'), [rankingsQ.data]);
  // Feeder legs and the club rankings (nationalChampionship / fipsed) have their own tables
  // (FeederRanking.tsx, NcRanking.tsx), not the shared builders.
  const rankingData = rankingsQ.data;
  const feeder: FeederData | null = useMemo(
    () =>
      rankingData?.metadata.rankingType === 'feederRounds'
        ? {
            rankings: rankingData.rankings as FeederRoundsRanking[],
            roundsCount: rankingData.metadata.roundsCount,
            currentRound: rankingData.metadata.currentRound,
            roundStatus: rankingData.metadata.roundStatus,
          }
        : null,
    [rankingData],
  );
  const nc = rankingData && isNationalChampionshipRankings(rankingData.rankings) ? rankingData.rankings : null;
  const isNcType = isNationalType(rankingData?.metadata.rankingType);
  // fish: the feeder opens on the leg in progress and follows it until the reader picks a tab.
  const [chosenFeederTab, setChosenFeederTab] = useState<FeederTab | null>(null);
  const feederTab: FeederTab =
    chosenFeederTab ??
    (feeder
      ? defaultFeederTab({
          competitionStatus: status,
          currentRound: feeder.currentRound,
          roundStatus: feeder.roundStatus,
        })
      : 'general');
  const [feederHelpOpen, setFeederHelpOpen] = useState(false);
  // fish NationalChampionshipRanking: General or one sector; sorted by position by default.
  const [ncView, setNcView] = useState<NcView>('general');
  const [ncSort, setNcSort] = useState<NcSort>('position');
  const selectNcView = (next: NcView) => {
    setNcView(next);
    setNcSort(s => ncSortFor(next, s));
  };

  // One weight precision for the whole competition (the tiles line up on the comma); the feeder and
  // club tables always print three decimals, so their tiles do too.
  const decimals = useMemo(() => (placeTable ? weightDecimals(placeTable) : rawWeightDecimals(rankingData)), [placeTable, rankingData]);

  /** fish `handleChipPress`: switching view refreshes that view's data (parity clasament.c5). */
  const selectView = (next: RankingViewKey) => {
    // From another route tab (the action bar, the weighing banner): open Clasament on that view.
    if (!onClasament) {
      router.push(viewPath(routes.competition(id), next));
      return;
    }
    if (next !== view) {
      const url = new URL(window.location.href);
      url.pathname = viewPath(routes.competition(id), next);
      // A view's open detail (a weighing, an angler) belongs to that view: it never rides along into
      // another view's URL (nor reopens by itself when the reader comes back).
      for (const param of ['cantar', 'stand', 'pescar']) url.searchParams.delete(param);
      window.history.pushState(null, '', url);
      setAnglerId(null);
    }
    setView(next);
    if (next === 'statistici' || next === 'clasament') {
      void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(id) });
      void qc.invalidateQueries({ queryKey: competitionKeys.rankingBestN(id) });
      void qc.invalidateQueries({
        queryKey: competitionKeys.weighingStatistics(id),
      });
      void qc.invalidateQueries({
        queryKey: competitionKeys.timelineSnapshot(id),
      });
      void qc.invalidateQueries({
        queryKey: competitionKeys.catchThresholdCounts(id),
      });
    } else if (next === 'allFish') {
      // Every sort/filter variant of competitionKeys.catchesInfinite(id, …).
      void qc.invalidateQueries({
        queryKey: [...competitionKeys.all, id, 'catches'],
      });
    } else if (next === 'cantare') {
      void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(id) });
    }
  };

  /**
   * fish handlePressActiveWeighing: a weighing of the banner opens its detail (parity shell.c25) —
   * the Cântare view with `?cantar=&stand=` (the detail's own link, competition-page.cantar-detaliu).
   * WeighingsView reads those params when it mounts: remounted (key) so an open Cântare view reads
   * them too.
   */
  const [weighingsMount, setWeighingsMount] = useState(0);
  const openActiveWeighing = (w: CompetitionActiveWeighing) => {
    const href = routes.competitionWeighing(id, w.weighingDocumentId, w.stand.documentId);
    if (!onClasament) {
      router.push(href);
      return;
    }
    window.history.pushState(null, '', href);
    setAnglerId(null);
    setView('cantare');
    setWeighingsMount(n => n + 1);
    void qc.invalidateQueries({ queryKey: weighingKeys.byCompetitionId(id) });
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
        // Participanți (the stats batch, every id set) and Extra Cântare (fish onRefresh of those tabs).
        competitionProfileKeys.participantStatisticsBatch(id),
        competitionManagementKeys.extraScalesList(id),
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

  /** fish `handleSortChange` + its bar message; the order is shown on the Clasament view. */
  const changeSort = (by: string) => {
    if (nc || isNcType) setNcSort(by as NcSort);
    else setSortBy(by as RankingSort);
    setSortNonce(n => n + 1);
    if (view !== 'clasament') selectView('clasament');
    setBarMessage(
      by === 'stand'
        ? 'Sortarea clasamentului după stand a fost efectuată.'
        : by === 'club'
          ? 'Sortarea clasamentului după club a fost efectuată.'
          : 'Sortarea clasamentului după poziția în clasament a fost efectuată.',
    );
  };

  // Extra-Cântar (fish handleExtraCantarPress): a registered participant of a running competition.
  const toast = useSiteToast();
  const extraAllowed = isAuthenticated && !!competition && canRequestExtraScale(competition);
  const extraScalesQ = useQuery({
    ...extraScalesListQuery(t, id),
    ...PAGE_RETRY,
    enabled: extraAllowed,
  });
  const extraRequested = hasRequestedExtraScale(extraScalesQ.data, viewer?.documentId);
  const requestExtra = useMutation(requestExtraScaleMutation(t, qc));
  const deleteExtra = useMutation(deleteExtraScaleRequestMutation(t, qc));
  const [extraAsk, setExtraAsk] = useState(false);
  const extraLoading = requestExtra.isPending ? 'Se înregistrează cererea...' : deleteExtra.isPending ? 'Se șterge cererea...' : null;
  const [actionsOpen, setActionsOpen] = useState(false);
  // competition-page.organizare: the author's menu, its questions, writes and dialogs (organizer/).
  const org = useOrganizer({ t, competition, role, allocated: allocatedQ.data });
  /** `fromSheet`: the «Acțiuni» sheet's item (fish ExtraScaleRequestSheetItem) — no question, closes the sheet on success. */
  const runExtra = (fromSheet = false) => {
    setExtraAsk(false);
    const settle = () =>
      void qc.invalidateQueries({
        queryKey: competitionManagementKeys.extraScalesList(id),
      });
    const onError = (err: Error) => toast(err.message, 'danger');
    if (extraRequested) {
      deleteExtra.mutate(id, {
        onSuccess: () => {
          toast('Cererea a fost ștearsă cu succes', 'success');
          if (fromSheet) setActionsOpen(false);
          else setBarMessage('Cererea de extra cântar a fost anulată.');
        },
        onError,
        onSettled: settle,
      });
    } else {
      requestExtra.mutate(id, {
        onSuccess: () => {
          toast('Cererea a fost trimisă cu succes', 'success');
          if (fromSheet) setActionsOpen(false);
          else setBarMessage('Cererea de extra cântar a fost trimisă.');
        },
        onError,
        onSettled: settle,
      });
    }
  };
  const extraQuestion = extraRequested
    ? 'Ești sigur că vrei să anulezi cererea de extra cântar?'
    : 'Ești sigur că vrei să trimiți cererea de extra cântar?';
  const barConfirm: BarConfirm | null = extraAsk
    ? {
        question: extraQuestion,
        onConfirm: () => runExtra(),
        onCancel: () => setExtraAsk(false),
      }
    : null;

  // The angler stats (parity competition-page.statistici-pescar): a ranking row pressed opens who is
  // on that stand; `?pescar=<registration>` in the URL while open (replaced in place, removed on
  // close), so the view can be linked and survives a reload. Keys: «s:<stand id>» from the kit
  // rows, «r:<registration>» from the feeder rows (an entrant changes stand every leg).
  const [anglerId, setAnglerId] = useState<string | null>(null);
  // Opened by `?pescar=` on arrival (an overlay from 1280), not by a row press.
  const [anglerFromLink, setAnglerFromLink] = useState(false);
  const writeAngler = (registrationId: string | null) => {
    setAnglerFromLink(false);
    const url = new URL(window.location.href);
    if (registrationId) url.searchParams.set('pescar', registrationId);
    else url.searchParams.delete('pescar');
    window.history.replaceState(window.history.state, '', url);
    setAnglerId(registrationId);
  };
  const registrations = competition?.registrations;
  const openAngler = (key: string) => {
    if (!registrations) return;
    const id = key.slice(2);
    const registration = key.startsWith('r:')
      ? registrations.find(r => r.documentId === id)
      : (getRegistrationByStandId(
          registrations.filter(r => r.registrationStatus === 'registered'),
          id,
        ) ?? getRegistrationByStandId(registrations, id));
    if (registration) writeAngler(registration.documentId);
  };
  const anglerRegistration = anglerId ? (registrations?.find(r => r.documentId === anglerId) ?? null) : null;
  const hasRegistrations = !!registrations;
  useEffect(() => {
    if (!hasRegistrations) return;
    const linked = new URLSearchParams(window.location.search).get('pescar');
    // Arrival only: a registration this competition has (after hydration).
    if (linked) {
      const open = setTimeout(() => {
        setAnglerFromLink(true);
        setAnglerId(linked);
      }, 0);
      return () => clearTimeout(open);
    }
  }, [hasRegistrations]);
  const feederSection = useRef<HTMLElement>(null);
  useRowPress<HTMLElement>(
    feederSection,
    '[data-registration]',
    row => (row.dataset.registration ? `r:${row.dataset.registration}` : null),
    key => openAngler(key),
  );

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
              <QueryRetry
                fetching={competitionQ.isFetching}
                failed={offline || competitionQ.isError}
                onRetry={() => void competitionQ.refetch()}
              />
            )
          }
        />
      );
    }
    return <CompetitionSkeleton variant={skeletonVariantOf(statusHint, !!unsupported)} tab={tab} status={statusHint} />;
  }

  const signIn = signInHref(pathname);
  const registered = competition.registrations.filter(r => r.registrationStatus === 'registered').length;
  // fish disabledInscrieTe / NormalUserSheetItems (core) for every viewer: a full competition or a
  // passed deadline is closed for a guest too (only an open one sends a guest to sign in).
  const registration = registrationAction(competition, viewer?.documentId ?? null, new Date());
  // fish handleInscrieTe (competition-page.bara-actiuni.c4): the form, or the team disclaimer first
  // for a NEW team registration (core registrationAction.target).
  const registrationHref =
    registration.target === 'teamDisclaimer' ? routes.competitionTeamDisclaimer(id) : routes.competitionRegister(id);
  const me = myEntry(competition, viewer ?? null);
  const metadata = rankingData?.metadata;
  // Owner rule 20: each view's count is a badge on its tab (only when it is known — rule 4).
  // The Clasament badge counts the rows of the table actually shown: the feeder entrants, the NC
  // clubs (its General table), the standard rows; the registered count while none is known.
  const viewBadges = viewCounts(
    feeder
      ? { count: feeder.rankings.length, unit: competition.competitionType === 'team' ? 'team' : 'angler' }
      : nc
        ? { count: nc.length, unit: 'club' }
        : placeTable
          ? { count: placeTable.rows.length, unit: competition.competitionType === 'team' ? 'team' : 'angler' }
          : rankingsQ.data
            ? { count: registered, unit: competition.competitionType === 'team' ? 'team' : 'angler' }
            : undefined,
    weighingStatsQ.data?.data,
    rankingsQ.data?.metadata.totalCatchesCount,
  );
  // fish Vezi full: off without rows, without numberOfSectors, or on an empty feeder leg.
  const fullViewDisabled = !metadata?.numberOfSectors
    ? true
    : feeder
      ? feeder.rankings.length === 0 || feederLegEmpty(feeder, feederTab)
      : nc
        ? false
        : !table;
  // fish: Sortare offers Stand / Poziția (NC General: Club / Poziția; NC sector: Stand / Poziția); none on a feeder.
  const sortOptions = feeder
    ? null
    : nc || isNcType
      ? ncView === 'general'
        ? [SORT_OPTION.club, SORT_OPTION.position]
        : [SORT_OPTION.stand, SORT_OPTION.position]
      : [SORT_OPTION.stand, SORT_OPTION.position];
  const ncSectorName = ncView === 'general' ? null : (competition.sectors.find(s => s.documentId === ncView)?.name ?? null);
  const fullSubtitle = feeder
    ? feederTab === 'general'
      ? 'Clasament general'
      : `Manșa ${feederTab}`
    : nc
      ? ncSectorName
        ? `Sector ${ncSectorName}`
        : 'Clasament pe cluburi'
      : 'Clasament complet';
  // The bar's tiles (ActionBar.tsx): Înscrie-te before the start, the ranking tiles once there is a
  // ranking the web can show, Chat when signed in. Share is always the header's chip.
  // The other route tabs once it has started: fish's «Acțiuni» (a guest's sheet offers sign-in).
  const actionsTile = !onClasament && (status === 'started' || status === 'completed');
  // fish RankingActionBar «Organizare»: the author, before the start and while it runs (organizare c1).
  const organizerMenu = org.menu.length > 0 ? { options: org.menu, onChoose: (o: (typeof org.menu)[number]) => org.choose(o, 'bar') } : undefined;
  // A referee's «Adaugă cântar» (organizare c11) and everyone else's «Penalizări» (bara-actiuni c10).
  const refereeScaleHref = roleKnown && refereeScaleTile(role, status) ? routes.competitionScale(id) : undefined;
  const penaltiesHref = roleKnown && penaltiesTile(role, competition.rankingType, status) ? routes.competitionPenalties(id) : undefined;
  // The «Acțiuni» rows of the author / a referee wait for the seating (fish isLoading).
  const seatingKnown = allocatedQ.data !== undefined || allocatedQ.isError;
  const managerItems =
    role === null || !seatingKnown
      ? null
      : role === 'author'
        ? organizerSheetItems({ competition, allocated: allocatedQ.data, registrationHref, now: new Date() })
        : refereeSheetItems(competition, allocatedQ.data);
  // organizer.b.active-weighing-banner (a web deviation from fish, awaiting the owner — see
  // organizer/ActiveWeighingBanner.tsx): the author / a referee of a running competition opens the
  // weighing on the scale; everyone else its read-only detail (shell.c25).
  const managesWeighings = canWeigh(role, status);
  // From 768 the Clasament bento's «Cântar în curs» tile carries the manager's «Deschide în cântar»
  // (DesktopStats draws it once the ranking has a catch); elsewhere the compact notice says it.
  const bentoShowsWeighing = onClasament && rankingVisible && !unsupported && (rankingsQ.data?.metadata?.totalCatchesCount ?? 0) > 0;
  // The organizer slot could hold something (the menu, a referee's scale, «Penalizări»).
  const organizerSlotPossible = status === 'notStarted' || status === 'started' || status === 'completed';
  const followable = status === 'started' || status === 'notStarted';
  const onBannerWeighing = (w: CompetitionActiveWeighing) => {
    const href = managesWeighings ? scaleHrefOf(id, w) : null;
    if (href) router.push(href);
    else openActiveWeighing(w);
  };
  const barHasActions =
    status === 'notStarted' ||
    actionsTile ||
    ((status === 'started' || status === 'completed') && !unsupported && onClasament) ||
    isAuthenticated ||
    hasBanner(activeWeighing);

  return (
    // fish: every tab on the white screen (§4b.25).
    <DetailPage phoneGround="surface">
      {/* The header band, then the route tabs in a band of their own: they stick under the top bar
          (parity shell.c19), so a reader at row 20 changes tab without scrolling up. */}
      <DetailBand hairline={false} className={ORGANIZER_MENU_OPEN}>
        <CompetitionHeader
          competition={competition}
          viewer={viewer}
          statute={statute}
          statutePending={isAuthenticated && ((statuteQ.isPending && statuteQ.fetchStatus !== 'paused') || overlayPending)}
          overlayFailed={overlayFailed}
          onRecheckOverlay={recheckOverlay}
          datesProse={dates.prose}
          signIn={signIn}
          registration={registration}
          registrationHref={registrationHref}
          extraAction={
            extraAllowed ? (
              // Busy, not native-disabled: focus comes back here from the dialog's «Confirmă» and
              // must stay on the button (a disabled one drops it on <body>); presses are ignored.
              <>
                <Button
                  variant="secondary"
                  icon={extraRequested ? <XCircleIcon /> : <PlusCircleIcon />}
                  onClick={() => {
                    if (!extraLoading) setExtraAsk(true);
                  }}
                  aria-disabled={extraLoading ? true : undefined}
                  aria-busy={extraLoading ? true : undefined}
                  className={extraLoading ? 'cursor-progress opacity-50' : undefined}
                >
                  {extraLoading ?? (extraRequested ? 'Anulează extra-cântar' : 'Extra-cântar')}
                </Button>
                <span role="status" className="sr-only">
                  {extraLoading ?? ''}
                </span>
              </>
            ) : null
          }
          // From 768, signed in: the chat is a header link to the chat page (participant.b.chat-entry);
          // the header holds its place while the session resolves (CompetitionHeader `chat`).
          chat={() => <ChatHeaderButton competitionId={id} badge={chatBadge} />}
          organizerAction={
            // From 768: the author's «Organizare» menu, a referee's «Adaugă cântar», the others'
            // «Penalizări» (the phone has them in the bar).
            rolePending && organizerSlotPossible ? (
              // The role is not known yet: the slot's shape, never a guessed button (owner rule 4).
              <span aria-hidden data-testid="organizer-slot-bone" className="block h-12 w-40 shrink-0 animate-shimmer rounded-control xl:h-10" />
            ) : roleFailed && organizerSlotPossible && !followable ? (
              // The statute could not be read: its recheck (the follow button offers it when shown).
              <QueryRetry fetching={statuteQ.isFetching} failed={statuteQ.isError} onRetry={() => void statuteQ.refetch()} label="Verifică din nou" />
            ) : org.menu.length > 0 || refereeScaleHref || penaltiesHref ? (
              <>
                {org.menu.length > 0 ? <OrganizerMenu options={org.menu} onChoose={o => org.choose(o, 'menu')} /> : null}
                {refereeScaleHref ? (
                  <ButtonLink variant="secondary" icon={<ScaleIcon />} href={refereeScaleHref}>
                    Adaugă cântar
                  </ButtonLink>
                ) : null}
                {penaltiesHref ? (
                  // The visible «Penalizări» is the name (WCAG 2.5.3 Label in Name).
                  <ButtonLink variant="secondary" icon={<ExclamationTriangleIcon />} href={penaltiesHref}>
                    Penalizări
                  </ButtonLink>
                ) : null}
              </>
            ) : null
          }
        />
      </DetailBand>
      {/* parity shell.c19: the route tabs pin (phone: with the T3 mini title row, following the bar). */}
      <CompetitionStickyTabs competition={competition}>
        {/* fish ROUTES_LIST: each tab its own page (tabs.ts); the mark: its links log the tab event (analytics.ts). */}
        {/* Phone: fish's tabs carry no counts (§4b.25); the count pill stays from 768. */}
        <div {...{ [TABS_MARK]: '' }} className="contents max-md:[&_a>span+span]:hidden">
          <DetailTabs
            label="Secțiunile concursului"
            tabs={COMPETITION_TABS.map(t => ({
              label: t.label,
              href: t.href(id),
              current: t.key === tab,
              count: t.key === 'participanti' ? registered : undefined,
            }))}
          />
        </div>
      </CompetitionStickyTabs>
      {/* From 768 the author / a referee of a running competition: the weighings in progress, each
          opening on the scale (the phone has the banner over the bar). */}
      {managesWeighings && !bentoShowsWeighing ? (
        <ManagerWeighingNotice competitionId={id} weighings={activeWeighing} isNc={isNationalType(competition.rankingType)} />
      ) : null}

      {tab !== 'clasament' ? (
        <TabBody
          tab={tab}
          t={t}
          competition={competition}
          viewer={viewer}
          statute={statute}
          signIn={signInHref(pathname)}
          appHref={appLink(id)}
        />
      ) : rankingVisible ? (
        // No side columns: the ranking table takes the whole column at every width (ROADMAP §4,
        // e2e full-width.spec); the summary tiles are the strip over the views (DesktopStats).
        <DetailBody>
          {unsupported ? (
            // A ranking type newer than this build (core cannot parse it): the T3 in-body state, with
            // the way to see it (the app). Feeder legs and the club rankings have their own tables.
            // No ranking type at all (load.ts classifyLoose): no ranking area, as fish.
            unsupported.rankingType ? (
              <DetailSection tone="plain">
                <AppOnlyState id={id} title="Clasamentul acestui tip de concurs nu este încă disponibil pe web." />
              </DetailSection>
            ) : null
          ) : (
            <>
              {/* From 768: the summary strip over the views (the phone has them in Statistici). It
                  stays on every view, so the view switcher under it never moves when the view
                  changes (the Statistici bento starts after the facts the strip shows); a strip
                  with nothing to draw takes no room (empty:hidden, no gap of the flex column). */}
              <div className="empty:hidden max-md:hidden">
                <DesktopStats
                  metadata={rankingsQ.data?.metadata}
                  rankings={table?.rows}
                  feederRows={feeder?.rankings}
                  ncClubs={nc ?? undefined}
                  competition={competition}
                  activeWeighing={activeWeighing}
                  weighings={weighingStatsQ.data?.data}
                  weighingsLoading={weighingStatsQ.isPending && weighingStatsQ.fetchStatus !== 'idle'}
                  weighingsError={(weighingStatsQ.isError || weighingStatsQ.fetchStatus === 'paused') && !weighingStatsQ.data}
                  reserveWeighing={status === 'started' || status === 'completed'}
                  decimals={decimals}
                  rankingPending={rankingsQ.isPending && rankingsQ.fetchStatus !== 'idle'}
                  rankingFailed={(rankingsQ.isError || rankingsQ.fetchStatus === 'paused') && !rankingsQ.data}
                  rankingRetrying={rankingsQ.isFetching}
                  onRetryRanking={() => void rankingsQ.refetch()}
                  onRetryWeighings={() => void weighingStatsQ.refetch()}
                  allocated={allocatedQ.data}
                  onAllWeighings={() => selectView('cantare')}
                  scaleHrefOf={managesWeighings ? w => scaleHrefOf(id, w) : undefined}
                />
              </div>
              <DetailSection tone="plain" className="flex flex-col gap-4 max-md:pt-2">
                <ViewChips value={view} onChange={selectView} badges={viewBadges} />
                {/* One «a weighing is in progress» rule with the strip's weighing tile (weighingTileTone): the
                    per-user active read, else the public statistics' open session — signed out too. */}
                <ViewTabs value={view} onChange={selectView} badges={viewBadges} live={status === 'started' && weighingTileTone(activeWeighing, weighingStatsQ.data?.data, status) === 'rose'} />

                {/* From 1280 the angler stats dock beside the view (ContextSurface). */}
                <div className="flex items-start gap-6">
                  <div className="min-w-0 flex-1">
                    <ViewPanel value={view}>
                      {view === 'clasament' && (
                        <RankingView
                          custom={
                            feeder ? (
                              // The controls are the ranking card's band (as the standard ranking's
                              // toolbar); from 1280 «Cum se calculează» docks beside the card.
                              <section ref={feederSection} aria-label="Clasament" className={cn('flex items-start gap-4', PRESSABLE_ROWS)}>
                                {/* Below 768: fish's own tabs and table (FishFeeder). */}
                                <div className="min-w-0 flex-1 md:hidden">
                                  <FishFeederLegTabs data={feeder} value={feederTab} onChange={setChosenFeederTab} onHelp={() => setFeederHelpOpen(true)} />
                                  <FishFeederTable
                                    data={feeder}
                                    tab={feederTab}
                                    isTeam={competition.competitionType === 'team'}
                                    caption={feederTab === 'general' ? 'Clasament general' : `Clasament manșa ${feederTab}`}
                                  />
                                </div>
                                <div className="min-w-0 flex-1 max-md:hidden">
                                  <FeederRankingTable
                                    data={feeder}
                                    tab={feederTab}
                                    isTeam={competition.competitionType === 'team'}
                                    caption={feederTab === 'general' ? 'Clasament general' : `Clasament manșa ${feederTab}`}
                                    me={me}
                                    toolbar={
                                      <>
                                        {/* The chips and their «?» together at the left; «Clasament complet» at the far end. */}
                                        <div className="min-w-0 flex-1">
                                          <FeederLegTabs
                                            data={feeder}
                                            value={feederTab}
                                            onChange={setChosenFeederTab}
                                            onHelp={() => setFeederHelpOpen(true)}
                                          />
                                        </div>
                                        <FullViewButtons onPress={() => setFullOpen(true)} disabled={fullViewDisabled} />
                                      </>
                                    }
                                  />
                                </div>
                                <FeederHelp
                                  open={feederHelpOpen}
                                  onClose={() => setFeederHelpOpen(false)}
                                  competitionStatus={status ?? ''}
                                  data={feeder}
                                  panelClassName={cn('sticky shrink-0 self-start rounded-card', COLUMN_STICKY_TOP_BELOW_TABS)}
                                />
                              </section>
                            ) : nc && nc.length > 0 ? (
                              <section aria-label="Clasament">
                                {/* Below 768: fish's own pills and tables (FishNc). */}
                                <div className="md:hidden">
                                  <FishNcPills sectors={competition.sectors} value={ncView} onChange={selectNcView} />
                                  <FishNcTable
                                    rankings={nc}
                                    numberOfSectors={metadata?.numberOfSectors}
                                    view={ncView}
                                    sort={ncSort}
                                    caption={ncSectorName ? `Clasament sector ${ncSectorName}` : 'Clasament pe cluburi'}
                                  />
                                </div>
                                <div className="max-md:hidden">
                                  <NcRankingTable
                                  rankings={nc}
                                  numberOfSectors={metadata?.numberOfSectors}
                                  view={ncView}
                                  sort={ncSort}
                                  caption={ncSectorName ? `Clasament sector ${ncSectorName}` : 'Clasament pe cluburi'}
                                  currentUserStandId={me.standId}
                                  toolbar={
                                    <>
                                      {/* The pills scroll inside their own box (fading at its edge), never under Ordine. */}
                                      <div className="-ml-1 min-w-0 flex-1 overflow-hidden pl-1 [mask-image:linear-gradient(to_left,transparent,black_--spacing(6))]">
                                        <NcSectorPills sectors={competition.sectors} value={ncView} onChange={selectNcView} />
                                      </div>
                                      {/* From 768 the order is chosen here (the phone has «Sortare» in the bar). */}
                                      <div className="shrink-0 max-md:hidden">
                                        <NcSortControl view={ncView} value={ncSort} onChange={setNcSort} />
                                      </div>
                                      <FullViewButtons onPress={() => setFullOpen(true)} disabled={fullViewDisabled} />
                                    </>
                                  }
                                />
                                </div>
                              </section>
                            ) : (
                              // fish: no NC data → «Nu există date de afișat».
                              <EmptyState title="Nu există date de afișat" />
                            )
                          }
                          query={rankingsQ}
                          table={table}
                          sortNonce={sortNonce}
                          placeTable={placeTable}
                          currentUserStandId={me.standId}
                          rankingType={competition.rankingType}
                          onFullView={() => setFullOpen(true)}
                          onRowPress={standId => openAngler(`s:${standId}`)}
                        />
                      )}
                      {view === 'statistici' &&
                        (viewer === null ? (
                          <>
                            {/* Phone (§4b.25): fish's two lines — the sentence, then the teal «Intră în cont». */}
                            <div className="flex flex-col items-center gap-3 px-4 pt-6 text-center md:hidden">
                              <p className="t-body text-ink-2">Trebuie să fii autentificat pentru a vedea statisticile.</p>
                              <Link href={signIn} className="t-body text-fish-link hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent">
                                Intră în cont
                              </Link>
                            </div>
                            <div className="max-md:hidden">
                              <SignInGate
                                title="Statisticile concursului"
                                description="Trebuie să fii autentificat pentru a vedea statisticile."
                                icon={<LockClosedIcon />}
                                href={signIn}
                                headingLevel={3}
                              />
                            </div>
                          </>
                        ) : viewer ? (
                          <StatisticsView
                            t={t}
                            competition={competition}
                            rankingsQ={rankingsQ}
                            rankingRows={table?.rows}
                            entrants={entrantCounts(table?.rows, feeder?.rankings, nc ?? undefined)}
                            weighingTone={weighingTileTone(activeWeighing, weighingStatsQ.data?.data, status)}
                            weighingStats={weighingStatsQ}
                            decimals={decimals}
                            canRevoke={statute?.userRole === 'author' || statute?.userRole === 'referee'}
                          />
                        ) : sessionUnknown ? (
                          // The session could not be read: say so and offer to check again (never a
                          // skeleton that never resolves).
                          <ErrorState
                            title="Nu am putut verifica sesiunea."
                            description="Statisticile sunt pentru utilizatorii autentificați."
                            action={<RefreshRetry />}
                          />
                        ) : (
                          // The session is not known yet: the view's shape, not an empty panel.
                          <StatisticsSkeleton />
                        ))}
                      {view === 'cantare' && (
                        <WeighingsView
                          key={weighingsMount}
                          t={t}
                          competition={competition}
                          allocated={allocatedQ}
                          // Tri-state: until the session is known the view neither claims «signed out»
                          // (its note) nor draws cards without their counts line.
                          session={viewer ? 'in' : viewer === null || sessionUnknown ? 'out' : 'pending'}
                          decimals={decimals}
                          scaleStandHref={managesWeighings ? standId => routes.competitionScaleStand(id, standId) : undefined}
                        />
                      )}
                      {view === 'allFish' && <AllFishView t={t} competition={competition} decimals={decimals} />}
                    </ViewPanel>
                  </div>
                  <AnglerStats
                    key={anglerRegistration?.documentId ?? 'none'}
                    t={t}
                    competition={competition}
                    registration={view === 'clasament' ? anglerRegistration : null}
                    isAuthenticated={isAuthenticated}
                    signIn={signIn}
                    decimals={decimals}
                    fromLink={anglerFromLink}
                    onClose={() => writeAngler(null)}
                  />
                </div>
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
          // fish ActionButton: on the other tabs only the floating «Acțiuni» button — no white bar.
          // fish RankingActionBar: white, no top border or shadow, 4px over the tiles.
          className={
            actionsTile
              ? FLOATING_ACTIONS_BAR
              : '[&>div:last-child]:min-h-16 [&>div:last-child]:border-t-0 [&>div:last-child]:shadow-none [&>div:last-child]:pt-1 [&>div:last-child]:pb-[max(--spacing(1),env(safe-area-inset-bottom))]'
          }
          above={
            hasBanner(activeWeighing) ? (
              <ActiveWeighingBanner
                weighings={activeWeighing}
                isNc={isNationalType(competition.rankingType)}
                onPress={onBannerWeighing}
              />
            ) : undefined
          }
        >
          <MobileActionBar
            competition={competition}
            viewer={viewer}
            signIn={signIn}
            sortOptions={sortOptions}
            onSort={changeSort}
            onView={selectView}
            onFullView={() => setFullOpen(true)}
            fullViewDisabled={fullViewDisabled}
            registration={registration}
            registrationHref={registrationHref}
            extraScale={
              extraAllowed
                ? {
                    requested: extraRequested,
                    onPress: () => setExtraAsk(true),
                  }
                : null
            }
            confirm={barConfirm ?? org.barConfirm}
            loadingLabel={extraLoading}
            chat={isAuthenticated ? { href: chatHref, onOpen: () => markChatFromCompetition(id) } : undefined}
            chatBadge={chatBadge}
            rankingAvailable={!unsupported && onClasament}
            barMessage={barMessage}
            onBarMessageDismiss={() => setBarMessage(null)}
            onActions={actionsTile ? () => setActionsOpen(true) : undefined}
            organizer={organizerMenu}
            refereeScaleHref={onClasament ? refereeScaleHref : undefined}
            penaltiesHref={onClasament ? penaltiesHref : undefined}
            share={{ title: competition.name, text: shareText(competition), onCopied: () => toast('Linkul competiției a fost copiat.', 'success') }}
          />
        </DetailActionBar>
      ) : null}
      {org.dialogs}
      {actionsTile ? (
        <ActionsSheet
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          viewer={viewer}
          statute={statute}
          statutePending={isAuthenticated && ((statuteQ.isPending && statuteQ.fetchStatus !== 'paused') || overlayPending)}
          competitionStatus={status ?? ''}
          registration={registration}
          registrationHref={registrationHref}
          signIn={signIn}
          weighingsHref={routes.competitionScale(id)}
          managerItems={managerItems}
          onManagerAction={item => org.choose(item, 'sheet')}
          extraScale={
            extraAllowed
              ? {
                  requested: extraRequested,
                  pendingLabel: extraLoading,
                  onPress: () => runExtra(true),
                }
              : null
          }
        />
      ) : null}

      <FullRankingDialog
        open={fullOpen}
        onClose={() => setFullOpen(false)}
        title={competition.name}
        subtitle={fullSubtitle}
        table={placeTable}
        initialSort={sortBy === 'position' ? 'place' : 'stand'}
        imageHref={
          fullViewDisabled
            ? undefined
            : routes.competitionRankingImage(
                id,
                imageQueryString(
                  imageQueryFor({ rankingType: metadata?.rankingType, sortBy, feederTab, ncSectorName, ncSort }),
                ),
              )
        }
        onImage={() => trackRankingImage('ranking_image_pressed', { id, name: competition.name })}
      >
        {feeder ? (
          <FeederRankingTable
            data={feeder}
            tab={feederTab}
            isTeam={competition.competitionType === 'team'}
            caption={`${fullSubtitle} complet`}
            me={me}
            full
          />
        ) : nc ? (
          <NcRankingTable
            rankings={nc}
            numberOfSectors={metadata?.numberOfSectors}
            view={ncView}
            sort={ncSort}
            caption={`${fullSubtitle} complet`}
            currentUserStandId={me.standId}
            full
          />
        ) : null}
      </FullRankingDialog>
      {/* From 768 the Extra-Cântar question is a dialog (the phone asks in the bar). */}
      {isDesktop ? (
        <Dialog
          open={extraAsk}
          onClose={() => setExtraAsk(false)}
          title="Extra cântar"
          description={extraQuestion}
          alert
          actions={
            <>
              <Button variant="secondary" onClick={() => setExtraAsk(false)}>
                Anulează
              </Button>
              <Button onClick={() => runExtra()}>Confirmă</Button>
            </>
          }
        />
      ) : null}
    </DetailPage>
  );
}

const hasBanner = (w: { stand: unknown }[] | undefined) => !!w?.length && !!w[0]?.stand;

/**
 * A ranking the web cannot draw yet (feeder legs, club rankings): the T3 in-body state
 * (DetailSectionState, the 720 state frame centred in the column) — what is missing and the way to
 * see it, the competition in the Bluvi app.
 */
function AppOnlyState({ id, title }: { id: string; title: string }) {
  return (
    <DetailSectionState
      heading={title}
      description="Îl poți urmări în aplicația Bluvi."
      action={<ButtonLink href={appLink(id)}>Deschide în aplicație</ButtonLink>}
    />
  );
}

/**
 * The signed-in angler's entry: their stand (ranking `standId` is the stand's numeric id) and their
 * registration (feeder rows carry it: a feeder entrant changes stand every leg).
 */
function myEntry(
  competition: {
    registrations: {
      documentId: string;
      registrationStatus: string;
      stand: { id: number } | null;
      participants: { documentId: string }[];
    }[];
  },
  viewer: Viewer | null,
): { standId: string | null; registrationId: string | null } {
  if (!viewer) return { standId: null, registrationId: null };
  const mine = competition.registrations.find(
    r => r.registrationStatus === 'registered' && r.participants.some(p => p.documentId === viewer.documentId),
  );
  return {
    standId: mine?.stand ? String(mine.stand.id) : null,
    registrationId: mine?.documentId ?? null,
  };
}

/**
 * The view tabs' count badges: the rows of the Clasament table shown (anglers, teams or clubs),
 * weighings (in progress included; the live dot says one is running), catches. A count still being
 * read, or failed, has no badge (rule 4).
 */
type RowCount = { count: number; unit: 'angler' | 'team' | 'club' };
const ROW_UNITS: Record<RowCount['unit'], [string, string]> = {
  angler: ['pescar', 'pescari'],
  team: ['echipă', 'echipe'],
  club: ['club', 'cluburi'],
};
function viewCounts(
  rows: RowCount | undefined,
  weighings: unknown[] | undefined,
  catches: number | undefined,
): Partial<Record<RankingViewKey, ViewBadge>> {
  const badges: Partial<Record<RankingViewKey, ViewBadge>> = {};
  if (rows && rows.count > 0) badges.clasament = { value: String(rows.count), label: plural(rows.count, ...ROW_UNITS[rows.unit]) };
  if (weighings && weighings.length > 0) badges.cantare = { value: String(weighings.length), label: plural(weighings.length, 'cântar', 'cântare') };
  if (typeof catches === 'number' && catches > 0) badges.allFish = { value: String(catches), label: plural(catches, 'captură', 'capturi') };
  return badges;
}
