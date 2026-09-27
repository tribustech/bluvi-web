import type { CompetitionPeriod } from './filters';
import type { CompetitionCardStatus } from '../schemas';

/**
 * The period options behind the `Perioadă` pills and the `Perioadă` chip.
 *
 * The months are **generated from `now`**, never written down: the HTML
 * prototype hardcoded "Septembrie 2026" / "Octombrie 2026" and would have
 * shipped an app that offers last year's autumn forever.
 *
 * Every boundary here mirrors `periodWindow` in the CMS
 * (`src/api/feed/services/competition-card-query.ts`) — the label a chip shows
 * and the window the server actually applies must be the same weekend. The one
 * difference is the timezone: the server resolves Bucharest days because it
 * answers for everybody, while these labels are for the phone in the user's
 * hand and read its local calendar.
 *
 * A hand-picked range travels as `YYYY-MM-DD..YYYY-MM-DD`, both days included.
 * Days rather than instants for the same reason the month value is a month: the
 * user picks squares on a calendar, and which instants those squares cover is
 * Bucharest's business, not the phone's.
 */

/** With the dot, as in `features/chat/domain/format.ts` — `sept.`, not date-fns' `sep`. */
const MONTHS_SHORT = [
  'ian.',
  'feb.',
  'mar.',
  'apr.',
  'mai',
  'iun.',
  'iul.',
  'aug.',
  'sept.',
  'oct.',
  'nov.',
  'dec.',
];

const MONTHS_LONG = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

const MONTH_PERIOD = /^(\d{4})-(\d{2})$/;
const CUSTOM_PERIOD = /^(\d{4})-(\d{2})-(\d{2})\.\.(\d{4})-(\d{2})-(\d{2})$/;

export interface CompetitionCustomPeriod {
  from: Date;
  to: Date;
}

export interface CompetitionPeriodOption {
  value: CompetitionPeriod;
  label: string;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** `YYYY-MM` for a calendar month, read from local parts. */
function monthValue(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

/**
 * Saturday of the current weekend. On Sunday this steps **back** one day rather
 * than forward six, so "weekendul acesta" never skips today's competitions —
 * the same rule the server applies.
 */
function saturdayOfThisWeekend(now: Date): Date {
  const today = startOfDay(now);
  const dow = today.getDay(); // 0 = Sunday
  const offsetToSaturday = dow === 0 ? -1 : (6 - dow) % 7;
  return addDays(today, offsetToSaturday);
}

/** `26–27 sept.` inside one month, `31 oct.–1 nov.` across two. */
function weekendDatesLabel(now: Date): string {
  const saturday = saturdayOfThisWeekend(now);
  const sunday = addDays(saturday, 1);
  const sundayMonth = MONTHS_SHORT[sunday.getMonth()];

  if (saturday.getMonth() === sunday.getMonth()) {
    return `${saturday.getDate()}–${sunday.getDate()} ${sundayMonth}`;
  }

  return `${saturday.getDate()} ${MONTHS_SHORT[saturday.getMonth()]}–${sunday.getDate()} ${sundayMonth}`;
}

function monthLabel(value: string): string | null {
  const match = MONTH_PERIOD.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;

  return `${MONTHS_LONG[month - 1]} ${year}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD` for a calendar day, read from local parts. */
function dayValue(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * A local midnight, or null when the parts do not name a real day: `new Date`
 * rolls 31 February over into March rather than refusing it, so the only way to
 * tell a date apart from a typo is to read it back.
 */
function localDay(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/**
 * The wire value for a hand-picked range. Ordering is part of the contract:
 * `periodWindow` in the CMS drops a backwards range and applies NO date filter
 * at all, which reaches the user as an unfiltered list — a filter that looks
 * like it did nothing. The picker clamps too; this keeps the value honest
 * whatever it is handed.
 */
export function customPeriodValue(from: Date, to: Date): string {
  const [first, last] = from.getTime() <= to.getTime() ? [from, to] : [to, from];
  return `${dayValue(first)}..${dayValue(last)}`;
}

/** The two local midnights behind a `YYYY-MM-DD..YYYY-MM-DD` value, or null. */
export function parseCustomPeriod(value: string): CompetitionCustomPeriod | null {
  const match = CUSTOM_PERIOD.exec(value);
  if (!match) return null;

  const from = localDay(Number(match[1]), Number(match[2]), Number(match[3]));
  const to = localDay(Number(match[4]), Number(match[5]), Number(match[6]));
  if (!from || !to || from.getTime() > to.getTime()) return null;

  return { from, to };
}

function shortDay(date: Date, withMonth: boolean, withYear: boolean): string {
  const parts = [String(date.getDate())];
  if (withMonth) parts.push(MONTHS_SHORT[date.getMonth()]);
  if (withYear) parts.push(String(date.getFullYear()));
  return parts.join(' ');
}

/**
 * `26–27 sept.` inside one month and `31 oct.–1 nov.` across two, the same
 * shape the weekend pill uses — a range the user drew and a range we offered
 * should not read as two different kinds of thing.
 *
 * The year appears only once the range leaves the current one, where `3–5 ian.`
 * would otherwise hide which January is meant.
 */
export function customPeriodLabel(from: Date, to: Date, now: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const currentYear = sameYear && from.getFullYear() === now.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();

  if (sameMonth && from.getDate() === to.getDate()) return shortDay(to, true, !currentYear);

  return `${shortDay(from, !sameMonth, !currentYear && !sameYear)}–${shortDay(to, true, !currentYear)}`;
}

/**
 * The presets a state can actually be combined with.
 *
 * `Încheiate` next to `Următoarele 7 zile` is a contradiction the screen used to
 * let you build: nothing has both finished and not started yet. So the state
 * chooses which windows exist — finished competitions look backwards, upcoming
 * ones forwards — and a mixed list, where both kinds are on screen, offers both
 * directions.
 *
 * Two months either way is the whole horizon on purpose: a competition calendar
 * further out is thin, and a year of month pills is a scroll tunnel, not a
 * filter. The calendar underneath answers anything past that.
 */
export function periodOptions(
  now: Date,
  status: CompetitionCardStatus | 'all' = 'all'
): CompetitionPeriodOption[] {
  const month = (delta: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + delta, 1);
    return monthValue(d.getFullYear(), d.getMonth());
  };
  const named = (value: string) => ({ value, label: monthLabel(value) as string });

  const anytime = { value: 'all', label: 'Oricând' };
  const ahead = [
    { value: 'next7', label: 'Următoarele 7 zile' },
    { value: 'weekend', label: `Weekendul acesta · ${weekendDatesLabel(now)}` },
  ];

  if (status === 'completed') {
    return [anytime, named(month(0)), named(month(-1)), named(month(-2))];
  }
  if (status === 'notStarted') {
    return [anytime, ...ahead, named(month(0)), named(month(1))];
  }
  return [anytime, ...ahead, named(month(0)), named(month(-1))];
}

/**
 * Whether a period can stand next to a state at all.
 *
 * A month or a hand-picked range is judged by where it sits relative to today:
 * a finished competition cannot start in a window that is entirely ahead, and
 * an upcoming one cannot start in a window that is entirely behind. `Oricând`
 * fits everything, and so does any window that straddles today.
 */
export function periodFitsStatus(
  period: string,
  status: CompetitionCardStatus | 'all',
  now: Date
): boolean {
  if (period === 'all' || status === 'all' || status === 'started') return true;

  // Both short windows open today, so they can only ever describe what is ahead.
  if (period === 'next7' || period === 'weekend') return status !== 'completed';

  const window = periodBounds(period);
  if (!window) return true;

  return status === 'completed' ? window.start <= now : window.end >= now;
}

/** Local start/end of a month value or a hand-picked range; null for anything else. */
function periodBounds(period: string): { start: Date; end: Date } | null {
  const month = MONTH_PERIOD.exec(period);
  if (month) {
    const y = Number(month[1]);
    const m = Number(month[2]);
    if (m < 1 || m > 12) return null;
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
  }

  const range = parseCustomPeriod(period);
  if (!range) return null;
  return { start: range.from, end: new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate(), 23, 59, 59, 999) };
}

/**
 * The rail is three chips wide on a phone, so the weekend chip drops the dates
 * the sheet pill carries — `Weekendul acesta · 26–27 sept.` alone would push
 * `Format` and `Resetează` off screen. A month value that is no longer offered
 * (kept from a previous session, or the month that just ended) is still named,
 * rather than reading as "no period" while the list is filtered.
 */
export function periodChipLabel(value: string, now: Date): string {
  if (value === 'next7' || value === 'weekend') {
    const option = periodOptions(now).find(o => o.value === value);
    return value === 'weekend' ? 'Weekendul acesta' : (option?.label ?? 'Perioadă');
  }

  const custom = parseCustomPeriod(value);
  if (custom) return customPeriodLabel(custom.from, custom.to, now);

  return monthLabel(value) ?? 'Perioadă';
}
