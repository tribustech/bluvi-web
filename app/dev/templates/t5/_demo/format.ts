/**
 * Copy helpers of the operator panel demo (fish app/(app)/operator/[lakeId]/index.tsx). Pure; the
 * real /operator/[lakeId] page (M7) should lift them into core/booking/domain.
 */

const TZ = 'Europe/Bucharest';

/** fish `waitedLabel`: «de 25 min» / «de 6 ore» / «de 2 zile». */
export function waitedLabel(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `de ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `de ${hours} ${hours === 1 ? 'oră' : 'ore'}`;
  const days = Math.floor(hours / 24);
  return `de ${days} ${days === 1 ? 'zi' : 'zile'}`;
}

/** fish `format(new Date(), 'EEEE d MMM', { locale: ro })` → «Azi, sâmbătă 4 oct.» */
export function todayCaption(nowMs: number): string {
  const d = new Date(nowMs);
  const weekday = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', timeZone: TZ }).format(d);
  const day = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', timeZone: TZ }).format(d);
  const month = new Intl.DateTimeFormat('ro-RO', { month: 'short', timeZone: TZ }).format(d);
  return `Azi, ${weekday} ${day} ${month}`;
}

const WEEKDAY2 = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'];

/** The weekday (0 = Sunday), hour and minute of `d` on the lake's wall clock, whatever the viewer's zone. */
const wallParts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const EN_WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** fish `format(d, 'EEEEEE HH:mm', { locale: ro })` capitalised → «Lu 06:00», on the lake's clock. */
export function dayTime(iso: string): string {
  const parts = wallParts.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${WEEKDAY2[EN_WEEKDAY.indexOf(get('weekday'))]} ${get('hour')}:${get('minute')}`;
}

/** «Lu» … «Du» for a calendar day key («2026-10-05»): the axis of a week, as dayTime() writes days. */
export function weekdayShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAY2[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function longDay(d: Date): string {
  const weekday = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', timeZone: TZ }).format(d);
  const day = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'short', timeZone: TZ }).format(d);
  return `${cap(weekday)}, ${day.replace(/\.$/, '')}`;
}
const hm = (d: Date) => new Intl.DateTimeFormat('ro-RO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d);
/** The calendar day of `d` in the lake's zone, «2026-10-04». */
export const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

/** fish helpers/formatBookingPeriod.ts: «Sâmbătă, 4 oct · 06:00–18:00» or «Sâmbătă, 4 oct 11:19 – Duminică, 5 oct 11:19». */
export function formatBookingPeriod(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (dayKey(start) === dayKey(end)) return `${longDay(start)} · ${hm(start)}–${hm(end)}`;
  return `${longDay(start)} ${hm(start)} – ${longDay(end)} ${hm(end)}`;
}

/** «1.250» — ro-RO thousands, whole lei. */
export const lei = (n: number) => Math.round(n).toLocaleString('ro-RO');

/** «HH:mm» in the lake's zone. */
export const hourMinute = (iso: string) => hm(new Date(iso));

/** «în 25 min» / «în 2 h» / «în 2 h 15 min» until `iso` (whole minutes, never negative). */
export function countdown(iso: string, nowMs: number): string {
  const minutes = Math.max(0, Math.round((new Date(iso).getTime() - nowMs) / 60_000));
  if (minutes < 60) return `în ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `în ${h} h` : `în ${h} h ${m} min`;
}
