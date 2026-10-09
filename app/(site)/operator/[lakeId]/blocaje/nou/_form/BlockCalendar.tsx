'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { iconButtonClass } from '@/components/nav/IconButton';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { DayRange } from '@/core/booking';
import { dayName, dayStatus, defaultFocus, monthGrid, monthOffsetOf, moveKey, WEEKDAYS, type DayStatus } from './model';

/*
 * fish features/operator/BlockCalendar.tsx — the month calendar of a block's period (c4 c5 c6 c7):
 * Monday-first, today's month first, ‹ off on it, › unbounded; title «{Luna yyyy}» with a spinner
 * beside it while the month's availability page loads. Colours: the picked range indigo (accent),
 * past days grey and not pickable, days a booking or block touches red («Ocupat»), the rest green
 * («Liber»), legend under it.
 *
 * Web: an APG date grid — one tab stop (the roving day), ←/→/↑/↓ by day and week, Home/End the
 * week, PageUp/PageDown the month (crossing a month edge turns the page), Enter/Space picks;
 * aria-selected on the range's cells, aria-disabled on past days. Rule 4: a month whose page is
 * still loading (or failed) paints its future days neutral, never a green it may not be.
 */

const STATUS_CELL: Record<DayStatus, string> = {
  selected: 'bg-accent text-on-accent t-body-strong',
  past: 'bg-soft-fill text-faint cursor-not-allowed',
  busy: 'bg-status-danger-bg text-status-danger-fg hover:brightness-95',
  free: 'bg-status-success-bg text-status-success-fg hover:brightness-95',
  unknown: 'bg-surface text-ink-2 shadow-e0 hover:bg-soft-fill',
};

type Props = {
  todayKey: string;
  monthOffset: number;
  onMonthOffset: (offset: number) => void;
  range: DayRange;
  onPick: (key: string) => void;
  /** Busy days of the loaded pages; null = unknown. */
  busy: Set<string> | null;
  /** The month on screen has its page. */
  covered: boolean;
  monthLoading: boolean;
  monthFailed: boolean;
  onRetryMonth: () => void;
  /** id of the error line under the calendar (the grid's description). */
  describedBy?: string;
  disabled?: boolean;
  /** The roving day button (the screen focuses it after a rejected save). */
  focusRef?: Ref<HTMLButtonElement>;
};

export function BlockCalendar({
  todayKey,
  monthOffset,
  onMonthOffset,
  range,
  onPick,
  busy,
  covered,
  monthLoading,
  monthFailed,
  onRetryMonth,
  describedBy,
  disabled,
  focusRef,
}: Props) {
  const month = monthGrid(todayKey, monthOffset);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const roving = focusKey && month.days.includes(focusKey) ? focusKey : defaultFocus(month.days, todayKey, range);
  // Set by a key press: after the render that shows the new day, focus moves to it.
  const wantFocus = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${roving}"]`)?.focus();
  }, [roving]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = moveKey(roving, e.key, todayKey);
    if (!next) return;
    e.preventDefault();
    const off = monthOffsetOf(todayKey, next);
    if (off !== monthOffset) onMonthOffset(off);
    wantFocus.current = true;
    setFocusKey(next);
  };

  const dayBusy = covered ? busy : null;
  const titleId = `blocaj-luna-${month.first}`;
  // Weeks of 7 cells: blanks before the 1st, then the days, then blanks to close the last row.
  const cells: (string | null)[] = [...Array.from({ length: month.lead }, () => null), ...month.days];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <div className="flex flex-col gap-3" data-testid="block-calendar">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={iconButtonClass({ className: 'disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent' })}
          aria-label="Luna anterioară"
          disabled={monthOffset === 0 || disabled}
          onClick={() => onMonthOffset(Math.max(0, monthOffset - 1))}
        >
          <ChevronLeftIcon aria-hidden />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <h3 id={titleId} aria-live="polite" className="t-heading text-ink" data-testid="block-calendar-title">
            {month.title}
          </h3>
          {monthLoading ? (
            <span role="status" className="flex items-center" data-testid="block-calendar-spinner">
              <ArrowPathIcon aria-hidden className="size-4 text-muted motion-safe:animate-spin" />
              <span className="sr-only">Se încarcă luna…</span>
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={iconButtonClass({ className: 'disabled:cursor-not-allowed disabled:text-faint' })}
          aria-label="Luna următoare"
          disabled={disabled}
          onClick={() => onMonthOffset(monthOffset + 1)}
        >
          <ChevronRightIcon aria-hidden />
        </button>
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        aria-busy={monthLoading || undefined}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-1"
        data-testid="block-calendar-grid"
      >
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className="t-caption py-1 text-center text-muted">
              {w}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7 gap-1">
            {week.map((key, di) => {
              if (!key) return <span key={`e${di}`} role="gridcell" aria-hidden className="h-11 md:h-12 xl:h-13" />;
              const status = dayStatus(key, todayKey, range, dayBusy);
              const past = status === 'past';
              const isToday = key === todayKey;
              return (
                <span key={key} role="gridcell" aria-selected={past ? undefined : status === 'selected'} className="flex">
                  <button
                    ref={key === roving ? focusRef : undefined}
                    type="button"
                    data-day={key}
                    data-status={status}
                    tabIndex={key === roving ? 0 : -1}
                    aria-disabled={past || disabled || undefined}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={dayName(key, status)}
                    onFocus={() => setFocusKey(key)}
                    onClick={() => {
                      if (past || disabled) return;
                      setFocusKey(key);
                      onPick(key);
                    }}
                    className={cn(
                      't-body tabular-nums flex h-11 w-full items-center justify-center rounded-control transition-[background-color,filter] duration-(--duration-fast) ease-fast md:h-12 xl:h-13',
                      'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      status !== 'selected' && 'font-semibold',
                      !past && !disabled && 'cursor-pointer',
                      isToday && status !== 'selected' && 'underline decoration-2 underline-offset-4',
                      STATUS_CELL[status],
                    )}
                  >
                    {Number(key.slice(8))}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {monthFailed ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-status-danger-bg px-3 py-2">
          <p className="t-caption text-status-danger-fg">Nu am putut încărca ocuparea pentru {month.title.toLowerCase()}.</p>
          <Button size="compact" variant="dangerOutline" onClick={onRetryMonth}>
            Reîncearcă
          </Button>
        </div>
      ) : null}

      <ul aria-label="Legendă" className="flex items-center gap-4">
        <li className="t-caption flex items-center gap-1.5 text-muted">
          <span aria-hidden className="size-3.5 shrink-0 rounded-sm border border-status-success-fg bg-status-success-bg" />
          Liber
        </li>
        <li className="t-caption flex items-center gap-1.5 text-muted">
          <span aria-hidden className="size-3.5 shrink-0 rounded-sm border border-status-danger-fg bg-status-danger-bg" />
          Ocupat
        </li>
      </ul>
    </div>
  );
}

/** The calendar's box while the first page loads (same header, weekday row and 6 rows). */
export function BlockCalendarSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <div className="flex h-12 items-center justify-center xl:h-10">
        <span className="h-4 w-32 animate-shimmer rounded-full bg-soft-fill" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }, (_, i) => (
          <span key={i} className="block h-11 animate-shimmer rounded-control bg-soft-fill md:h-12 xl:h-13" />
        ))}
      </div>
      <span className="h-3 w-32 animate-shimmer rounded-full bg-soft-fill" />
    </div>
  );
}
