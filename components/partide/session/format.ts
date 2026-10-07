import { fmtDurationShort, fmtKg, type CommunitySessionDetailCatchDTO, type CommunitySessionDetailDTO } from '@/core/partide';

/*
 * The partidă page's wall-clock words (fish format.ts fmtClock / fmtRecordDate / fmtPastCardMeta,
 * which read the PHONE's time zone). The web renders on a server too, so every clock and date here
 * is read in Europe/Bucharest (the app's wall clock): server and browser print the same string and
 * a viewer abroad sees the times the anglers saw. Pure, unit-tested (tests/unit/partide-session-format.test.ts).
 */

const ZONE = 'Europe/Bucharest';

const CLOCK = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, day: 'numeric', month: 'numeric', year: 'numeric' });

/** fish format.ts MONTH_ABBR_RO (record date, past-card meta — «NOV», as fish). */
const MONTHS = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_LONG = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];

const valid = (iso: string) => !Number.isNaN(new Date(iso).getTime());

function parts(iso: string) {
  const p = Object.fromEntries(DAY.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { day: Number(p.day), month: Number(p.month), year: Number(p.year) };
}

/** fish fmtClock: «14:05». */
export function clockRo(iso: string): string {
  return valid(iso) ? CLOCK.format(new Date(iso)) : '';
}

/** fish fmtRecordDate: «30 IUL». */
export function dayMonthRo(iso: string): string {
  if (!valid(iso)) return '';
  const p = parts(iso);
  return `${p.day} ${MONTHS[p.month - 1]}`;
}

/** «30 iulie 2026» — the machine-readable <time>'s visible twin in JSON-LD / alt text. */
export function longDateRo(iso: string): string {
  if (!valid(iso)) return '';
  const p = parts(iso);
  return `${p.day} ${MONTHS_LONG[p.month - 1]} ${p.year}`;
}

/** fish catchCaption: «Crap · 3,4 kg · 14:30», legs omitted when missing (hero, lightbox). */
export function catchCaption(c: Pick<CommunitySessionDetailCatchDTO, 'species' | 'weightKg' | 'occurredAt'>): string {
  return [c.species, c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null, clockRo(c.occurredAt)].filter(Boolean).join(' · ');
}

/** An ended partidă's length in ms (fish: `durationMs ?? endedAt − startedAt`); null while live. */
export function durationMsOf(d: Pick<CommunitySessionDetailDTO, 'startedAt' | 'endedAt' | 'durationMs'>): number | null {
  if (!d.endedAt) return null;
  return d.durationMs ?? new Date(d.endedAt).getTime() - new Date(d.startedAt).getTime();
}

/** fish fmtDurationShort of an ended partidă («6h», «45m»); null while live. */
export function durationLabel(d: Pick<CommunitySessionDetailDTO, 'startedAt' | 'endedAt' | 'durationMs'>): string | null {
  const ms = durationMsOf(d);
  return ms == null ? null : fmtDurationShort(ms);
}

/**
 * A fish duration as the web prints it in running text — the unit apart (owner rule 10), the same
 * words as the «durată» tile: «6h» → «6 h», «45m» → «45 min», «de 2h» → «de 2 h». A no-break
 * space keeps the number and its unit on one line.
 */
export function spacedDuration(label: string): string {
  return label.replace(/(\d+)\s*([hm])$/, (_, n: string, u: string) => `${n}\u00a0${u === 'h' ? 'h' : 'min'}`);
}

/**
 * fish fmtPastCardMeta(…, includeCaptures = false) for the venue card: «30 IUL · 6 h», or
 * «30 IUL · în desfășurare» while live.
 */
export function pastCardMeta(d: Pick<CommunitySessionDetailDTO, 'startedAt' | 'endedAt' | 'durationMs'>): string {
  const ended = durationLabel(d);
  return `${dayMonthRo(d.startedAt)} · ${ended ? spacedDuration(ended) : 'în desfășurare'}`;
}
