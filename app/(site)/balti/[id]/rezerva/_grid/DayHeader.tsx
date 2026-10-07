'use client';

import { memo, type KeyboardEvent } from 'react';
import { MoonIcon, SunIcon } from '@heroicons/react/16/solid';
import type { DayHeader as Day, HeaderSlot } from '@/core/booking';
import { T4Spinner } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';
import { CHIP_MIN_FIT_PX, HEADER_DAY_H, HEADER_H, HEADER_SUB_H, PINNED_W } from './model';

/*
 * The grid's day header (fish GridHeader): one indigo pill per day, «Sâmbătă 15 aug», that selects
 * the whole day on the selected stand (c20), and under it one chip per slot with its interval —
 * «06–18» / «07:30–19:30» with a sun (day shift) or a moon (night shift), «24h · 06:00 → 06:00»
 * without a glyph for 24h and longer, the glyph dropped where the column is too narrow (c10, c11).
 *
 * The row is the scroller's first child, `sticky top-0`: it stays attached to the grid's top edge at
 * every scroll position (owner rule 3) and moves sideways with the band rows by construction — one
 * scroller owns both axes, so there is nothing to keep in sync. The «Stand» corner is sticky to the
 * left inside it. The day pills are one roving tab stop (arrows move between days).
 */

type Props = {
  days: Day[];
  labels: string[];
  headerSlots: HeaderSlot[];
  dayWidthPx: number;
  bodyWidthPx: number;
  /** The next month is loading: a placeholder column with a spinner at the end (c9). */
  fetchingNext: boolean;
  /** The day whose pill is the tab stop (today, else the first). */
  tabDayIndex: number;
  onDayPress: (day: Day) => void;
};

export const DayHeader = memo(function DayHeader({
  days,
  labels,
  headerSlots,
  dayWidthPx,
  bodyWidthPx,
  fetchingNext,
  tabDayIndex,
  onDayPress,
}: Props) {
  const width = bodyWidthPx + (fetchingNext ? dayWidthPx : 0);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const pills = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-day]')];
    const i = pills.indexOf(e.target as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? pills.length - 1 : i + (e.key === 'ArrowRight' ? 1 : -1);
    const target = pills[Math.max(0, Math.min(pills.length - 1, next))];
    pills.forEach(p => (p.tabIndex = p === target ? 0 : -1));
    target.focus();
  };
  return (
    <div className="sticky top-0 z-sticky flex border-b border-hairline bg-surface" style={{ height: HEADER_H, width: PINNED_W + width }}>
      <div
        aria-hidden
        className="t-caption sticky left-0 z-above flex shrink-0 items-center justify-center border-r border-hairline bg-surface text-muted"
        style={{ width: PINNED_W }}
      >
        Stand
      </div>
      <div role="group" aria-label="Zile" className="relative shrink-0" style={{ width }} onKeyDown={onKeyDown}>
        {days.map((day, i) => (
          <button
            key={day.dayIndex}
            type="button"
            data-day={day.dayIndex}
            tabIndex={day.dayIndex === tabDayIndex ? 0 : -1}
            onClick={() => onDayPress(day)}
            aria-label={`${labels[i]}, selectează toată ziua`}
            title={labels[i]}
            className={cn(
              't-label absolute flex cursor-pointer items-center justify-center truncate rounded-control bg-accent-tint px-1 text-accent-ink',
              'transition-[filter,opacity] duration-(--duration-fast) ease-fast hover:brightness-95 active:opacity-60',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            )}
            style={{ left: day.dayIndex * dayWidthPx + 3, width: dayWidthPx - 6, top: 4, height: HEADER_DAY_H - 8, scrollMarginLeft: PINNED_W + 8 }}
          >
            <span className="truncate">{labels[i]}</span>
          </button>
        ))}
        {headerSlots.map(hs => {
          const tight = hs.widthPx < CHIP_MIN_FIT_PX;
          return (
            <span
              key={hs.cellIndex}
              aria-hidden
              data-chip
              className="absolute flex items-center justify-center"
              style={{ left: hs.leftPx, width: hs.widthPx, top: HEADER_DAY_H, height: HEADER_SUB_H }}
            >
              <span
                className={cn(
                  't-micro-strong flex max-w-full items-center rounded-full bg-soft-fill py-0.5 whitespace-nowrap text-ink-2',
                  tight ? 'px-1' : 'gap-1 px-2',
                )}
              >
                {!tight && hs.kind === 'day' ? <SunIcon data-glyph="sun" className="size-2.5 shrink-0 text-muted" /> : null}
                {!tight && hs.kind === 'night' ? <MoonIcon data-glyph="moon" className="size-2.5 shrink-0 text-muted" /> : null}
                <span className="truncate">{hs.label}</span>
              </span>
            </span>
          );
        })}
        {fetchingNext ? (
          <span
            data-testid="grid-next-spinner"
            className="absolute top-0 flex items-center justify-center bg-surface text-muted"
            style={{ left: bodyWidthPx, width: dayWidthPx, height: HEADER_H }}
          >
            <T4Spinner />
            <span className="sr-only">Se încarcă luna următoare…</span>
          </span>
        ) : null}
      </div>
    </div>
  );
});
