'use client';

import { useMemo, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@/components/nav/IconButton';
import { cn } from '@/components/ui/cn';
import { isInRange, localDayKey, nextRange, type DayRange } from '@/core/booking';

/*
 * fish features/competitions/components/CompetitionRangeCalendar.tsx — a month calendar for a
 * competition period: tap the first day, tap the last (filters.c9). The range rules are the
 * operator's (core/booking blockCalendarLogic, as in fish); a day is only past (disabled), plain,
 * inside the range, or one of its ends.
 */

const WEEKDAYS = [
  { short: 'Lu', long: 'luni' },
  { short: 'Ma', long: 'marți' },
  { short: 'Mi', long: 'miercuri' },
  { short: 'Jo', long: 'joi' },
  { short: 'Vi', long: 'vineri' },
  { short: 'Sâ', long: 'sâmbătă' },
  { short: 'Du', long: 'duminică' },
];
/** No competition list reaches this far; it only stops the arrows running forever. */
const MAX_MONTHS_AHEAD = 24;

const MONTH_TITLE = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' });
const DAY_LABEL = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });

export function RangeCalendar({ value, onChange, now }: { value: DayRange; onChange: (range: DayRange) => void; now: Date }) {
  // Opens on the month of the range's start when one is set (never before the current month).
  const [offset, setOffset] = useState(() => {
    if (!value.startDate) return 0;
    const [y, m] = value.startDate.split('-').map(Number);
    return Math.min(MAX_MONTHS_AHEAD, Math.max(0, (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth())));
  });
  const month = useMemo(() => new Date(now.getFullYear(), now.getMonth() + offset, 1), [now, offset]);
  const days = useMemo(() => {
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1));
  }, [month]);
  const todayKey = localDayKey(now);
  // Monday-first offset of the 1st (getDay: 0 = Sunday).
  const lead = (month.getDay() + 6) % 7;
  const raw = MONTH_TITLE.format(month);
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <IconButton aria-label="Luna anterioară" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - 1))} className="disabled:cursor-default disabled:opacity-30 [&>svg]:size-5">
          <ChevronLeftIcon aria-hidden />
        </IconButton>
        <p aria-live="polite" className="t-body-strong text-ink-2">
          {title}
        </p>
        <IconButton
          aria-label="Luna următoare"
          disabled={offset >= MAX_MONTHS_AHEAD}
          onClick={() => setOffset((o) => Math.min(MAX_MONTHS_AHEAD, o + 1))}
          className="disabled:cursor-default disabled:opacity-30 [&>svg]:size-5"
        >
          <ChevronRightIcon aria-hidden />
        </IconButton>
      </div>

      <div role="group" aria-label={title} className="grid grid-cols-7">
        {WEEKDAYS.map((w) => (
          <abbr key={w.short} title={w.long} className="flex h-6 items-center justify-center t-micro-strong text-muted no-underline">
            {w.short}
          </abbr>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} aria-hidden />
        ))}
        {days.map((day, i) => {
          const key = localDayKey(day);
          const past = key < todayKey;
          const selected = isInRange(key, value);
          const isStart = key === value.startDate;
          const isEnd = key === value.endDate;
          const edge = isStart || isEnd;
          // One continuous band from the first day to the last (the in-range fill is the cell's, with
          // no gap between cells), rounded where it starts, ends, or wraps at a week's edge; the two
          // ends sit on top of it as solid days.
          const span = Boolean(value.startDate && value.endDate && value.startDate !== value.endDate) && selected;
          const col = (lead + i) % 7;
          const bandStart = isStart || col === 0 || i === 0;
          const bandEnd = isEnd || col === 6 || i === days.length - 1;
          return (
            <span key={key} className="relative h-11 py-0.5">
              {span ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-0.5 bg-accent-tint',
                    isStart ? 'left-1/2' : 'left-0',
                    isEnd ? 'right-1/2' : 'right-0',
                    !isStart && bandStart && 'rounded-l-control',
                    !isEnd && bandEnd && 'rounded-r-control',
                  )}
                />
              ) : null}
              <button
                type="button"
                disabled={past}
                aria-pressed={selected}
                aria-label={DAY_LABEL.format(day)}
                data-day={key}
                onClick={() => onChange(nextRange(value, key))}
                className={cn(
                  'relative flex size-full cursor-pointer items-center justify-center rounded-control t-body tabular-nums',
                  'transition-[background-color,color] duration-(--duration-fast) ease-select',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  past
                    ? 'cursor-default text-faint'
                    : edge
                      ? 't-body-strong bg-accent-ink text-on-accent'
                      : selected
                        ? 'text-accent-ink hover:bg-accent-tint-2'
                        : 'text-ink-2 hover:bg-soft-fill',
                )}
              >
                {day.getDate()}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
