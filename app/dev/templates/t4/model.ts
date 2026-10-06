import * as z from 'zod';
import {
  indexExceptions,
  resolveSlotStatus,
  zonedWallTimeToUtc,
  RO_MONTHS_ABBR,
  RO_WEEKDAYS_SHORT,
  type BlockInfo,
  type LakeAvailability,
} from '@/core/booking';

/*
 * Pure model of the T4 demo's first user screen — fish `app/(app)/book-lake/[lakeId]/*` reduced to
 * the template's needs: day + start + duration + stand (fish picks the same four on its grid),
 * extras, contact. Everything is computed in the LAKE's time zone, as fish's grid is.
 */

// ── Lake-local calendar ───────────────────────────────────────────────────────────────────────────

type Wall = { y: number; m: number; d: number; hh: number; mm: number; wd: number };

/** The wall clock of `instant` in `timeZone` (Intl, so DST is the platform's). */
export function wallParts(instant: Date, timeZone: string): Wall {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { y: +get('year'), m: +get('month'), d: +get('day'), hh: +get('hour'), mm: +get('minute'), wd };
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** «sâ 11 oct., 18:00» — fish booking period style, in the lake's zone. */
export function formatSlot(iso: string, timeZone: string): string {
  const w = wallParts(new Date(iso), timeZone);
  return `${RO_WEEKDAYS_SHORT[w.wd]} ${w.d} ${RO_MONTHS_ABBR[w.m - 1]}, ${pad2(w.hh)}:${pad2(w.mm)}`;
}

export type DayOption = { key: string; y: number; m: number; d: number; weekday: string; day: number; month: string };

/**
 * The next `count` lake-local days that still have a start time outside the lead window (fish:
 * a slot under `leadHours` is «too soon» — by phone only) and inside the availability window.
 */
export function dayOptions(av: LakeAvailability, nowMs: number, count = 14): DayOption[] {
  const tz = av.timezone;
  const lead = (av.leadHours ?? 24) * 3600_000;
  const windowEnd = new Date(av.window.to).getTime();
  const today = wallParts(new Date(nowMs), tz);
  const out: DayOption[] = [];
  for (let i = 0; i < 60 && out.length < count; i++) {
    const noon = zonedWallTimeToUtc(today.y, today.m, today.d + i, 12 * 60, tz);
    const w = wallParts(noon, tz);
    const starts = av.slotStartTimes.map((t) => zonedWallTimeToUtc(w.y, w.m, w.d, minutesOf(t), tz).getTime());
    if (starts.every((s) => s < nowMs + lead)) continue;
    if (Math.min(...starts) >= windowEnd) break;
    out.push({
      key: `${w.y}-${pad2(w.m)}-${pad2(w.d)}`,
      y: w.y,
      m: w.m,
      d: w.d,
      weekday: RO_WEEKDAYS_SHORT[w.wd],
      day: w.d,
      month: RO_MONTHS_ABBR[w.m - 1],
    });
  }
  return out;
}

/**
 * Lake-local days before the first bookable one that still have a start ahead of now — inside the
 * lead window, so fish sends them to the phone («too soon»). At most `count` (today, tomorrow).
 */
export function tooSoonDayOptions(av: LakeAvailability, nowMs: number, count = 2): DayOption[] {
  const tz = av.timezone;
  const lead = (av.leadHours ?? 24) * 3600_000;
  const today = wallParts(new Date(nowMs), tz);
  const out: DayOption[] = [];
  for (let i = 0; i < count + 1 && out.length < count; i++) {
    const noon = zonedWallTimeToUtc(today.y, today.m, today.d + i, 12 * 60, tz);
    const w = wallParts(noon, tz);
    const starts = av.slotStartTimes.map((t) => zonedWallTimeToUtc(w.y, w.m, w.d, minutesOf(t), tz).getTime());
    if (!starts.some((s) => s > nowMs)) continue;
    if (!starts.every((s) => s < nowMs + lead)) break;
    out.push({
      key: `${w.y}-${pad2(w.m)}-${pad2(w.d)}`,
      y: w.y,
      m: w.m,
      d: w.d,
      weekday: RO_WEEKDAYS_SHORT[w.wd],
      day: w.d,
      month: RO_MONTHS_ABBR[w.m - 1],
    });
  }
  return out;
}

/** Start times on `day` still bookable (outside the lead window). */
export function startOptions(av: LakeAvailability, day: DayOption | undefined, nowMs: number) {
  const lead = (av.leadHours ?? 24) * 3600_000;
  return av.slotStartTimes.map((t) => {
    const ok = !!day && zonedWallTimeToUtc(day.y, day.m, day.d, minutesOf(t), av.timezone).getTime() >= nowMs + lead;
    return { value: t, disabled: !ok };
  });
}

/**
 * Tour lengths the lake sells from this start: multiples of the increment from the minimum,
 * at most four (or up to `maxDurationHours`), without the ones ending at a forbidden time.
 */
export function durationOptions(av: LakeAvailability, start: string): number[] {
  const inc = av.incrementHours;
  const min = av.minDurationHours ?? inc;
  const max = av.maxDurationHours ?? min + inc * 3;
  const forbidden = new Set(av.forbiddenEndTimes ?? []);
  const out: number[] = [];
  for (let h = min; h <= max && out.length < 4; h += inc) {
    const endMinutes = (minutesOf(start) + h * 60) % (24 * 60);
    if (!forbidden.has(`${pad2(Math.floor(endMinutes / 60))}:${pad2(endMinutes % 60)}`)) out.push(h);
  }
  return out;
}



export type Interval = { startISO: string; endISO: string };

export function intervalOf(av: LakeAvailability, day: DayOption, start: string, hours: number): Interval {
  const s = zonedWallTimeToUtc(day.y, day.m, day.d, minutesOf(start), av.timezone);
  return { startISO: s.toISOString(), endISO: new Date(s.getTime() + hours * 3600_000).toISOString() };
}

// ── Stands ────────────────────────────────────────────────────────────────────────────────────────

export type StandOption = {
  documentId: string;
  name: string;
  extras: string[];
  /** `unknown`: no interval yet — nothing can be said about the stand, never «Liber». */
  status: 'available' | 'booked' | 'blocked' | 'unknown';
  block: BlockInfo | null;
};

/** Every stand with its verdict for the interval (fish `resolveSlotStatus`, backend precedence). */
export function standOptions(av: LakeAvailability, interval: Interval | null, nowMs: number): StandOption[] {
  const idx = indexExceptions(av.bookings, av.blocks);
  return av.stands.map((s) => {
    if (!interval) return { documentId: s.documentId, name: s.name, extras: s.extras, status: 'unknown', block: null };
    const v = resolveSlotStatus(s.documentId, { start: interval.startISO, end: interval.endISO }, idx, nowMs, av.leadHours ?? 24);
    return { documentId: s.documentId, name: s.name, extras: s.extras, status: v.status, block: v.block };
  });
}

/** No stand is free for any start × duration the lake sells on `day` (the day picker marks it «complet»). */
export function dayIsFull(av: LakeAvailability, day: DayOption, nowMs: number): boolean {
  for (const o of startOptions(av, day, nowMs)) {
    if (o.disabled) continue;
    for (const h of durationOptions(av, o.value)) {
      if (standOptions(av, intervalOf(av, day, o.value, h), nowMs).some((s) => s.status === 'available')) return false;
    }
  }
  return true;
}

/** A block's reason in the stand card (fish CompetitionBlockSheet wording, shortened). */
export function blockText(block: BlockInfo | null): string {
  if (!block) return 'Indisponibil';
  if (block.reason === 'competition') return block.label ? `Concurs: ${block.label}` : 'Concurs pe baltă';
  if (block.reason === 'unavailable') return 'Nu se rezervă online';
  return block.label ? `Închis: ${block.label}` : 'Închis de administrator';
}

// ── Validation (per step) ─────────────────────────────────────────────────────────────────────────

/** Step 1 — the fish grid cannot advance without a stand and an interval. */
export const intervalStepSchema = z.object({
  day: z.string().min(1, 'Alege ziua sosirii.'),
  start: z.string().min(1, 'Alege ora de început.'),
  hours: z.number({ error: 'Alege durata.' }).positive('Alege durata.'),
  stand: z.string().min(1, 'Alege un stand liber.'),
});

/*
 * Step 3 — fish `review.tsx` ContactSchema + `schemas/phone.schema.ts` (verbatim rules and copy).
 * TODO(core/booking): the phone rule belongs in core (fish schemas/phone.schema.ts is not ported
 * yet); this demo may only touch its own folder.
 */
export const PHONE_REGEX = /^\+?\d{7,15}$/;
const PHONE_ERROR = 'Numărul de telefon trebuie să aibă între 7 și 15 cifre';
export const phoneSchema = z.string().trim().min(1, 'Adaugă un număr de telefon.').regex(PHONE_REGEX, PHONE_ERROR);
export function sanitizePhoneInput(text: string): string {
  const plus = text.trimStart().startsWith('+') ? '+' : '';
  return plus + text.replace(/\D/g, '');
}
export const contactSchema = z.object({
  contactFullname: z.string().trim().min(1, 'Acest câmp este obligatoriu'),
  contactPhone: phoneSchema,
  notes: z.string().trim().max(1000, 'Ai voie maxim 1000 de caractere').optional(),
});
export type Contact = z.infer<typeof contactSchema>;

const LEI_WHOLE = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
const LEI_CENTS = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Money in Romanian: «1.250 lei», «37,50 lei» (a deposit share keeps both decimals, never «37.5»).
 * ro-RO only groups from 10.000 by CLDR default, so `useGrouping: 'always'` is not enough on every
 * engine — the thousands dot is forced for 4-digit amounts too.
 * TODO(core): move to core/booking (or lib/format) when the real booking screen lands.
 */
export function formatLei(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const text = (Number.isInteger(rounded) ? LEI_WHOLE : LEI_CENTS).format(rounded);
  const [int, dec] = text.split(',');
  const grouped = int.replace(/\./g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${dec ? `${grouped},${dec}` : grouped} lei`;
}
