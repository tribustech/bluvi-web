'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { lakeOperatorStatsQuery, operatorStatsKeys, type LakeOperatorStats, type OperatorStatsWindowName } from '@/core/lakes';
import { isApiError } from '@/core/transport';
import { DashboardHeader, DashboardPage, DashboardRefresh, type RefreshResult } from '@/components/templates/T5';
import { createBrowserTransport } from '@/lib/client/transport';
import { SetBreadcrumb } from '../../../../(site)/_shell/SiteHeader';
import { useSiteToast } from '../../../../(site)/_shell/Toast';
import { BookingDetailProvider } from './BookingDetail';
import { busyFixture, emptyFixture, legacyFixture, pendingFixture } from './fixtures';
import { dayKey, todayCaption } from './format';
import { OperatorPanel } from './OperatorPanel';
import { lakeTrail } from './links';
import { CMS_TIMEOUT_MS, withTimeout } from './timeout';
import { FixtureTrendCard, LiveTrendCard, type Metric } from './TrendCard';

/** The demo's simulated states (fixtures over the real lake); null = the real data. */
export type Simulation =
  | 'busy'
  | 'legacy'
  | 'empty'
  | 'one-pending'
  | 'many-pending'
  | 'refresh-failed'
  | 'trend-loading'
  | 'trend-failed'
  | 'detail'
  | null;

/** The simulations drawn on the busy day at the fixed demo time. */
const ON_BUSY_DAY: Simulation[] = ['busy', 'legacy', 'one-pending', 'many-pending', 'refresh-failed', 'trend-loading', 'trend-failed', 'detail'];

/** How often the panel's clock moves on its own (phases, countdowns, the stay bars, «Azi, …»). */
const TICK_MS = 60_000;

const REFRESH_FAILED = 'Nu s-a putut actualiza. Cifrele de pe ecran sunt cele de dinainte.';

/**
 * The panel's «now». A simulated state keeps its fixed demo time (stable screenshots). A real one
 * starts at the server's request time (so the first client render matches the HTML) and then runs:
 * a tick every minute, and the moment of each successful fetch — so after «Reîmprospătează» the
 * phases follow the clock, not the first request.
 */
function usePanelClock(start: number, simulated: boolean, dataUpdatedAt: number): number {
  const [tick, setTick] = useState(start);
  useEffect(() => {
    if (simulated) return;
    const id = setInterval(() => setTick(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [simulated]);
  return simulated ? start : Math.max(tick, dataUpdatedAt);
}

function simulatedStats(simulate: Simulation, stats: LakeOperatorStats, now: number): LakeOperatorStats {
  switch (simulate) {
    case 'legacy':
      return legacyFixture(stats, now);
    case 'empty':
      return emptyFixture(stats);
    case 'one-pending':
      return pendingFixture(stats, now, 1);
    case 'many-pending':
      return pendingFixture(stats, now, 120);
    case null:
      return stats;
    default:
      return busyFixture(stats, now);
  }
}

/**
 * The panel on a client query (fish useLakeOperatorStats), hydrated with the server's read.
 * «Reîmprospătează» refetches it in place — and the trend card's window when it shows another one
 * (parity operator.panou.c5) — the figures stay on screen while it runs, and a failed refetch
 * keeps them and says so once (the toast; c4). The error card is only for a first load with
 * nothing to show (page.tsx). A session that died while the page was open re-renders the server
 * page, which shows the sign-in card (as a first-load 401 does).
 *
 * No retries (`retry: false`): each read has the 8 s deadline, and a hanging CMS must land in an
 * error within it — react-query's default 3 attempts with backoff would hold the spinner ~27 s.
 *
 * The trend card sits in both compositions of the layout (DashboardLayout `stacked`): its window
 * and metric live here, so both copies show the same choice whichever side of 1280 is on screen.
 */
export function OperatorDashboard({
  lakeId,
  lakeName,
  initial,
  nowMs,
  fetchedAt,
  simulate,
  back,
}: {
  lakeId: string;
  lakeName: string;
  initial: LakeOperatorStats;
  /** The panel's starting «now»: the request time, or the fixed demo time of a simulated state. */
  nowMs: number;
  /** When the server read `initial` (the real request time, never the demo time): its freshness. */
  fetchedAt: number;
  simulate: Simulation;
  back: { href: string; label?: string };
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useMemo(() => withTimeout(createBrowserTransport(), CMS_TIMEOUT_MS), []);
  const toast = useSiteToast();
  const q = useQuery({
    ...lakeOperatorStatsQuery(t, lakeId, 'week'),
    initialData: initial,
    initialDataUpdatedAt: fetchedAt,
    staleTime: 60_000,
    retry: false,
  });
  const simulated = ON_BUSY_DAY.includes(simulate);
  const now = usePanelClock(nowMs, simulated, q.dataUpdatedAt);
  const [trendWindow, setTrendWindow] = useState<OperatorStatsWindowName>('week');
  const [metric, setMetric] = useState<Metric>('occupancy');

  // Past midnight on an open page: «azi» is a new day, the figures are still yesterday's. Refetch
  // once per clock tick while it fails (keyed to the tick, never to isFetching — a failed fetch
  // leaves the day turned and would otherwise refetch at once, in a loop), and keep the caption on
  // the data's day until it lands. A dead session re-renders the server page (the sign-in card),
  // as «Reîmprospătează» does.
  const dataAt = q.dataUpdatedAt || fetchedAt;
  const dayTurned = !simulated && dayKey(new Date(now)) !== dayKey(new Date(dataAt));
  const { isFetching, refetch } = q;
  const triedAt = useRef(0);
  useEffect(() => {
    if (!dayTurned || isFetching || triedAt.current === now) return;
    triedAt.current = now;
    void refetch().then((r) => {
      if (isApiError(r.error) && r.error.status === 401) router.refresh();
    });
  }, [dayTurned, now, isFetching, refetch, router]);

  // The body is busy only while a refetch the user asked for runs (DashboardPage `busy`), never
  // for a silent background one (window focus, the day turning).
  const [userRefreshing, setUserRefreshing] = useState(false);

  // ?state=refresh-failed: the page as a failed «Reîmprospătează» leaves it — data kept, the toast up.
  const toasted = useRef(false);
  useEffect(() => {
    if (simulate !== 'refresh-failed' || toasted.current) return;
    toasted.current = true;
    toast(REFRESH_FAILED, 'danger');
  }, [simulate, toast]);

  const stats = q.data ?? initial;
  const shown = simulatedStats(simulate, stats, now);
  const total = stats.occupancyNow?.total ?? stats.occupancyByDay.at(-1)?.total ?? 0;
  const view = { window: trendWindow, onWindowChange: setTrendWindow, metric, onMetricChange: setMetric, nowMs: now };
  const trend = simulated ? (
    <FixtureTrendCard
      total={total}
      legacy={simulate === 'legacy'}
      simulate={simulate === 'trend-loading' ? 'loading' : simulate === 'trend-failed' ? 'failed' : undefined}
      {...view}
    />
  ) : simulate === 'empty' ? null : (
    <LiveTrendCard lakeId={lakeId} initial={stats} fetchedAt={fetchedAt} transport={t} {...view} />
  );

  const refresh = async (): Promise<RefreshResult> => {
    setUserRefreshing(true);
    try {
      return await refreshNow();
    } finally {
      setUserRefreshing(false);
    }
  };
  const refreshNow = async (): Promise<RefreshResult> => {
    if (simulated) {
      // Fixtures: nothing to fetch; the failed-refresh state says what a failure looks like.
      if (simulate === 'refresh-failed') {
        toast(REFRESH_FAILED, 'danger');
        return 'reported';
      }
      return true;
    }
    const [r, w] = await Promise.all([
      q.refetch(),
      // The chart's own window, when it is not the panel's week (c5: the stats of the window on screen).
      trendWindow !== 'week'
        ? qc.refetchQueries({ queryKey: operatorStatsKeys.lake(lakeId, trendWindow), exact: true }).then(
            () => qc.getQueryState(operatorStatsKeys.lake(lakeId, trendWindow))?.status !== 'error',
          )
        : Promise.resolve(true),
    ]);
    if (!r.isError && w) return true;
    if (isApiError(r.error) && r.error.status === 401) {
      router.refresh();
      return 'reported';
    }
    toast(REFRESH_FAILED, 'danger');
    return 'reported';
  };

  const firstBookable = simulate === 'detail' ? (shown.today ?? []).find((b) => b.documentId) ?? null : null;

  return (
    <BookingDetailProvider lakeId={lakeId} initial={firstBookable}>
      {/* The way up, from 768: «Acasă / Administrare / Chita Lake» — the lake is the live title. */}
      <SetBreadcrumb trail={lakeTrail(lakeName)} />
      <DashboardPage
        busy={userRefreshing}
        header={
          <DashboardHeader
            title={lakeName}
            caption={todayCaption(dayTurned ? dataAt : now)}
            back={back}
            actions={<DashboardRefresh onRefresh={refresh} />}
          />
        }
      >
        <OperatorPanel lakeId={lakeId} lakeName={lakeName} stats={shown} nowMs={now} trend={trend} />
      </DashboardPage>
    </BookingDetailProvider>
  );
}
