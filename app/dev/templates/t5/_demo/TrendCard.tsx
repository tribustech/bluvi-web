'use client';

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { todayIndex, trendAxisLabels, trendDetailLabel, trendScrubOccupancy, trendSummary } from '@/core/booking';
import { lakeOperatorStatsQuery, type LakeOperatorStats, type OperatorStatsWindowName, type OperatorTrendPoint, type OperatorWindowTotals } from '@/core/lakes';
import type { Transport } from '@/core/transport';
import { SegmentedControl } from '@/components/forms/SegmentedControl';
import { ChoiceChips } from '@/components/templates/T1/Filters';
import { DashboardSection, DashboardToolbar } from '@/components/templates/T5';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { trendFixture } from './fixtures';
import { lei, weekdayShort } from './format';

export type Metric = 'occupancy' | 'cash';

const WINDOWS: { key: OperatorStatsWindowName; label: string }[] = [
  { key: 'week', label: 'Săptămâna' },
  { key: 'month', label: 'Luna' },
  { key: 'year', label: 'Anul' },
];

/** A round axis top: 1, 2, 2.5, 5 × 10ⁿ at or above the value. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

type ViewProps = {
  points: OperatorTrendPoint[];
  totals: OperatorWindowTotals | null;
  /** The window the points BELONG to: labels, «today» and the summary follow it, never the request. */
  window: OperatorStatsWindowName;
  /** The selected chip: the requested window while it loads, else the window on screen. */
  selected?: OperatorStatsWindowName;
  onWindowChange: (w: OperatorStatsWindowName) => void;
  busy?: boolean;
  /** The requested window failed: say so in the card, offer a retry; the old points stay. */
  failed?: { window: OperatorStatsWindowName; retry: () => void } | null;
  metric: Metric;
  onMetricChange: (m: Metric) => void;
  nowMs: number;
};

/**
 * The card's choices, owned by the page: the card sits in both compositions of the T5 layout, and
 * the two copies must show the same window and metric (DashboardLayout `stacked`).
 */
export type TrendChoice = {
  window: OperatorStatsWindowName;
  onWindowChange: (w: OperatorStatsWindowName) => void;
  metric: Metric;
  onMetricChange: (m: Metric) => void;
  nowMs: number;
};

const METRICS = [
  { value: 'occupancy', label: 'Ocupare' },
  { value: 'cash', label: 'Încasări' },
] as const satisfies { value: Metric; label: string }[];

const windowLabel = (w: OperatorStatsWindowName) => WINDOWS.find((x) => x.key === w)?.label ?? w;

/** «în săptămâna asta» / «în luna asta» / «în anul ăsta» — the window, as the quiet-plot line says it. */
const IN_WINDOW: Record<OperatorStatsWindowName, string> = {
  week: 'în săptămâna asta',
  month: 'în luna asta',
  year: 'în anul ăsta',
};

/** «Nicio dată pentru săptămâna asta»: a window that came back with no points at all. */
const FOR_WINDOW: Record<OperatorStatsWindowName, string> = {
  week: 'săptămâna asta',
  month: 'luna asta',
  year: 'anul ăsta',
};

/**
 * «Cum merge balta» — fish features/operator/dashboard/LakeTrendCard.tsx. One series at a time
 * (occupancy scaled to the lake's stands, or cash), window chips refetch only the chart (dimmed
 * meanwhile), scrubbing a point (pointer or ←/→) names the day and both of its numbers.
 */
export function TrendCardView({ points, totals, window, selected = window, onWindowChange, busy, failed, metric, onMetricChange, nowMs }: ViewProps) {
  // Per-instance radio names: the card is mounted twice (one copy display:none), and two groups
  // sharing a name are one group — the hidden copy would take the checked radio.
  const uid = useId();
  const [active, setActive] = useState(-1);
  // Pointer scrubbing is said once, when the pointer lifts (the slider's aria-valuetext already
  // speaks each keyboard step; a live region on every column crossed would be a stream).
  const [scrubbed, setScrubbed] = useState('');
  // A week reads «Lu Ma Mi …» like the rows' dayTime(), never «L M M»; month and year as core says.
  const labels = useMemo(() => (window === 'week' ? points.map((p) => weekdayShort(p.date)) : trendAxisLabels(points, window)), [points, window]);
  const today = useMemo(() => todayIndex(points, window, new Date(nowMs)), [points, window, nowMs]);
  const values = points.map((p) => (metric === 'cash' ? p.cash : p.booked));
  const stands = points[0]?.total ?? 0;
  const max = metric === 'occupancy' && stands > 0 ? stands : niceMax(Math.max(0, ...values));
  const n = points.length;
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (Math.min(v, max) / max) * 100;
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const point = active >= 0 && active < n ? points[active] : null;
  const detail = point ? `${trendDetailLabel(point.date, window)} · ${trendScrubOccupancy(point, window)} · ${lei(point.cash)} lei` : null;
  const unit = metric === 'cash' ? 'lei' : 'standuri';
  // A quiet window (every value 0) is a fact, not a chart: the axes and day labels stay, the line
  // and its dots give way to one muted line. No points at all: nothing to draw, the line says so.
  const empty = n === 0;
  const quiet = !empty && values.every((v) => v === 0);
  const quietLine = metric === 'cash' ? `Nicio încasare ${IN_WINDOW[window]}` : `Nicio rezervare ${IN_WINDOW[window]}`;
  // Occupancy: 0 and the lake's stands only (half of 21 is no tick); cash: a round top, so its half
  // is round too.
  const ticks = metric === 'occupancy' && stands > 0 ? [1, 0] : [1, 0.5, 0];

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setActive(Math.round(ratio * (n - 1)));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = active < 0 ? (today >= 0 ? today : n - 1) : active;
    const next = e.key === 'ArrowRight' ? from + 1 : e.key === 'ArrowLeft' ? from - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.min(n - 1, Math.max(0, next)));
  };

  return (
    <DashboardSection
      title="Cum merge balta"
      action={
        // Visual only: the slider's aria-valuetext says the day (keyboard), the sr-only status below
        // says a pointer pick once it lifts.
        <p aria-hidden className="t-caption text-accent-ink">
          {detail}
        </p>
      }
    >
      <p role="status" className="sr-only">
        {scrubbed}
      </p>
      <DashboardToolbar
        end={
          // The kit's segmented control (radios) as the kit draws it: its visible legend and its
          // 44px track. TODO(kit): a SegmentedControl `size="compact"` (36px, the chips' height) and
          // an `srLabel` for in-card toolbars — this task may only touch T5, and a template never
          // re-skins a kit component through its DOM.
          <SegmentedControl
            label="Indicator"
            name={`trend-metric-${uid}`}
            options={[...METRICS]}
            value={metric}
            onChange={onMetricChange}
            className="w-full md:w-56"
          />
        }
      >
        <ChoiceChips
          name="trend-window"
          label="Perioada"
          options={WINDOWS.map((w) => ({ value: w.key, label: w.label }))}
          value={selected}
          onChange={onWindowChange}
        />
      </DashboardToolbar>

      {failed ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-status-danger-bg px-3 py-2">
          <p className="min-w-0 flex-1 t-caption text-status-danger-fg">
            Nu s-au putut încărca datele pe {windowLabel(failed.window)}. Graficul arată {windowLabel(window).toLowerCase()}.
          </p>
          <Button size="compact" variant="ghost" onClick={failed.retry}>
            Încearcă din nou
          </Button>
        </div>
      ) : null}

      {empty ? (
        <p className="mt-4 flex h-44 items-center justify-center rounded-control bg-page px-4 text-center t-body text-muted xl:h-56">
          Nicio dată pentru {FOR_WINDOW[window]}
        </p>
      ) : (
        <div
          aria-busy={busy || undefined}
          className={cn('relative mt-4 h-44 transition-opacity duration-(--duration-fast) xl:h-56', busy && 'opacity-50')}
        >
          {/* y axis: 0 · top (occupancy) or 0 · half · top (cash), as whole numbers */}
          {ticks.map((f) => (
            <div key={f} aria-hidden className="absolute right-0 left-0 flex -translate-y-1/2 items-center gap-2" style={{ top: `calc((100% - 24px) * ${1 - f})` }}>
              <span className="w-8 shrink-0 text-right t-micro text-muted tabular-nums">{Math.round(max * f).toLocaleString('ro-RO')}</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>
          ))}
          {quiet ? (
            // Centred in the plot area (the slider's box), outside the slider so it is read as text;
            // the axes and the day labels stay.
            <p className="pointer-events-none absolute top-0 right-1 bottom-6 left-10 flex items-center justify-center px-4 text-center t-body text-muted">
              {quietLine}
            </p>
          ) : null}
          <div
            role="slider"
            tabIndex={0}
            aria-label={`Grafic ${metric === 'cash' ? 'încasări' : 'ocupare'}, ${unit} pe ${window === 'year' ? 'lună' : 'zi'}`}
            aria-valuemin={0}
            aria-valuemax={Math.max(0, n - 1)}
            aria-valuenow={Math.max(0, active)}
            aria-valuetext={detail ?? 'Alege o zi cu săgețile'}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerUp={() => setScrubbed(detail ?? '')}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(-1)}
            onKeyDown={onKey}
            onBlur={() => setActive(-1)}
            className="absolute top-0 right-1 bottom-6 left-10 cursor-crosshair touch-pan-y rounded-control outline-offset-4"
          >
            {quiet ? null : (
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
                <polygon points={`0,100 ${line} 100,100`} className="fill-accent-tint" />
                <polyline points={line} fill="none" vectorEffect="non-scaling-stroke" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            )}
            {point ? (
              <span aria-hidden className="absolute top-0 bottom-0 w-px bg-accent-tint-2" style={{ left: `${x(active)}%` }} />
            ) : null}
            {values.map((v, i) =>
              !quiet && (n <= 12 || i === active) ? (
                <span
                  key={i}
                  aria-hidden
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent transition-[width,height] duration-(--duration-fast)',
                    i === active ? 'size-3.5' : 'size-2.5',
                  )}
                  style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
                />
              ) : null,
            )}
            {labels.map((l, i) =>
              l ? (
                <span
                  key={i}
                  aria-hidden
                  className={cn('absolute -bottom-6 -translate-x-1/2 tabular-nums', i === today ? 't-micro-strong text-accent-ink' : 't-micro text-muted')}
                  style={{ left: `${x(i)}%` }}
                >
                  {l}
                </span>
              ) : null,
            )}
          </div>
        </div>
      )}

      <p className="mt-4 t-caption text-muted">
        {/* Each «·» segment breaks as a whole (no orphan «rezervări»). */}
        {trendSummary(window, totals)
          .split(' · ')
          .map((seg, i) => (
            <span key={i}>
              {i > 0 ? ' · ' : null}
              <span className="inline-block">{seg}</span>
            </span>
          ))}
      </p>
    </DashboardSection>
  );
}

/**
 * The real card: the window is the query's only parameter. While a new window loads, the previous
 * window's points stay on screen (dimmed) WITH their own labels, «today» and summary; if it fails,
 * the card says so and offers a retry, and the chips fall back to the window on screen.
 */
export function LiveTrendCard({
  lakeId,
  initial,
  fetchedAt,
  transport,
  window,
  onWindowChange,
  ...choice
}: { lakeId: string; initial: LakeOperatorStats; fetchedAt: number; transport: Transport } & TrendChoice) {
  // The last window that loaded, with its data: what stays on screen while another window loads
  // (react-query's placeholder) and after it fails (the failed key has no data of its own).
  const [settled, setSettled] = useState<{ window: OperatorStatsWindowName; data: LakeOperatorStats }>({ window: 'week', data: initial });
  const q = useQuery({
    ...lakeOperatorStatsQuery(transport, lakeId, window),
    initialData: window === 'week' ? initial : undefined,
    initialDataUpdatedAt: fetchedAt,
    staleTime: 60_000,
    // One attempt under the 8 s deadline: a hanging CMS lands in the inline alert within it.
    retry: false,
  });
  const fresh = q.data !== undefined && !q.isPlaceholderData ? q.data : null;
  if (fresh && (settled.window !== window || settled.data !== fresh)) setSettled({ window, data: fresh });
  const onScreen = fresh ? { window, data: fresh } : settled;
  const failed = q.isError && !fresh;
  const data = onScreen.data;
  // Hidden only when the panel's own week has no points (parity): a window picked later that comes
  // back empty keeps the card and its chips (focus stays on them, the way back is right there) and
  // says so in place of the chart.
  if (!initial.days || initial.days.length === 0) return null;
  return (
    <TrendCardView
      {...choice}
      points={data.days ?? []}
      totals={data.windowTotals ?? null}
      window={onScreen.window}
      selected={failed ? onScreen.window : window}
      // Picking the failed window again retries it (its chip shows unselected meanwhile).
      onWindowChange={(w) => (w === window && failed ? void q.refetch() : onWindowChange(w))}
      busy={q.isFetching && !fresh}
      failed={failed ? { window, retry: () => void q.refetch() } : null}
    />
  );
}

/**
 * The simulated card of the edge states: same view, windows computed locally. `simulate` shows the
 * live card's two in-between moments on «Luna» while the week stays on screen: `loading` (the chip
 * selected, the chart dimmed) and `failed` (the inline alert; «Încearcă din nou» then loads it).
 */
export function FixtureTrendCard({
  total,
  legacy,
  simulate,
  ...choice
}: { total: number; legacy?: boolean; simulate?: 'loading' | 'failed' } & TrendChoice) {
  const [pending, setPending] = useState(simulate);
  const data = useMemo(() => trendFixture(choice.window, total, choice.nowMs), [choice.window, total, choice.nowMs]);
  const totals = legacy ? null : data.windowTotals;
  if (pending && choice.window === 'week') {
    return (
      <TrendCardView
        {...choice}
        points={data.days}
        totals={totals}
        selected={pending === 'loading' ? 'month' : 'week'}
        onWindowChange={(w) => {
          setPending(undefined);
          choice.onWindowChange(w);
        }}
        busy={pending === 'loading'}
        failed={
          pending === 'failed'
            ? {
                window: 'month',
                retry: () => {
                  setPending(undefined);
                  choice.onWindowChange('month');
                },
              }
            : null
        }
      />
    );
  }
  return <TrendCardView {...choice} points={data.days} totals={totals} />;
}
