'use client';

import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/components/ui/cn';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { axisLabelIndices, fmtKg } from '@/core/partide';
import { clockRo } from './format';

/*
 * «Evoluția capturilor» — fish EvolutionCard + ActivityLineChart (parity partide.spectator.c9;
 * fish helpers/evolution.ts buildEvolutionLineSeries): one point per weighed catch in time order
 * (equal spacing, y = that catch's kg — as fish plots it, scrubbing snaps catch to catch), a dot on
 * every point, the curve over a tinted area, a kg y-axis with fish's integer «nice» steps
 * (yAxisScaleKg) and ≤4 HH:MM labels. Hovering, touching or arrowing through it names the catch
 * in the header («Crap · 3,4 kg · 14:30»); idle, the header says «cumulat · N kg». Hidden under
 * two weighed catches. One summary image for screen readers plus an sr-only table.
 *
 * The series is built here, not with core buildEvolutionLineSeries: that one prints the clock in
 * the runtime's zone (fish: the phone's), and this renders on a server too — clockRo reads
 * Europe/Bucharest, so server and browser agree.
 */

export type EvolutionCatch = { weightKg: number; species: string | null; occurredAt: string };
type Point = { kg: number; label: string; detail: string };

export function evolutionPoints(catches: EvolutionCatch[]): Point[] | null {
  const weighed = catches
    .filter(c => (c.weightKg ?? 0) > 0)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  if (weighed.length < 2) return null;
  const shown = new Set(axisLabelIndices(weighed.length));
  return weighed.map((c, i) => ({
    kg: c.weightKg,
    label: shown.has(i) ? clockRo(c.occurredAt) : '',
    detail: `${c.species ?? 'Captură'} · ${fmtKg(c.weightKg)} kg · ${clockRo(c.occurredAt)}`,
  }));
}

/** fish activityLineChart.helpers yAxisScaleKg: integer «nice» steps with headroom over the max. */
export function yAxisScaleKg(max: number): { maxValue: number; noOfSections: number; stepValue: number } {
  const noOfSections = 3;
  const rawStep = Math.max(1, Math.ceil(max / noOfSections));
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  let step = 10 * pow;
  for (const c of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const s = c * pow;
    if (Number.isInteger(s) && s >= rawStep && s * noOfSections > max) {
      step = s;
      break;
    }
  }
  return { maxValue: step * noOfSections, noOfSections, stepValue: step };
}

const W = 600;
const H = 140;
/** The plot's inset (viewBox units): room for the first / last dot and their HH:MM labels. */
const PAD = { top: 10, right: 16, bottom: 6, left: 16 };

/**
 * A smooth path THROUGH every point (fish's curved line; each dot sits on it): monotone cubic
 * interpolation (Fritsch–Carlson), so the curve never overshoots between two catches — no dip
 * under 0 kg, no false peak above the heaviest catch.
 */
export function smoothPath(xy: [number, number][]): string {
  const n = xy.length;
  const f = (v: number) => v.toFixed(1);
  if (n < 3) return xy.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)},${f(y)}`).join(' ');
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xy[i + 1][0] - xy[i][0]);
    m.push((xy[i + 1][1] - xy[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${f(xy[0][0])},${f(xy[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = xy[i];
    const [x1, y1] = xy[i + 1];
    const h = dx[i] / 3;
    d += ` C${f(x0 + h)},${f(y0 + t[i] * h)} ${f(x1 - h)},${f(y1 - t[i + 1] * h)} ${f(x1)},${f(y1)}`;
  }
  return d;
}

export function EvolutionChart({ catches, totalKg, className }: { catches: EvolutionCatch[]; totalKg: number | null; className?: string }) {
  const [active, setActive] = useState(-1);
  const titleId = useId();
  const points = evolutionPoints(catches);
  if (!points) return null;
  const n = points.length;
  const scale = yAxisScaleKg(Math.max(...points.map(p => p.kg)));
  const x = (i: number) => PAD.left + (i * (W - PAD.left - PAD.right)) / (n - 1);
  const y = (v: number) => PAD.top + (1 - v / scale.maxValue) * (H - PAD.top - PAD.bottom);
  const xy = points.map((p, i) => [x(i), y(p.kg)] as [number, number]);
  const line = smoothPath(xy);
  const area = `${line} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const point = active >= 0 && active < n ? points[active] : null;
  const yLabel = (v: number) => (v === 0 ? '0' : `${v} kg`);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setActive(i => Math.min(n - 1, i + 1));
    else if (e.key === 'ArrowLeft') setActive(i => (i < 0 ? n - 1 : Math.max(0, i - 1)));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === 'Escape') setActive(-1);
    else return;
    e.preventDefault();
  };

  return (
    <section aria-labelledby={titleId} data-testid="partida-evolution" className={cn('flex flex-col gap-4 bg-surface px-4 py-5 md:rounded-card md:p-5 md:shadow-e0 xl:p-6', className)}>
      <div className="flex min-h-6 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="t-title2">
          Evoluția capturilor
        </h2>
        <p aria-live="polite" data-testid="partida-evolution-header" className={cn('truncate', point ? 't-label text-accent-ink' : 't-caption text-muted')}>
          {point ? (
            point.detail
          ) : totalKg != null ? (
            <>
              cumulat · <InlineNumber value={fmtKg(totalKg)} unit="kg" />
            </>
          ) : null}
        </p>
      </div>
      <div className="grid grid-cols-[--spacing(10)_minmax(0,1fr)] gap-x-2 gap-y-2">
        <div aria-hidden className="relative h-35">
          {Array.from({ length: scale.noOfSections + 1 }, (_, k) => {
            const v = k * scale.stepValue;
            return (
              <span key={k} className="absolute right-0 -translate-y-1/2 t-micro whitespace-nowrap text-muted tabular-nums" style={{ top: `${(y(v) / H) * 100}%` }}>
                {yLabel(v)}
              </span>
            );
          })}
        </div>
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-35 w-full touch-none overflow-visible rounded-control focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            role="img"
            aria-label={`Evoluția capturilor: ${n} capturi cântărite${totalKg != null ? `, ${fmtKg(totalKg)} kg în total` : ''}. Folosește săgețile pentru fiecare captură.`}
            tabIndex={0}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(-1)}
            onKeyDown={keys}
            onBlur={() => setActive(-1)}
          >
            <defs>
              <linearGradient id={`${titleId}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" className="[stop-color:var(--color-accent)] [stop-opacity:0.28]" />
                <stop offset="100%" className="[stop-color:var(--color-accent)] [stop-opacity:0.02]" />
              </linearGradient>
            </defs>
            {Array.from({ length: scale.noOfSections + 1 }, (_, k) => {
              const v = k * scale.stepValue;
              return (
                <line key={k} x1={0} x2={W} y1={y(v)} y2={y(v)} className="stroke-hairline" strokeWidth={1} strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
              );
            })}
            <path d={area} fill={`url(#${titleId}-fill)`} />
            <path d={line} className="fill-none stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {point ? (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={y(0)} className="stroke-accent-tint-3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>
          {/* The dots as HTML, so the stretched viewBox never squashes them into ellipses. */}
          {xy.map(([px, py], i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent',
                i === active ? 'size-3 border-2 border-surface shadow-e1' : n > 25 ? 'size-1.5' : 'size-2',
              )}
              style={{ left: `${(px / W) * 100}%`, top: `${(py / H) * 100}%` }}
            />
          ))}
        </div>
        <div aria-hidden className="relative col-start-2 h-4">
          {points.map((p, i) =>
            p.label ? (
              <span key={i} className="absolute -translate-x-1/2 t-micro whitespace-nowrap text-muted tabular-nums" style={{ left: `${(x(i) / W) * 100}%` }}>
                {p.label}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <table className="sr-only">
        <caption>Capturile cântărite, în ordinea orei</caption>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{p.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
