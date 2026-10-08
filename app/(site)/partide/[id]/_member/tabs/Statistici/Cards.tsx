'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Squares2X2Icon, TrophyIcon } from '@heroicons/react/24/outline';
import { FishingRodIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { fmtKg, heatLevel, pad2, type BaitRankRow, type LocalRod } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * The three cards under the tiles (fish StatisticiScene RodBars, components/Leaderboard,
 * components/HourHeatmap). Each is a surface card with a heading; the page's bento places them.
 */

export const CARD = 'flex min-w-0 flex-col gap-3 rounded-bento bg-surface p-4 shadow-e0 md:p-5';

function CardHead({ icon, title, id, aside }: { icon: ReactNode; title: string; id: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="flex size-7 items-center justify-center rounded-full bg-accent-tint text-accent [&>svg]:size-4">
        {icon}
      </span>
      <h3 id={id} className="min-w-0 flex-1 t-heading text-ink">
        {title}
      </h3>
      {aside}
    </div>
  );
}

/* ── «Capturi pe lansetă» (c4) ─────────────────────────────────────────────────────────────── */

/** fish RodBars: one bar per rod, its share of the rod with the most captures, the count after. */
export function RodBars({ rods, byRod, className }: { rods: LocalRod[]; byRod: Record<number, number>; className?: string }) {
  const max = Math.max(1, ...rods.map(r => byRod[r.index] ?? 0));
  return (
    <section aria-labelledby="stats-rods-h" data-testid="stats-rod-bars" className={cn(CARD, className)}>
      <CardHead id="stats-rods-h" icon={<FishingRodIcon />} title="Capturi pe lansetă" />
      <ul className="flex flex-col gap-3">
        {rods.map(r => {
          const n = byRod[r.index] ?? 0;
          return (
            <li
              key={r.index}
              data-testid="stats-rod-bar"
              data-rod={r.index}
              aria-label={`${r.label}: ${formatCount(n, 'captură', 'capturi')}`}
              className="grid grid-cols-[6rem_minmax(0,1fr)_2rem] items-center gap-3"
              style={{ '--rod': r.color } as CSSProperties}
            >
              <span className="flex min-w-0 items-center gap-2 t-label text-ink">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-(--rod)" />
                <span className="truncate">{r.label}</span>
              </span>
              <span aria-hidden className="h-2.5 overflow-hidden rounded-full bg-soft-fill">
                <span data-testid="stats-rod-fill" className="block h-full rounded-full bg-(--rod)" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span aria-hidden className="text-right t-label text-ink-2 tabular-nums">
                {n}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ── «Clasament momeli» (c5) ───────────────────────────────────────────────────────────────── */

const DOTS = ['bg-bait-1', 'bg-bait-2', 'bg-bait-3', 'bg-bait-4', 'bg-bait-5', 'bg-bait-6'];
const kg = (v: number | null) => (v == null ? '—' : fmtKg(v));

/**
 * fish Leaderboard: baits ranked by their captures (then the heaviest), with the average and the
 * heaviest fish. A real table (header row on its own tint, row separators — owner rule 12); the
 * leader on the indigo tint with the filled rank badge, like fish. The «kg» of both weight columns
 * sits in the header, apart from the label (rule 10).
 */
export function BaitLeaderboard({ rows, className }: { rows: BaitRankRow[]; className?: string }) {
  return (
    <section aria-labelledby="stats-baits-h" data-testid="stats-leaderboard" className={cn(CARD, className)}>
      <CardHead id="stats-baits-h" icon={<TrophyIcon />} title="Clasament momeli" />
      {rows.length === 0 ? (
        <p data-testid="stats-leaderboard-empty" className="py-4 text-center t-body text-muted">
          Încă nicio captură de clasat
        </p>
      ) : (
        <table className="w-full table-fixed border-separate border-spacing-0 t-label">
          <caption className="sr-only">Momelile, după capturi</caption>
          <thead>
            <tr className="t-micro-strong text-ink-2 uppercase">
              <th scope="col" className="w-9 rounded-s-control bg-soft-fill py-2 ps-2 text-left md:w-10 md:ps-3">#</th>
              <th scope="col" className="bg-soft-fill py-2 text-left">Momeală</th>
              <th scope="col" className="w-11 bg-soft-fill py-2 text-center md:w-14">Pești</th>
              <th scope="col" className="w-15 bg-soft-fill py-2 text-right md:w-18">
                Medie <span className="t-nano text-muted normal-case">kg</span>
              </th>
              <th scope="col" className="w-15 rounded-e-control bg-soft-fill py-2 pe-2 text-right md:w-18 md:pe-3">
                Max <span className="t-nano text-muted normal-case">kg</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const top = i === 0;
              const cell = cn('py-2.5', top ? 'bg-indigo-1' : 'border-t border-hairline');
              return (
                <tr key={r.baitKey} data-testid="stats-bait-row" data-top={top || undefined}>
                  <td className={cn(cell, 'ps-2 md:ps-3', top && 'rounded-s-control')}>
                    <span
                      className={cn(
                        'flex size-5.5 items-center justify-center rounded-md t-micro-strong tabular-nums',
                        top ? 'bg-indigo-5 text-on-accent' : 'bg-soft-fill text-ink-2',
                      )}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className={cell}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', DOTS[i % DOTS.length])} />
                      <span data-testid="stats-bait-label" className="truncate text-ink">
                        {r.baitLabel}
                      </span>
                    </span>
                  </td>
                  <td className={cn(cell, 'text-center t-body-strong text-ink tabular-nums')}>{r.captures}</td>
                  <td className={cn(cell, 'text-right text-ink-2 tabular-nums')}>{kg(r.avgKg)}</td>
                  <td className={cn(cell, 'pe-2 text-right text-ink tabular-nums md:pe-3', top && 'rounded-e-control')}>{kg(r.maxKg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* ── «Trăsături pe ore» (c5) ───────────────────────────────────────────────────────────────── */

const RAMP = ['bg-soft-fill text-ink-2', 'bg-heat-1 text-heat-ink', 'bg-heat-2 text-on-accent', 'bg-heat-3 text-on-accent', 'bg-heat-4 text-on-accent'];

/**
 * fish HourHeatmap: the 24 hours of the day, each cell shaded by its share of the busiest hour
 * (heatLevel 0–4), the «Mai puține — Mai multe» legend under it. Three rows of 8 on the phone
 * (00–07, 08–15, 16–23), two of 12 on a card ≥ 560px wide, one row of 24 from 880px.
 */
export function HourHeatmap({ hours, className }: { hours: number[]; className?: string }) {
  const max = Math.max(1, ...hours);
  return (
    <section aria-labelledby="stats-hours-h" data-testid="stats-heatmap" className={cn(CARD, '@container', className)}>
      <CardHead id="stats-hours-h" icon={<Squares2X2Icon />} title="Trăsături pe ore" />
      <ol className="grid grid-cols-8 gap-1.5 @[35rem]:grid-cols-12 @[55rem]:grid-cols-24">
        {hours.map((v, h) => {
          const level = heatLevel(v, max);
          return (
            <li
              key={h}
              data-testid="stats-hour"
              data-hour={h}
              data-count={v}
              data-level={level}
              aria-label={`${pad2(h)}:00 — ${formatCount(v, 'trăsătură', 'trăsături')}`}
              className={cn('flex h-9 items-center justify-center rounded-lg t-micro-strong tabular-nums', RAMP[level])}
            >
              <span aria-hidden>{pad2(h)}</span>
            </li>
          );
        })}
      </ol>
      <div aria-hidden className="flex items-center justify-between gap-3 border-t border-hairline pt-3 t-micro text-muted">
        <span>Mai puține</span>
        <span className="flex gap-1">
          {RAMP.map(c => (
            <span key={c} className={cn('h-2.5 w-4 rounded-xs', c.split(' ')[0])} />
          ))}
        </span>
        <span>Mai multe</span>
      </div>
    </section>
  );
}
