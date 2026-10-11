'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { lakeOperatorStatsQuery, type LakeOperatorStats, type OperatorStatsWindowName } from '@/core/lakes';
import { isApiError } from '@/core/transport';
import { DashboardHeader, DashboardPage } from '@/components/templates/T5';
import { createBrowserTransport } from '@/lib/client/transport';
import { SetBreadcrumb } from '../../../../(site)/_shell/SiteHeader';
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
  | 'trend-loading'
  | 'trend-failed'
  | 'detail'
  | null;

/** The simulations drawn on the busy day at the fixed demo time. */
const ON_BUSY_DAY: Simulation[] = ['busy', 'legacy', 'one-pending', 'many-pending', 'trend-loading', 'trend-failed', 'detail'];

/** How often the panel's clock moves on its own (phases, countdowns, the stay bars, «Azi, …»). */
const TICK_MS = 60_000;

/**
 * The panel's «now». A simulated state keeps its fixed demo time (stable screenshots). A real one
 * starts at the server's request time (so the first client render matches the HTML) and then runs:
 * a tick every minute, and the moment of each successful fetch — so after a re-read the phases
 * follow the clock, not the first request.
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
 * No manual refresh control (removed by the owner 2026-10-11): it re-reads on focus and when the
 * day turns, the figures staying on screen while it runs. The error card is only for a first load with
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
  const t = useMemo(() => withTimeout(createBrowserTransport(), CMS_TIMEOUT_MS), []);
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
  // as a first-load 401 does.
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

  const firstBookable = simulate === 'detail' ? (shown.today ?? []).find((b) => b.documentId) ?? null : null;

  return (
    <BookingDetailProvider lakeId={lakeId} initial={firstBookable}>
      {/* The way up, from 768: «Acasă / Administrare / Chita Lake» — the lake is the live title. */}
      <SetBreadcrumb trail={lakeTrail(lakeName)} />
      <DashboardPage
        header={
          <DashboardHeader
            title={lakeName}
            caption={todayCaption(dayTurned ? dataAt : now)}
            back={back}
          />
        }
      >
        <OperatorPanel lakeId={lakeId} lakeName={lakeName} stats={shown} nowMs={now} trend={trend} />
      </DashboardPage>
    </BookingDetailProvider>
  );
}
