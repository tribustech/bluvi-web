import {
  BLOCK_REASON_LABELS,
  capitalize,
  differenceInCalendarDays,
  localDayKey,
  RO_MONTHS_ABBR,
  RO_MONTHS_WIDE,
  RO_WEEKDAYS_WIDE,
  scopeLabel,
  type AvailabilityBlockInput,
  type DayRange,
  type OfferedBlockReason,
} from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * operator.blocaj-nou — the pure half of «Adaugă blocaj» (fish features/operator/CreateBlockForm.tsx,
 * BlockCalendar.tsx, app/(app)/operator/[lakeId]/blocks.tsx handleCreate). Day keys are DEVICE-LOCAL
 * 'yyyy-MM-dd' (operator.b.local-day: core localDayKey, never toISOString). The screen keeps the
 * state; everything it says and sends is decided here.
 */

export const TITLE = 'Adaugă blocaj';
export const TITLE_ID = 'blocaj-nou-titlu';
export const FORM_ID = 'blocaj-nou-form';

/** fish DEFAULT_START_TIME / DEFAULT_END_TIME: whole days. */
export const DEFAULT_START_TIME = '00:00';
export const DEFAULT_END_TIME = '24:00';
/** fish CreateBlockForm `reason` default. */
export const DEFAULT_REASON: OfferedBlockReason = 'closure';
export const NOTE_MAX = 500;

export const COPY = {
  startRequired: 'Alege data de început.',
  endRequired: 'Alege data de sfârșit.',
  endAfterStart: 'Data de sfârșit trebuie să fie după data de început.',
  inPast: 'Perioada trebuie să fie în viitor.',
  noteTooLong: `Nota poate avea cel mult ${NOTE_MAX} de caractere.`,
  tapEnd: 'Apasă și ziua de sfârșit (aceeași zi pentru o singură zi).',
  checkData: 'Verifică datele blocajului.',
  saveFailed: 'Nu am putut adăuga blocajul.',
  keptRemaining: 'Am păstrat doar standurile rămase.',
} as const;

/* ------------------------------------------------------------------------------------------------
 * Hours (c9)
 * ---------------------------------------------------------------------------------------------- */

/** «De la ora»: 00:00 + the tour starts, never 24:00 (`options` = core blockTimeOptions). */
export const startHours = (options: string[]) => options.filter((t) => t !== '24:00');
/** «Până la ora»: the tour starts + 24:00, never 00:00. */
export const endHours = (options: string[]) => options.filter((t) => t !== '00:00');

/* ------------------------------------------------------------------------------------------------
 * Words (c8)
 * ---------------------------------------------------------------------------------------------- */

/** A device-local day key as a Date at local midnight. */
export function keyDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** fish dayLabel: `cap(format(parseISO(key), 'EEEE, d MMM', { locale: ro }))` — «Vineri, 5 sep». */
export function dayLabel(key: string): string {
  const d = keyDate(key);
  return capitalize(`${RO_WEEKDAYS_WIDE[d.getDay()]}, ${d.getDate()} ${RO_MONTHS_ABBR[d.getMonth()]}`);
}

/** Days in a picked range, both ends included. */
export const rangeDays = (range: Required<DayRange>) =>
  differenceInCalendarDays(keyDate(range.endDate), keyDate(range.startDate)) + 1;

/** The line under the calendar: what is picked so far, in words (fish selectionLine). */
export function selectionLine(range: DayRange): { text: string; complete: boolean } {
  if (!range.startDate) return { text: 'Apasă ziua de început, apoi ziua de sfârșit.', complete: false };
  if (!range.endDate) {
    return { text: `${dayLabel(range.startDate)} → apasă ziua de sfârșit (aceeași zi = o singură zi)`, complete: false };
  }
  const n = rangeDays({ startDate: range.startDate, endDate: range.endDate });
  return { text: `${dayLabel(range.startDate)} → ${dayLabel(range.endDate)} · ${formatCount(n, 'zi', 'zile')}`, complete: true };
}

/* ------------------------------------------------------------------------------------------------
 * Validation (c12 c13 c14) — fish's zod Schema, field by field, first message per field
 * ---------------------------------------------------------------------------------------------- */

export type BlockValues = { startDate: string; endDate: string; note: string };
export type BlockErrors = { startDate?: string; endDate?: string; note?: string };

/** The period fields only (fish setValue(…, { shouldValidate: true }) after every calendar / hour tap). */
export function validatePeriod(v: Pick<BlockValues, 'startDate' | 'endDate'>, nowMs: number): Pick<BlockErrors, 'startDate' | 'endDate'> {
  const out: BlockErrors = {};
  if (!v.startDate) out.startDate = COPY.startRequired;
  if (!v.endDate) out.endDate = COPY.endRequired;
  else if (!(Date.parse(v.endDate) > Date.parse(v.startDate))) out.endDate = COPY.endAfterStart;
  // Mirrors the server's BLOCK_IN_PAST so the operator hears it before the request.
  else if (!(Date.parse(v.endDate) > nowMs)) out.endDate = COPY.inPast;
  return out;
}

export function validateNote(note: string): string | undefined {
  return note.length > NOTE_MAX ? COPY.noteTooLong : undefined;
}

export function validateBlock(v: BlockValues, nowMs: number): BlockErrors {
  const out: BlockErrors = { ...validatePeriod(v, nowMs) };
  const note = validateNote(v.note);
  if (note) out.note = note;
  return out;
}

export const hasErrors = (e: BlockErrors) => Boolean(e.startDate || e.endDate || e.note);

/**
 * The red line under the calendar (fish CreateBlockForm:264-275): with a complete range the end's
 * own message; without one, «apasă și ziua de sfârșit» once a start is picked, else the first date
 * message.
 */
export function calendarError(errors: BlockErrors, range: DayRange): string | undefined {
  if (range.endDate) return errors.endDate;
  if (!errors.startDate && !errors.endDate) return undefined;
  return range.startDate ? COPY.tapEnd : errors.startDate || errors.endDate;
}

/** A rejected save (c14): the toast names the first invalid field; date errors scroll the calendar into view. */
export function rejectedSave(errors: BlockErrors, range: DayRange): { message: string; dateField: boolean } {
  const first = (['startDate', 'endDate', 'note'] as const).find((k) => errors[k]);
  const message =
    first === 'startDate' && range.startDate && !range.endDate ? COPY.tapEnd : (first && errors[first]) || COPY.checkData;
  return { message, dateField: first === 'startDate' || first === 'endDate' };
}

/* ------------------------------------------------------------------------------------------------
 * Save (c16 c17 c18)
 * ---------------------------------------------------------------------------------------------- */

/** One input per picked stand, in the order they were picked; one whole-lake input when none is. */
export function buildInputs(
  lakeId: string,
  standIds: string[],
  v: { startDate: string; endDate: string; reason: OfferedBlockReason; note: string },
): AvailabilityBlockInput[] {
  const note = v.note.trim();
  const base: AvailabilityBlockInput = {
    lake: lakeId,
    startDate: v.startDate,
    endDate: v.endDate,
    reason: v.reason,
    ...(note ? { note } : {}),
  };
  return standIds.length ? standIds.map((stand) => ({ ...base, stand })) : [base];
}

export const savedMessage = (n: number) => (n > 1 ? `${formatCount(n, 'blocaj', 'blocaje')} adăugate` : 'Blocaj adăugat');

/** The server's own sentence when it sent a code (bluCode), else fish's fallback. */
export function failureReason(error: unknown): string {
  const e = typeof error === 'object' && error !== null ? (error as { bluCode?: unknown; message?: unknown }) : null;
  return e && typeof e.bluCode === 'string' && typeof e.message === 'string' && e.message ? e.message : COPY.saveFailed;
}

/**
 * fish handleCreate's catch: prefixed «{done} din {n} blocaje adăugate.» once some stands saved
 * (formatCount: «20 din 21 de blocaje»). Web: the saved stands leave the selection (see the screen),
 * so a retry sends only the rest — said after the reason.
 */
export function failureMessage(done: number, total: number, error: unknown): string {
  const reason = failureReason(error);
  return done > 0 ? `${done} din ${formatCount(total, 'blocaj', 'blocaje')} adăugate. ${reason} ${COPY.keptRemaining}` : reason;
}

/** After a partial failure: the picked stands minus the ones that saved (a retry never duplicates). */
export function remainingStands(standIds: string[], saved: AvailabilityBlockInput[]): string[] {
  const done = new Set(saved.map((i) => i.stand).filter((id): id is string => Boolean(id)));
  return standIds.filter((id) => !done.has(id));
}

/** The bar's hint (web): a multi-stand save is several blocks, said before it is sent. */
export function saveHint(standCount: number): string | undefined {
  return standCount > 1 ? `Se adaugă ${formatCount(standCount, 'blocaj', 'blocaje')}, câte unul pe stand.` : undefined;
}

/** The aside summary's scope (core scopeLabel on the picked stands' names, in pick order). */
export function scopeText(standIds: string[], stands: { documentId: string; name: string }[]): string {
  const names = standIds.map((id) => stands.find((s) => s.documentId === id)?.name).filter((n): n is string => Boolean(n));
  return scopeLabel(names);
}

export const reasonLabel = (r: OfferedBlockReason) => BLOCK_REASON_LABELS[r];

/* ------------------------------------------------------------------------------------------------
 * Calendar (c4 c5 c6) and its keyboard (web)
 * ---------------------------------------------------------------------------------------------- */

export const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'] as const;
export const WEEKDAYS_WIDE = ['luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă', 'duminică'] as const;

/** The month `offset` months after the month of `todayKey`: title, Monday-first lead and its day keys. */
export function monthGrid(todayKey: string, offset: number): { title: string; lead: number; days: string[]; first: string } {
  const t = keyDate(todayKey);
  const first = new Date(t.getFullYear(), t.getMonth() + offset, 1);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: count }, (_, i) => localDayKey(new Date(first.getFullYear(), first.getMonth(), i + 1)));
  return {
    title: capitalize(`${RO_MONTHS_WIDE[first.getMonth()]} ${first.getFullYear()}`),
    // Monday-first offset of the 1st (getDay: 0 = Sunday).
    lead: (first.getDay() + 6) % 7,
    days,
    first: days[0],
  };
}

/** Months from today's month to the month of `key` (negative before it). */
export function monthOffsetOf(todayKey: string, key: string): number {
  const a = keyDate(todayKey);
  const b = keyDate(key);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/**
 * The availability page that holds the calendar's month `monthOffset` (counted from `todayKey`'s
 * month). Pages are counted from `nowKey`, the day the query was mounted with (its month windows
 * are pinned), so a form left open past a month's last midnight still maps each month to its own
 * page instead of treating the new month as page 0 (the old month's) and painting it green.
 */
export function pageIndexOf(nowKey: string, todayKey: string, monthOffset: number): number {
  return Math.max(0, monthOffsetOf(nowKey, monthGrid(todayKey, monthOffset).first));
}

export type DayStatus = 'selected' | 'past' | 'busy' | 'free' | 'unknown';

/**
 * fish's colours: the range indigo, past grey, touched by a booking or block red («Ocupat»), the
 * rest green («Liber»). Web, rule 4: while the month's page is still loading (or failed) a future
 * day is `unknown` (neutral), never a green it may not be.
 */
export function dayStatus(key: string, todayKey: string, range: DayRange, busy: Set<string> | null): DayStatus {
  if (isInRangeKey(key, range)) return 'selected';
  if (key < todayKey) return 'past';
  if (!busy) return 'unknown';
  return busy.has(key) ? 'busy' : 'free';
}

/** core isInRange (kept local so the status order above reads in one place). */
function isInRangeKey(day: string, range: DayRange): boolean {
  if (!range.startDate) return false;
  if (!range.endDate) return day === range.startDate;
  return day >= range.startDate && day <= range.endDate;
}

const STATUS_WORD: Record<DayStatus, string | null> = {
  selected: 'selectat',
  past: 'în trecut',
  busy: 'ocupat',
  free: 'liber',
  unknown: null,
};

/** A day button's accessible name: «vineri, 9 octombrie 2026, liber». */
export function dayName(key: string, status: DayStatus): string {
  const d = keyDate(key);
  const base = `${WEEKDAYS_WIDE[(d.getDay() + 6) % 7]}, ${d.getDate()} ${RO_MONTHS_WIDE[d.getMonth()]} ${d.getFullYear()}`;
  const word = STATUS_WORD[status];
  return word ? `${base}, ${word}` : base;
}

const addDaysKey = (key: string, n: number) => {
  const d = keyDate(key);
  return localDayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const addMonthsKey = (key: string, n: number) => {
  const d = keyDate(key);
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return localDayKey(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)));
};

/**
 * The APG date-grid keys: ←/→ a day, ↑/↓ a week, Home/End the week's Monday/Sunday, PageUp/PageDown a
 * month. Never before the first day of today's month (the calendar does not go back further).
 * `null`: not a navigation key.
 */
export function moveKey(key: string, k: string, todayKey: string): string | null {
  const dow = (keyDate(key).getDay() + 6) % 7;
  const next =
    k === 'ArrowLeft'
      ? addDaysKey(key, -1)
      : k === 'ArrowRight'
        ? addDaysKey(key, 1)
        : k === 'ArrowUp'
          ? addDaysKey(key, -7)
          : k === 'ArrowDown'
            ? addDaysKey(key, 7)
            : k === 'Home'
              ? addDaysKey(key, -dow)
              : k === 'End'
                ? addDaysKey(key, 6 - dow)
                : k === 'PageUp'
                  ? addMonthsKey(key, -1)
                  : k === 'PageDown'
                    ? addMonthsKey(key, 1)
                    : null;
  if (next === null) return null;
  const floor = monthGrid(todayKey, 0).first;
  return next < floor ? floor : next;
}

/** The roving tab stop of a month: the range start in it, else today in it, else its 1st. */
export function defaultFocus(days: string[], todayKey: string, range: DayRange): string {
  if (range.startDate && days.includes(range.startDate)) return range.startDate;
  if (days.includes(todayKey)) return todayKey;
  return days[0];
}
