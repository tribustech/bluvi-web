/** fish `features/operator/todayCounts.ts` (verbatim). */
import type { OperatorUpcomingBooking } from '../../lakes/schemas';

/**
 * The arrival state of one of today's bookings — ONE state machine, shared by the
 * row pill and the counter band above it.
 *
 * The app has no check-in, so "came" cannot be observed: it is inferred from the
 * booking's window plus the operator's own no-show flag. That is why a finished
 * booking is `done` ("Încheiat") rather than "A venit" — the only positive
 * statement we can honestly make is that nobody marked them absent.
 */
export type TodayPhase = 'noshow' | 'pending' | 'live' | 'done' | 'next';

/** The slice of a booking these helpers read — the panel row and the list's
 *  BookingDTO both satisfy it, so one day-model serves both screens. */
export type StayLike = { startDate: string; endDate: string; bookingStatus: string; noShow?: boolean | null };

export function todayPhase(b: StayLike, nowMs: number): TodayPhase {
  if (b.noShow) return 'noshow';
  if (b.bookingStatus === 'pending') return 'pending';
  const start = new Date(b.startDate).getTime();
  const end = new Date(b.endDate).getTime();
  if (nowMs >= start && nowMs < end) return 'live';
  if (nowMs >= end) return 'done';
  return 'next';
}

/** Plural-aware segments, in the order the operator reads the day. */
const BAND_ORDER: { phase: TodayPhase; one: string; many: string }[] = [
  { phase: 'live', one: '1 pe baltă', many: 'pe baltă' },
  { phase: 'next', one: '1 urmează', many: 'urmează' },
  { phase: 'done', one: '1 încheiată', many: 'încheiate' },
  { phase: 'noshow', one: '1 n-a venit', many: 'n-au venit' },
];

/**
 * "2 pe baltă · 3 urmează · 1 fără răspuns" — what is LEFT to happen today, so the
 * line can reach zero by evening. Empty segments are dropped rather than shown as
 * zeros: a zero is not work.
 */
export function todayBand(rows: OperatorUpcomingBooking[], nowMs: number): string {
  const counts = new Map<TodayPhase, number>();
  for (const b of rows) {
    const p = todayPhase(b, nowMs);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return BAND_ORDER.filter(s => (counts.get(s.phase) ?? 0) > 0)
    .map(s => {
      const n = counts.get(s.phase)!;
      return n === 1 ? s.one : `${n} ${s.many}`;
    })
    .join(' · ');
}

/** `YYYY-MM-DD` for the device-local calendar day of an instant. */
function localDayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Cash the operator collects at the gate today — the money the angler hands over
 * ON ARRIVAL, which is the only meaning "de încasat" has.
 *
 * Keyed on the ARRIVAL (`startDate` falls today), never on overlap: a 24h session
 * that started yesterday evening is still on the lake this morning, but its cash
 * changed hands last night. Counting overlap would bill the same money twice.
 *
 * Gates: honored (confirmed/completed), not flagged as a no-show — someone who
 * never showed up owes nothing at the gate. A `pending` request owes nothing
 * either until it is accepted.
 *
 * Wave 1 sums `priceTotal` rather than `priceTotal − amountPaid`: the row does not
 * carry `amountPaid`, and every booking in production is offline with nothing paid
 * up front (Stripe is not configured, so `booking.create` rejects any non-offline
 * lake). Wave 2 replaces this with the server's own `deIncasatAzi`, which applies
 * the balance and the payment-mode gate.
 */
export function cashDueToday(rows: OperatorUpcomingBooking[], nowMs: number): number {
  const today = localDayKey(new Date(nowMs));
  let total = 0;
  for (const b of rows) {
    if (b.noShow) continue;
    if (b.bookingStatus !== 'confirmed' && b.bookingStatus !== 'completed') continue;
    if (localDayKey(new Date(b.startDate)) !== today) continue;
    total += Number(b.priceTotal) || 0;
  }
  return Math.round(total);
}

const standCollator = new Intl.Collator('ro', { numeric: true });

/**
 * The rows the "Azi la baltă" card lists: a pending request cannot be on the
 * lake (it lives in the request card above), and the operator walks the bank
 * stand by stand, so the order is the stand's, not the arrival time's.
 */
export function todayListRows<T extends OperatorUpcomingBooking>(rows: T[]): T[] {
  return rows
    .filter(b => b.bookingStatus !== 'pending')
    .sort((a, b) => standCollator.compare(a.standName ?? '', b.standName ?? ''));
}

/**
 * How far into the stay this booking is: "12h din 48h" while on the lake,
 * "peste 3h · 48h" before it, "48h" once it is over. `ratio` drives the bar.
 */
export function stayProgress(b: StayLike, nowMs: number): { label: string; ratio: number } {
  const start = new Date(b.startDate).getTime();
  const end = new Date(b.endDate).getTime();
  const H = 3600_000;
  const total = Math.max(1, Math.round((end - start) / H));
  if (nowMs < start) {
    const until = Math.max(1, Math.round((start - nowMs) / H));
    return { label: `peste ${until}h · ${total}h`, ratio: 0 };
  }
  if (nowMs >= end) return { label: `${total}h`, ratio: 1 };
  const elapsed = Math.min(total, Math.floor((nowMs - start) / H));
  return { label: `${elapsed}h din ${total}h`, ratio: (nowMs - start) / (end - start) };
}

export type TodayMomentKind = 'arrives' | 'stays' | 'leaves';

const WEEKDAY = ['Du', 'Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ'];
const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dayHm = (d: Date) => `${WEEKDAY[d.getDay()]} ${hm(d)}`;
const hoursOf = (b: StayLike) =>
  Math.max(1, Math.round((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / 3600_000));

/**
 * What this booking means for TODAY, in the operator's words: someone arrives,
 * someone leaves, or someone simply stays. A stay that starts today is an
 * arrival even if it also ends today (a day tour); one that ends today without
 * having started today is a departure; anything else is just on the lake.
 */
export function todayMoment(b: StayLike, nowMs: number): { kind: TodayMomentKind; label: string } {
  const start = new Date(b.startDate);
  const end = new Date(b.endDate);
  const today = localDayKey(new Date(nowMs));
  const startsToday = localDayKey(start) === today;
  const endsToday = localDayKey(end) === today;
  const hours = `${hoursOf(b)}h`;
  if (startsToday) {
    if (nowMs < start.getTime()) return { kind: 'arrives', label: `vine ${hm(start)} · ${hours}` };
    if (endsToday && nowMs >= end.getTime())
      return { kind: 'arrives', label: `a venit ${hm(start)} · a plecat ${hm(end)}` };
    if (endsToday) return { kind: 'arrives', label: `a venit ${hm(start)} · pleacă ${hm(end)}` };
    return { kind: 'arrives', label: `a venit ${hm(start)} → ${dayHm(end)}` };
  }
  if (endsToday) {
    if (nowMs >= end.getTime()) return { kind: 'leaves', label: `a plecat ${hm(end)}` };
    return { kind: 'leaves', label: `pleacă ${hm(end)}` };
  }
  return { kind: 'stays', label: `${dayHm(start)} → ${dayHm(end)}` };
}

/** "1 vine · 2 stau · 1 pleacă" — empty segments dropped. */
export function todayMomentBand(rows: OperatorUpcomingBooking[], nowMs: number): string {
  const n: Record<TodayMomentKind, number> = { arrives: 0, stays: 0, leaves: 0 };
  for (const b of rows) n[todayMoment(b, nowMs).kind] += 1;
  const seg: string[] = [];
  if (n.arrives) seg.push(n.arrives === 1 ? '1 vine' : `${n.arrives} vin`);
  if (n.stays) seg.push(n.stays === 1 ? '1 stă' : `${n.stays} stau`);
  if (n.leaves) seg.push(n.leaves === 1 ? '1 pleacă' : `${n.leaves} pleacă`);
  return seg.join(' · ');
}

export type TodayStandGroup<T extends OperatorUpcomingBooking = OperatorUpcomingBooking> = {
  standName: string | null;
  bookings: T[];
};

/** One group per stand, stands in natural order, bookings inside by start time. */
export function groupTodayByStand<T extends OperatorUpcomingBooking>(rows: T[]): TodayStandGroup<T>[] {
  const map = new Map<string, TodayStandGroup<T>>();
  for (const b of todayListRows(rows)) {
    const key = b.standName ?? '';
    const g = map.get(key);
    if (g) g.bookings.push(b);
    else map.set(key, { standName: b.standName, bookings: [b] });
  }
  const out = [...map.values()];
  for (const g of out) g.bookings.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return out;
}
