'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@/components/nav/IconButton';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { combineDateAndTime, dayKey, formatDay, formatTime } from './format';

/*
 * organizer.step-basics c8 — fish step-basics.tsx date picker (iOS: a sheet with a date spinner, a
 * «Ora / Data» switch row and «Confirmă» / «Anulează»; Android: the date dialog, then the 24 h time
 * dialog). On the web: one dialog in two steps.
 *  - «Data»: a month calendar (the RangeCalendar pattern of /concursuri, single day). Picking a day
 *    keeps the time already chosen (fish combineDateAndTime) and moves on to the time.
 *  - «Ora»: 24 h — the hour (00–23) and the minute (in 5-minute steps; a saved minute off that step
 *    stays until another is picked), then «Confirmă».
 * The switch row (fish's iOS row) goes back and forth between the two. «Confirmă» hands the
 * combined date to the step (which applies the start ≤ end rule and schedules the auto-save);
 * «Anulează», Escape or the X leave the value as it was.
 * Bounds: the month arrows stop at fish's constant ones (2000 – 2099); inside them the end's
 * calendar greys out the days before the start and the start's the days after the end (fish's
 * Android minimumDate / maximumDate), still reachable through the arrows. The time of day of a
 * same-day start / end is kept in order by getDateConstraintUpdates on confirm (c9).
 * The «Ora» step is ~640 px tall: the dialog fits the viewport and scrolls (scrollBody), with
 * «Anulează | Confirmă» side by side in a row pinned to its bottom, so a 550 px phone (iPhone SE
 * Safari, landscape) always reaches them.
 */

export type DatePickerStep = 'date' | 'time';

const WEEKDAYS = [
  { short: 'Lu', long: 'luni' },
  { short: 'Ma', long: 'marți' },
  { short: 'Mi', long: 'miercuri' },
  { short: 'Jo', long: 'joi' },
  { short: 'Vi', long: 'vineri' },
  { short: 'Sâ', long: 'sâmbătă' },
  { short: 'Du', long: 'duminică' },
];
const MONTH_TITLE = new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric' });
const DAY_LABEL = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const FIRST_YEAR = 2000;
const LAST_YEAR = 2099;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

type Props = {
  /** null: closed. */
  field: 'startDate' | 'endDate' | null;
  /** The date the picker opens on (the field's value, else now). */
  initial: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
  /** The first pickable day (the end's picker: the start's day). */
  minDay?: Date;
  /** The last pickable day (the start's picker: the end's day). */
  maxDay?: Date;
  /** Test seam for «today» (the calendar's ring); defaults to the clock. */
  now?: Date;
};

type Bounds = { minDay?: Date; maxDay?: Date };

export function DateTimeDialog({ field, initial, onCancel, onConfirm, minDay, maxDay, now }: Props) {
  const title = field === 'endDate' ? 'Data încheierii' : 'Data începerii';
  return (
    <Dialog open={field !== null} onClose={onCancel} title={title} closeButton scrollBody className="md:max-w-[440px]">
      {/* Remounted per opening: the draft starts from the field's value every time (fish setIosDraftDate). */}
      {field ? (
        <PickerBody
          key={`${field}-${initial.getTime()}`}
          initial={initial}
          onCancel={onCancel}
          onConfirm={onConfirm}
          minDay={minDay}
          maxDay={maxDay}
          now={now}
        />
      ) : null}
    </Dialog>
  );
}

function PickerBody({
  initial,
  onCancel,
  onConfirm,
  minDay,
  maxDay,
  now,
}: { initial: Date; onCancel: () => void; onConfirm: (d: Date) => void; now?: Date } & Bounds) {
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState<DatePickerStep>('date');
  const bodyRef = useRef<HTMLDivElement>(null);

  // A step change lands on that step's chosen control (the day, the hour), so the keyboard
  // continues where the eye goes; the first opening keeps the dialog's own initial focus.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    bodyRef.current?.querySelector<HTMLElement>('[data-current="true"]')?.focus();
  }, [step]);

  const confirm = () => onConfirm(draft);

  return (
    <div ref={bodyRef} className="flex flex-col gap-4" data-testid="date-picker" data-step={step}>
      <div className="flex items-baseline justify-between gap-3 rounded-control bg-accent-tint px-3 py-2.5">
        <span className="t-caption text-accent-ink">Selectat</span>
        <span className="t-body-strong tabular-nums text-accent-ink" data-testid="date-picker-draft" aria-live="polite">
          {formatDay(draft)}, {formatTime(draft)}
        </span>
      </div>

      {step === 'date' ? (
        <MonthCalendar
          value={draft}
          now={now ?? new Date()}
          minDay={minDay}
          maxDay={maxDay}
          onPick={(day) => {
            setDraft((d) => combineDateAndTime(day, d));
            setStep('time');
          }}
        />
      ) : (
        <TimeGrid value={draft} onChange={setDraft} />
      )}

      {/* fish's iOS switch row: «Ora 05:00 ›» on the date, «Data 14 noi 2026 ›» on the time. */}
      <button
        type="button"
        onClick={() => setStep((s) => (s === 'date' ? 'time' : 'date'))}
        className={cn(
          'flex min-h-12 cursor-pointer items-center gap-2.5 rounded-control bg-surface px-3.5 shadow-e0 outline-1 -outline-offset-1 outline-hairline',
          'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-70',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
        data-testid="date-picker-switch"
      >
        {step === 'date' ? <ClockIcon aria-hidden className="size-5 text-accent-ink" /> : <CalendarDaysIcon aria-hidden className="size-5 text-accent-ink" />}
        <span className="t-body-strong text-ink">{step === 'date' ? 'Ora' : 'Data'}</span>
        <span className="ml-auto flex items-center gap-1 t-body-strong tabular-nums text-accent-ink">
          {step === 'date' ? formatTime(draft) : formatDay(draft)}
          <ChevronRightIcon aria-hidden className="size-4" />
        </span>
      </button>

      {/* Pinned to the bottom of the dialog's scrolling body: its p-5 bled out (-bottom-5, since a sticky box is held inside the container's padding), hairline above. */}
      <div
        className="sticky -bottom-5 z-above -mx-5 -mb-5 grid grid-cols-2 gap-2 border-t border-hairline bg-surface px-5 pt-3 pb-5"
        data-testid="date-picker-actions"
      >
        <Button variant="secondary" onClick={onCancel}>
          Anulează
        </Button>
        {step === 'date' ? (
          <Button onClick={() => setStep('time')}>Alege ora</Button>
        ) : (
          <Button onClick={confirm} data-testid="date-picker-confirm">
            Confirmă
          </Button>
        )}
      </div>
    </div>
  );
}

/* ── «Data»: one month, Monday first ─────────────────────────────────────────────────────────── */

function MonthCalendar({ value, now, minDay, maxDay, onPick }: { value: Date; now: Date; onPick: (day: Date) => void } & Bounds) {
  const [month, setMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const days = useMemo(() => {
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1));
  }, [month]);
  const lead = (month.getDay() + 6) % 7;
  const raw = MONTH_TITLE.format(month);
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);
  const selectedKey = dayKey(value);
  const todayKey = dayKey(now);
  const minKey = minDay ? dayKey(minDay) : null;
  const maxKey = maxDay ? dayKey(maxDay) : null;
  const canPrev = month.getFullYear() > FIRST_YEAR || month.getMonth() > 0;
  const canNext = month.getFullYear() < LAST_YEAR || month.getMonth() < 11;
  const shift = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));

  return (
    <div className="flex flex-col gap-2.5" data-testid="date-picker-calendar">
      <div className="flex items-center justify-between">
        <IconButton aria-label="Luna anterioară" disabled={!canPrev} onClick={() => shift(-1)} className="disabled:cursor-default disabled:opacity-30 [&>svg]:size-5">
          <ChevronLeftIcon aria-hidden />
        </IconButton>
        <p aria-live="polite" className="t-body-strong text-ink-2" data-testid="date-picker-month">
          {title}
        </p>
        <IconButton aria-label="Luna următoare" disabled={!canNext} onClick={() => shift(1)} className="disabled:cursor-default disabled:opacity-30 [&>svg]:size-5">
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
        {days.map((day) => {
          const key = dayKey(day);
          const selected = key === selectedKey;
          const today = key === todayKey;
          // YYYY-MM-DD keys compare as dates.
          const outside = (minKey !== null && key < minKey) || (maxKey !== null && key > maxKey);
          return (
            <span key={key} className="h-11 p-0.5">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${DAY_LABEL.format(day)}${today ? ', azi' : ''}`}
                data-day={key}
                data-current={selected || undefined}
                disabled={outside}
                onClick={() => onPick(day)}
                className={cn(
                  'flex size-full cursor-pointer items-center justify-center rounded-control t-body tabular-nums',
                  'transition-[background-color,color] duration-(--duration-fast) ease-select',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  outside
                    ? 'cursor-not-allowed text-faint'
                    : selected
                    ? 't-body-strong bg-accent-ink text-on-accent'
                    : today
                      ? 't-body-strong text-accent-ink outline-1 -outline-offset-2 outline-accent hover:bg-accent-tint-2'
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

/* ── «Ora»: 24 h, hour then minute ───────────────────────────────────────────────────────────── */

function TimeGrid({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const h = value.getHours();
  const m = value.getMinutes();
  const set = (hours: number, minutes: number) => {
    const next = new Date(value);
    next.setHours(hours, minutes, 0, 0);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-4" data-testid="date-picker-time">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 t-label text-ink-2">Ora</legend>
        <div className="grid grid-cols-6 gap-1.5">
          {HOURS.map((hour) => (
            <Chip key={hour} label={pad(hour)} spoken={`ora ${pad(hour)}`} selected={hour === h} onClick={() => set(hour, m)} />
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 t-label text-ink-2">Minutul</legend>
        <div className="grid grid-cols-6 gap-1.5">
          {MINUTES.map((minute) => (
            <Chip key={minute} label={`:${pad(minute)}`} spoken={`minutul ${pad(minute)}`} selected={minute === m} onClick={() => set(h, minute)} />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function Chip({ label, spoken, selected, onClick }: { label: string; spoken: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={spoken}
      data-current={selected || undefined}
      onClick={onClick}
      className={cn(
        'flex h-10 cursor-pointer items-center justify-center rounded-control t-body tabular-nums',
        'transition-[background-color,color] duration-(--duration-fast) ease-select',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected ? 't-body-strong bg-accent-ink text-on-accent' : 'bg-soft-fill text-ink-2 hover:bg-accent-tint-2',
      )}
    >
      {label}
    </button>
  );
}
