'use client';

import { Fragment, memo, type KeyboardEvent } from 'react';
import { MoonIcon, SunIcon } from '@heroicons/react/16/solid';
import { formatMonthAbbr, type DayHeader as Day, type HeaderSlot } from '@/core/booking';
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

/** The gap a stuck day label keeps from the frozen column and from the grid's right edge. */
const LABEL_EDGE = 6;
/** The pill's own inset (left/width ±3) plus the label's px-1 on each side. */
const LABEL_PAD = 3 + 4;

let ruler: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
function textWidth(text: string, font: string): number {
  const key = `${font}|${text}`;
  let w = widths.get(key);
  if (w === undefined) {
    ruler ??= document.createElement('canvas').getContext('2d');
    if (!ruler) return 0;
    ruler.font = font;
    w = Math.ceil(ruler.measureText(text).width);
    // Not cached while the web font is still loading: the fallback's widths would stick.
    if (document.fonts.status === 'loaded') widths.set(key, w);
  }
  return w;
}

/**
 * Fits the day labels at the grid's two horizontal edges to the part of their pill that shows: the
 * whole «Duminică 11 oct», else «11 oct», else nothing (data-fit on the label; CSS swaps the text).
 * Called by the grid on every scroll and geometry change — DOM attributes only, no React render, and
 * only the edge days are measured (canvas, cached per text).
 */
export function fitDayLabels(scroller: HTMLElement, dayWidthPx: number) {
  if (dayWidthPx <= 0) return;
  const from = scroller.scrollLeft;
  const to = from + scroller.clientWidth - PINNED_W;
  const edge = new Set([Math.floor(from / dayWidthPx), Math.floor(Math.max(from, to - 1) / dayWidthPx)]);
  for (const el of scroller.querySelectorAll<HTMLElement>('[data-day-label]')) {
    const d = Number(el.dataset.dayLabel);
    if (!edge.has(d)) {
      if (el.dataset.fit) delete el.dataset.fit;
      continue;
    }
    const shown =
      Math.min((d + 1) * dayWidthPx - LABEL_PAD, to - LABEL_EDGE) - Math.max(d * dayWidthPx + LABEL_PAD, from + LABEL_EDGE);
    const font = getComputedStyle(el).font;
    const full = el.querySelector<HTMLElement>('[data-full]')?.textContent ?? '';
    const short = el.querySelector<HTMLElement>('[data-short]')?.textContent ?? '';
    const fit = shown >= textWidth(full, font) ? undefined : shown >= textWidth(short, font) ? 'short' : 'none';
    if (fit) el.dataset.fit = fit;
    else if (el.dataset.fit) delete el.dataset.fit;
  }
}

type Props = {
  days: Day[];
  labels: string[];
  headerSlots: HeaderSlot[];
  dayWidthPx: number;
  bodyWidthPx: number;
  /**
   * Width of the not-yet-loaded part after the last day, drawn as a placeholder with a spinner: one
   * day column while the next month loads on the phone's scroller (c9), the rest of a desktop page
   * whose days are still being read. 0: none.
   */
  pendingPx: number;
  /** The day whose pill is the tab stop (today, else the first). */
  tabDayIndex: number;
  onDayPress: (day: Day) => void;
  /** Where the row pins (desktop pages pin it under the site bar, on the page's scroll); default the scroller's top. */
  pinClassName?: string;
};

export const DayHeader = memo(function DayHeader({
  days,
  labels,
  headerSlots,
  dayWidthPx,
  bodyWidthPx,
  pendingPx,
  tabDayIndex,
  onDayPress,
  pinClassName,
}: Props) {
  const width = bodyWidthPx + pendingPx;
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
    <div className={cn('sticky top-0 z-sticky flex border-b border-hairline bg-surface', pinClassName)} style={{ height: HEADER_H, width: PINNED_W + width }}>
      <div
        aria-hidden
        className="t-caption sticky left-0 z-above flex shrink-0 items-center justify-center border-r border-hairline bg-surface text-muted"
        style={{ width: PINNED_W }}
      >
        Stand
      </div>
      <div role="group" aria-label="Zile" className="relative shrink-0" style={{ width }} onKeyDown={onKeyDown}>
        {days.map((day, i) => {
          const box = { left: day.dayIndex * dayWidthPx + 3, width: dayWidthPx - 6, top: 4, height: HEADER_DAY_H - 8 };
          return (
            <Fragment key={day.dayIndex}>
              <button
                type="button"
                data-day={day.dayIndex}
                tabIndex={day.dayIndex === tabDayIndex ? 0 : -1}
                onClick={() => onDayPress(day)}
                aria-label={`${labels[i]}, selectează toată ziua`}
                title={labels[i]}
                className={cn(
                  'peer absolute cursor-pointer rounded-lg bg-accent-tint',
                  'transition-[filter,opacity] duration-(--duration-fast) ease-fast hover:brightness-95 active:opacity-60',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                )}
                style={{ ...box, scrollMarginLeft: PINNED_W + 8 }}
              />
              {/* The label is a layer over its pill, not the pill's content (WebKit does not stick inside a
                  <button>): `sticky` keeps it on the visible part of a pill half under the frozen column
                  or past the right edge, and fitDayLabels drops the weekday («11 oct»), then the text,
                  when even that part is too narrow — a day never reads cut mid-word. */}
              <span
                aria-hidden
                data-day-label={day.dayIndex}
                className="group t-label pointer-events-none absolute flex items-center justify-center px-1 text-accent-ink transition-opacity duration-(--duration-fast) ease-fast [.peer:active+&]:opacity-60"
                style={box}
              >
                <span className="sticky max-w-full truncate" style={{ left: PINNED_W + LABEL_EDGE, right: LABEL_EDGE }}>
                  <span data-full className="group-data-[fit=none]:hidden group-data-[fit=short]:hidden">
                    {labels[i]}
                  </span>
                  <span data-short className="hidden group-data-[fit=short]:inline">
                    {`${day.date.getDate()} ${formatMonthAbbr(day.date)}`}
                  </span>
                </span>
              </span>
            </Fragment>
          );
        })}
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
        {pendingPx > 0 ? (
          <span
            data-testid="grid-next-spinner"
            className="absolute top-0 flex items-center justify-center bg-surface text-muted"
            style={{ left: bodyWidthPx, width: pendingPx, height: HEADER_H }}
          >
            <T4Spinner />
            <span className="sr-only">Se încarcă luna următoare…</span>
          </span>
        ) : null}
      </div>
    </div>
  );
});
