'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ownedLakesQuery } from '@/core/booking';
import { lakeOperatorStatsQuery, type LakeOperatorStats, type OperatorStatsWindowName } from '@/core/lakes';
import { isApiError } from '@/core/transport';
import { BookingDetailDialog, useBookingDetailParam } from '@/components/operator';
import { useOperatorBookingActions } from '@/components/operator/actions/useOperatorBookingActions';
import { DashboardLayout, DashboardRefresh, type RefreshResult } from '@/components/templates/T5';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../_shell/Toast';
import { panelBack } from '../../_shared/back';
import { OperatorErrorState } from '../../_shared/OperatorErrorState';
import { PanelSpinner } from './PanelSpinner';
import { OperatorFrame, OperatorTitleSkeleton, operatorTrail } from '../../_shared/OperatorFrame';
import { useOwnedLakeName } from '../../_shared/useOwnedLakeName';
import { useOperatorTransport } from '../../_shared/useOperatorTransport';
import { AttentionCard } from './AttentionCard';
import { LakeTrendCard } from './LakeTrendCard';
import { cashFigure, occupancyFigure, PANEL_TITLE, panelLinks, panelView, todayCaption, type TrendMetric } from './model';
import { PendingAlert } from './PendingAlert';
import { QuickActions } from './QuickActions';
import { StatTiles } from './StatTiles';
import { TodayCard } from './TodayCard';

const REFRESH_FAILED = 'Nu s-a putut actualiza. Cifrele de pe ecran sunt cele de dinainte.';

/*
 * The panel's clock: device-local (operator.b.local-day), read only in the browser — the server
 * renders no «Azi, …» (its zone is not the operator's) — and moving on its own every 30 s, so the
 * phases, the live bars and «Azi» follow the wall clock on a panel left open (fish reads Date.now()
 * at every render). Snapped to the minute, so the snapshot is stable between ticks.
 */
const TICK_MS = 30_000;
const subscribeClock = (onChange: () => void) => {
  const id = setInterval(onChange, TICK_MS);
  return () => clearInterval(id);
};
const readClock = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverClock = () => null;
export const usePanelClock = () => useSyncExternalStore(subscribeClock, readClock, serverClock);

/**
 * /operator/[lakeId] — operator.panou «Panoul bălții» (T5). fish app/(app)/operator/[lakeId]/index.tsx.
 * Rendered for a signed-in viewer only (page.tsx OperatorGate). Per owner, never cached: GET
 * /feed/lakes/{id}/operator-stats?window= through /api/cms in the browser (lakes.lakeOperatorStatsQuery,
 * previous data as placeholder), the name from the shared owned-lakes read.
 *
 *  c1 header: back, the lake's name («Balta» when it is not in the list), «Azi, vineri 9 oct».
 *  c2 the window («week» first) is the query's only parameter.
 *  c3 first load: header + spinner, no quick actions. c4 error with nothing on screen → the shared
 *  error state; a failed refetch keeps the figures (a toast says it once).
 *  c5 / b.refresh: «Reîmprospătează» refetches the current window; the query also refetches whenever
 *  the window regains focus; no polling.
 *  c31 phone/tablet order: quick actions (sticky, attached to the top edge) · pending alert · Azi la
 *  baltă · drop-outs/reviews · the two tiles · trend. From 1280 (ROADMAP §4, three columns): left —
 *  the lake's shortcuts and the requests owed an answer; centre — today, what changed and the trend
 *  (the one card that gains from width; from a ~900px centre, i.e. 1920, today beside drop-outs +
 *  trend, so the page is used edge to edge, not one wide card with empty rows); right — the two
 *  figures, one above the other, so their labels read on one line in the 320–360 rail.
 */
export function PanelScreen({ lakeId }: { lakeId: string }) {
  const t = useOperatorTransport();
  const toast = useSiteToast();
  const now = usePanelClock();
  const lakeName = useOwnedLakeName(lakeId);
  const owned = useQuery(ownedLakesQuery(t));

  // c2 / c26: the trend window drives the query; every figure above the chart is anchored to now.
  const [trendWindow, setTrendWindow] = useState<OperatorStatsWindowName>('week');
  const [metric, setMetric] = useState<TrendMetric>('occupancy');
  const q = useQuery({
    ...lakeOperatorStatsQuery(t, lakeId, trendWindow),
    // b.refresh: a panel coming back to the foreground is re-read at once (no polling, fish).
    refetchOnWindowFocus: 'always',
  });

  // The last window that answered, with its figures: what stays on screen while another window loads
  // (react-query's placeholder) and after it fails (the failed key has no data of its own).
  const fresh = q.data !== undefined && !q.isPlaceholderData ? q.data : undefined;
  const [settled, setSettled] = useState<{ window: OperatorStatsWindowName; data: LakeOperatorStats } | null>(null);
  if (fresh && (settled?.window !== trendWindow || settled.data !== fresh)) setSettled({ window: trendWindow, data: fresh });
  const view = panelView({ fresh, settled, window: trendWindow, isError: q.isError, error: q.error });

  // The body is busy only while a refetch the user asked for runs (never a silent focus refetch).
  const [userRefreshing, setUserRefreshing] = useState(false);
  const { refetch } = q;
  const refresh = useCallback(async (): Promise<RefreshResult> => {
    setUserRefreshing(true);
    try {
      const r = await refetch();
      if (!r.isError) return true;
      // A dead session is the providers' (sign-out + /intra); say nothing more here.
      if (isApiError(r.error) && r.error.code === 'SESSION_DEAD') return 'reported';
      if (r.data === undefined) return false;
      toast(REFRESH_FAILED, 'danger');
      return 'reported';
    } finally {
      setUserRefreshing(false);
    }
  }, [refetch, toast]);

  const { bookingId, open, close } = useBookingDetailParam();
  const actions = useOperatorBookingActions({ lakeId, lakeName });

  const title = lakeName ?? <OperatorTitleSkeleton />;
  const frame = {
    title,
    caption: now != null ? todayCaption(new Date(now)) : <span className="invisible">Azi</span>,
    back: panelBack(owned.data?.length),
    trail: operatorTrail({ label: lakeName ?? PANEL_TITLE }),
  };

  if (view.kind !== 'data') {
    const sessionDead = view.kind === 'error' && isApiError(view.error) && view.error.code === 'SESSION_DEAD';
    return (
      <OperatorFrame {...frame}>
        {view.kind === 'loading' || sessionDead ? (
          <PanelSpinner />
        ) : (
          <OperatorErrorState
            error={view.error}
            onRetry={() => void q.refetch()}
            retrying={q.isFetching}
            attempt={q.errorUpdateCount}
            next={routes.operator(lakeId)}
          />
        )}
      </OperatorFrame>
    );
  }

  const stats = view.data;
  const nowMs = now ?? q.dataUpdatedAt;
  const links = panelLinks(lakeId, stats.pending);
  const occupancy = occupancyFigure(stats);
  const cash = cashFigure(stats, nowMs);
  const name = lakeName ?? PANEL_TITLE;

  const quickBar = <QuickActions lakeId={lakeId} lakeName={name} pending={stats.pending} stands={occupancy.total} layout="bar" />;
  const quickList = <QuickActions lakeId={lakeId} lakeName={name} pending={stats.pending} stands={occupancy.total} layout="list" />;
  const alert = (layout: 'wide' | 'narrow') => <PendingAlert pending={stats.pending} oldest={stats.oldestPending} href={links.answer} layout={layout} />;
  const today = <TodayCard stats={stats} nowMs={nowMs} seeAllHref={links.seeAll} onOpen={open} />;
  const attention = <AttentionCard cancelled={stats.cancelledLast24h ?? 0} toReview={stats.pendingFeedback ?? 0} links={links} />;
  const tiles = (layout: 'pair' | 'stack') => <StatTiles occupancy={occupancy} cash={cash} layout={layout} />;
  // c25: only when the window has points (fish hides the card on an empty window).
  const trend =
    stats.days && stats.days.length > 0 ? (
      <LakeTrendCard
        points={stats.days}
        totals={stats.windowTotals}
        window={view.window}
        selected={view.trendFailed ? view.window : trendWindow}
        onWindowChange={(w) => (w === trendWindow && view.trendFailed ? void q.refetch() : setTrendWindow(w))}
        metric={metric}
        onMetricChange={setMetric}
        busy={q.isFetching && (q.isPlaceholderData || userRefreshing)}
        failed={view.trendFailed ? { retry: () => void q.refetch(), retrying: q.isFetching } : null}
        nowMs={nowMs}
      />
    ) : null;

  return (
    <OperatorFrame {...frame} busy={userRefreshing} trailing={<DashboardRefresh onRefresh={refresh} />}>
      <DashboardLayout
        stacked={
          <>
            {quickBar}
            {alert('wide')}
            {today}
            {attention}
            {tiles('pair')}
            {trend}
          </>
        }
        context={
          <>
            {quickList}
            {alert('narrow')}
          </>
        }
        contextLabel="Scurtături și cereri"
        main={
          // The centre is a size container (DashboardLayout): one column up to 56rem, then today on
          // the left and drop-outs + trend on the right.
          <div className="grid items-start gap-6 @4xl:grid-cols-2">
            {today}
            <div className="flex min-w-0 flex-col gap-6">
              {attention}
              {trend}
            </div>
          </div>
        }
        aside={tiles('stack')}
        asideLabel="Cifrele bălții"
      />
      <BookingDetailDialog lakeId={lakeId} lakeName={lakeName} bookingId={bookingId} onClose={close} actions={actions} />
      {actions.dialogs}
    </OperatorFrame>
  );
}
