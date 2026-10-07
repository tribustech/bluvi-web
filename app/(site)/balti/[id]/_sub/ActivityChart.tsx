'use client';

import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { labelIndices, yAxisScale } from '@/core/partide';
import { cn } from '@/components/ui/cn';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * «Activitate» — fish ActivityCard + ActivityLineChart (parity lakes.stats.c7): the buckets of the
 * period as a line over a tinted area; hovering, touching or arrowing through it names one bucket
 * in the header («3 capturi · mie 29 iul»). One summary image for screen readers plus an sr-only
 * table.
 * TODO(kit): a copy of ape-publice/_components/venue/ActivityChart.tsx (that unit's file, which
 * this unit may not import from or edit) — one ActivityChart belongs in the kit.
 */

export type ActivityPoint = { label: string; count: number; /** The bucket in full («mie 29 iul»); the label when omitted. */ detail?: string };

const W = 600;
const H = 160;
/**
 * The plot's own padding (viewBox units). No left padding: the y labels sit in a fixed 32px
 * column beside the SVG (the grid below), so the stretched viewBox (preserveAspectRatio="none")
 * never squeezes the label gutter on a narrow card — «180» never runs into the line at 375.
 */
const PAD = { top: 10, right: 8, bottom: 6, left: 0 };

export function ActivityChart({
  points,
  noun,
  caption,
  summary,
  heading: Heading = 'h2',
  className,
  testId,
}: {
  points: ActivityPoint[];
  /** What a bucket counts: [one, many] («captură», «capturi»). */
  noun: [string, string];
  /** A quiet line at the header's end while nothing is picked («ultimele 7 luni»). */
  caption?: ReactNode;
  /** The image's accessible name. */
  summary: string;
  /** h3 inside a titled section (the detail page's «Partide pe această apă»). */
  heading?: 'h2' | 'h3';
  className?: string;
  testId?: string;
}) {
  const [active, setActive] = useState(-1);
  const titleId = useId();
  const n = points.length;
  const max = Math.max(0, ...points.map((s) => s.count));
  const scale = yAxisScale(max);
  const x = (i: number) => PAD.left + (n <= 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (n - 1));
  const y = (v: number) => PAD.top + (1 - v / scale.maxValue) * (H - PAD.top - PAD.bottom);
  const line = points.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.count).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const shown = new Set(labelIndices(n));
  const point = active >= 0 && active < n ? points[active] : null;
  const count = (c: number) => formatCount(c, noun[0], noun[1]);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive((i) => Math.min(n - 1, i + 1));
    else if (e.key === 'ArrowLeft') setActive((i) => (i < 0 ? n - 1 : Math.max(0, i - 1)));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === 'Escape') setActive(-1);
    else return;
    e.preventDefault();
  };

  return (
    <section aria-labelledby={titleId} className={cn('flex flex-col gap-3 rounded-card bg-surface p-4.5 shadow-e0', className)} data-testid={testId}>
      <div className="flex min-h-6 items-baseline justify-between gap-3">
        <Heading id={titleId} className="t-heading text-ink">
          Activitate
        </Heading>
        <p aria-live="polite" className={cn('truncate', point ? 't-label text-accent-ink' : 't-micro text-muted')}>
          {point ? `${count(point.count)} · ${point.detail ?? point.label}` : caption}
        </p>
      </div>
      {/* Fixed-pixel y gutter (32px) beside the plot; the x labels start under the plot. */}
      <div className="grid grid-cols-[--spacing(8)_minmax(0,1fr)] gap-x-2 gap-y-3">
        {/* Y labels and the marker as HTML, so the stretched viewBox never squashes them. */}
        <div aria-hidden className="relative h-40">
          {Array.from({ length: scale.noOfSections + 1 }, (_, k) => {
            const v = k * scale.stepValue;
            return (
              <span key={k} className="absolute right-0 -translate-y-1/2 t-micro text-muted tabular-nums" style={{ top: `${(y(v) / H) * 100}%` }}>
                {v}
              </span>
            );
          })}
        </div>
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-40 w-full touch-none overflow-visible rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            role="img"
            aria-label={`${summary} Folosește săgețile pentru fiecare interval.`}
            tabIndex={0}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(-1)}
            onKeyDown={keys}
            onBlur={() => setActive(-1)}
          >
            {Array.from({ length: scale.noOfSections + 1 }, (_, k) => {
              const v = k * scale.stepValue;
              return <line key={k} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-hairline" strokeWidth={1} vectorEffect="non-scaling-stroke" />;
            })}
            <path d={area} className="fill-accent-tint" />
            <path d={line} className="fill-none stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {point ? (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} className="stroke-accent-ink" strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
          {point ? (
            <span
              aria-hidden
              className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-e1"
              style={{ left: `${(x(active) / W) * 100}%`, top: `${(y(point.count) / H) * 100}%` }}
            />
          ) : null}
        </div>
        <div aria-hidden className="relative col-start-2 h-4">
          {points.map((s, i) =>
            shown.has(i) ? (
              <span key={i} className="absolute -translate-x-1/2 t-micro whitespace-nowrap text-muted" style={{ left: `${(x(i) / W) * 100}%` }}>
                {s.label}
              </span>
            ) : null,
          )}
        </div>
      </div>
      {/* The chart as a table, for screen readers (the image above is one summary). */}
      <table className="sr-only">
        <caption>Activitate pe fiecare interval</caption>
        <tbody>
          {points.map((s, i) => (
            <tr key={i}>
              <th scope="row">{s.detail ?? s.label}</th>
              <td>{count(s.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
