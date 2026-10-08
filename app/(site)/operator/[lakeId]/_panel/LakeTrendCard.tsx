'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { todayIndex, trendAxisLabels } from '@/core/booking';
import type { OperatorStatsWindowName, OperatorTrendPoint, OperatorWindowTotals } from '@/core/lakes';
import { DashboardSection } from '@/components/templates/T5';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { scrubHeader, showAllPoints, TREND_METRICS, TREND_WINDOWS, trendScale, trendSummaryLine, type TrendMetric } from './model';

/** The caption at rest: the window the chart shows. */
const WINDOW_CAPTION: Record<OperatorStatsWindowName, string> = { week: 'Săptămâna asta', month: 'Luna asta', year: 'Anul acesta' };

// Tailwind 4: `outline-none` drops the style; the ring needs `outline-solid` back (T3 DetailTabs).
const FOCUS_RING = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/**
 * Owner rule 20 («nici nu vezi că sunt taburi»): a switch reads as tabs — one container with a visible
 * edge on the surface (the handle-grey border, as the competition page's ViewTabs), a filled accent-ink
 * selected tab, hover and keyboard focus; an ARIA tablist (← → Home End, roving tab stop, automatic
 * activation) controlling the chart.
 */
function TrendTabs<K extends string>({
  label,
  options,
  value,
  onChange,
  controls,
  idBase,
  className,
}: {
  label: string;
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  controls: string;
  idBase: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = options.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    refs.current[next]?.focus();
    onChange(options[next].key);
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      // Full width below the card's 448px (equal segments), content-sized beside its neighbour.
      className={cn('grid w-full gap-0.5 rounded-control border border-handle bg-surface p-0.5 @md:w-fit', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o, i) => {
        const selected = o.key === value;
        return (
          <button
            key={o.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idBase}-${o.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={controls}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              'flex h-9 min-w-0 cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-3px)] px-3 t-label whitespace-nowrap transition-[background-color,color] duration-(--duration-fast) ease-select active:opacity-80',
              FOCUS_RING,
              selected ? 'bg-accent-ink text-on-accent' : 'text-ink-2 hover:bg-accent-tint hover:text-accent-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * «Cum merge balta» — fish features/operator/dashboard/LakeTrendCard.tsx (+ ActivityLineChart), the
 * panel's only period surface: everything above it is pinned to now, this card carries its own clock.
 *  - c25 the window tabs (Săptămâna · Luna · Anul) and the metric tabs (Ocupare · Încasări);
 *  - c26 a new window keeps the previous points on screen, dimmed, until it answers — labelled by the
 *    window they BELONG to (`window`), while the tab shows the one asked for (`selected`); a window that
 *    fails says so here with a retry and the figures stay;
 *  - c27 one series at a time; occupancy scaled to the lake's stands, cash to its busiest bucket, whole
 *    labels; the points drawn up to 12;
 *  - c28 x labels per window from the keys, never through a timezone (core trendAxisLabels);
 *  - c29 scrubbing (pointer, or ← → Home End on the focused chart) names the day and both of its
 *    numbers in the header; the keys never scroll the page, a touch drags across without scrolling it
 *    sideways and lets go of the day when it lifts or turns into a vertical scroll;
 *  - c30 the window's summary under the chart.
 * The window and the metric are the page's (the card is mounted in both compositions of the T5
 * layout; DashboardLayout `stacked`); the scrubbed point is this copy's own.
 */
export function LakeTrendCard({
  points,
  totals,
  window,
  selected,
  onWindowChange,
  metric,
  onMetricChange,
  busy,
  failed,
  nowMs,
}: {
  points: OperatorTrendPoint[];
  totals: OperatorWindowTotals | null | undefined;
  /** The window the points belong to. */
  window: OperatorStatsWindowName;
  /** The window asked for (the selected tab). */
  selected: OperatorStatsWindowName;
  onWindowChange: (w: OperatorStatsWindowName) => void;
  metric: TrendMetric;
  onMetricChange: (m: TrendMetric) => void;
  busy: boolean;
  /** The selected window failed to load: say so, offer a retry (the previous points stay). */
  failed: { retry: () => void; retrying: boolean } | null;
  nowMs: number;
}) {
  const uid = useId();
  const chartId = `${uid}-chart`;
  const [active, setActive] = useState(-1);
  const [spoken, setSpoken] = useState('');
  const labels = useMemo(() => trendAxisLabels(points, window), [points, window]);
  const today = useMemo(() => todayIndex(points, window, new Date(nowMs)), [points, window, nowMs]);
  const values = points.map((p) => (metric === 'cash' ? p.cash : p.booked));
  const { max, ticks } = trendScale(points, metric);
  const n = points.length;
  const x = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v: number) => 100 - (Math.min(Math.max(0, v), max) / max) * 100;
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const point = active >= 0 && active < n ? points[active] : null;
  const detail = point ? scrubHeader(point, window) : null;
  const dots = showAllPoints(n);

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setActive(Math.round(ratio * (n - 1)));
  };
  // c29 touch / pen: the scrub lives only while the finger is down (fish: cleared on release). A
  // vertical pan scrolls the page (touch-pan-y) and the browser cancels the pointer: clear it then too,
  // so scrolling past the chart never leaves the caption on the day the thumb first touched.
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    setSpoken(detail ?? '');
    if (e.pointerType !== 'mouse') setActive(-1);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // A mouse scrubs on hover; a touch or a pen only while pressed (no stray hover moves from a pen).
    if (e.pointerType === 'mouse' || e.buttons > 0) pick(e);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = active < 0 ? (today >= 0 ? today : n - 1) : active;
    const next =
      e.key === 'ArrowRight' ? Math.min(n - 1, active < 0 ? from : from + 1)
      : e.key === 'ArrowLeft' ? Math.max(0, active < 0 ? from : from - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? n - 1
      : e.key === 'Escape' ? -1
      : null;
    if (next === null) return;
    // c29: the arrows and Home / End move the scrub, never the page.
    e.preventDefault();
    setActive(next);
  };

  return (
    <DashboardSection
      title="Cum merge balta"
      // The day under the pointer / keyboard (fish: the header while scrubbing), as the line under the
      // title — at rest the window it shows — so a 343px phone card keeps its title on one line and
      // nothing below moves when a scrub starts. Visual only: the slider's aria-valuetext says it for
      // the keyboard, the status below once a pointer lifts.
      caption={
        <span aria-hidden data-testid="trend-scrub" className={cn('tabular-nums', detail ? 't-label text-accent-ink' : undefined)}>
          {detail ?? WINDOW_CAPTION[window]}
        </span>
      }
    >
      <p role="status" className="sr-only">
        {spoken}
      </p>
      {/* One row when the card has room (≥ 448px); below it each switch takes the card's width, so
          the period and the metric never stagger across two half-empty rows. */}
      <div className="@container">
        <div className="flex flex-col gap-2 @md:flex-row @md:items-center @md:justify-between">
          <TrendTabs label="Perioada" options={TREND_WINDOWS} value={selected} onChange={onWindowChange} controls={chartId} idBase={`${uid}-w`} />
          <TrendTabs label="Indicator" options={TREND_METRICS} value={metric} onChange={onMetricChange} controls={chartId} idBase={`${uid}-m`} />
        </div>
      </div>

      {failed ? (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control bg-status-danger-bg px-3 py-2">
          <p className="min-w-0 flex-1 t-caption text-status-danger-fg">Nu s-au putut încărca datele. Graficul arată perioada de dinainte.</p>
          <Button size="compact" variant="ghost" onClick={failed.retry} aria-disabled={failed.retrying || undefined} aria-busy={failed.retrying || undefined}>
            Încearcă din nou
          </Button>
        </div>
      ) : null}

      <div
        id={chartId}
        role="tabpanel"
        aria-labelledby={`${uid}-w-${selected}`}
        aria-busy={busy || undefined}
        data-testid="trend-chart"
        data-busy={busy || undefined}
        className={cn('relative mt-4 h-44 transition-opacity duration-(--duration-fast) ease-fast xl:h-48', busy && 'opacity-50')}
      >
        {/* y axis: whole numbers, 0 at the bottom (c27). */}
        {ticks.map((v) => (
          <div
            key={v}
            aria-hidden
            className="absolute right-0 left-0 flex -translate-y-1/2 items-center gap-2"
            style={{ top: `calc((100% - var(--spacing) * 6) * ${1 - v / max})` }}
          >
            <span className="w-9 shrink-0 text-right t-micro text-muted tabular-nums" data-testid="trend-y">
              {v.toLocaleString('ro-RO')}
            </span>
            <span className="h-px flex-1 bg-hairline" />
          </div>
        ))}
        <div
          role="slider"
          tabIndex={0}
          aria-label={`Grafic ${metric === 'cash' ? 'încasări, lei' : 'ocupare, standuri'} pe ${window === 'year' ? 'lună' : 'zi'}`}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, n - 1)}
          aria-valuenow={Math.max(0, active)}
          aria-valuetext={detail ?? 'Alege o zi cu săgețile'}
          onPointerMove={onPointerMove}
          onPointerDown={pick}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setActive(-1)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(-1)}
          onKeyDown={onKey}
          onBlur={() => setActive(-1)}
          className={cn('absolute top-0 right-1 bottom-6 left-11 cursor-crosshair touch-pan-y rounded-control', FOCUS_RING, 'focus-visible:outline-offset-4')}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 size-full overflow-visible">
            <polygon points={`0,100 ${line} 100,100`} className="fill-accent-tint" />
            <polyline points={line} fill="none" vectorEffect="non-scaling-stroke" className="stroke-accent" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          {point ? <span aria-hidden className="absolute top-0 bottom-0 w-px bg-accent-ink" style={{ left: `${x(active)}%` }} /> : null}
          {values.map((v, i) =>
            dots || i === active ? (
              <span
                key={i}
                aria-hidden
                data-testid="trend-dot"
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
                data-testid="trend-x"
                className={cn('absolute -bottom-6 -translate-x-1/2 tabular-nums', i === today ? 't-micro-strong text-accent-ink' : 't-micro text-muted')}
                style={{ left: `${x(i)}%` }}
              >
                {l}
              </span>
            ) : null,
          )}
        </div>
      </div>

      <p className="mt-4 t-caption text-muted" data-testid="trend-summary">
        {/* Each «·» segment breaks as a whole (no orphan «rezervări»). */}
        {trendSummaryLine(window, totals)
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
