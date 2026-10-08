import {
  bookingActionGates,
  bookingAgeLabel,
  bookingHours,
  bookingName,
  bookingPeriod,
  bucketFromLegacyStatus,
  defaultSub,
  formatLei,
  isRequestStale,
  meaningfulNoShowNote,
  PAYMENT,
  statusAppearance,
  stripAppendedCancelReason,
  SUB_LABELS,
  subsFor,
  todayMoment,
  type BookingDTO,
  type OperatorBucket,
  type OperatorSub,
  type PaymentStatus,
  type TodayMomentKind,
} from '@/core/booking';
import type { OperatorBookingsStatus } from '@/lib/routes';

/*
 * operator.rezervari — what the inbox says, as data (fish app/(app)/operator/[lakeId]/bookings.tsx +
 * features/operator/OperatorBookingRow.tsx), so the screen only draws it and every rule is
 * unit-tested here. `nowMs` is always passed in: ages, live progress and the turnover moments read
 * the browser's clock.
 */

/* ------------------------------------------------------------------------------------------------
 * The URL (operator.b.status-param)
 * -------------------------------------------------------------------------------------------- */

export const STATUS_PARAM = 'status';
/** Web-only: the sub-filter the shared ?status= vocabulary cannot name (see `inboxUrlValues`). */
export const SUB_PARAM = 'filtru';
export const FOCUS_PARAM = 'focus';
/** `filtru=toate`: a bucket's unfiltered view where the bucket's default is a sub (Confirmate → Azi). */
const ALL_SUB = 'toate';

export type InboxPlace = { bucket: OperatorBucket; sub: OperatorSub | undefined };

const one = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : (v ?? undefined));

/**
 * The tab a link opens (c6). The shared vocabulary first — pending, cancelled, rejected, toreview,
 * all — through fish's own bucketFromLegacyStatus, so a link shipped by any app version keeps
 * landing on the same rows; anything else (junk, absent) → Confirmate · Azi, as fish.
 *
 * Web-only extension, so a reload or Back keeps a place the vocabulary cannot say: ?status=confirmed
 * or ?status=unfinished (bucket names — fish reads them as «anything else», i.e. Confirmate · Azi,
 * and no app or notification sends them) with an optional ?filtru=<sub>|toate.
 */
export function parseInboxPlace(status?: string | string[] | null, filtru?: string | string[] | null): InboxPlace {
  const s = one(status);
  const f = one(filtru);
  if (s === 'confirmed' || s === 'unfinished') {
    const bucket: OperatorBucket = s;
    if (f === ALL_SUB) return { bucket, sub: undefined };
    const sub = subsFor(bucket).find((x) => x === f);
    return { bucket, sub: sub ?? defaultSub(bucket) };
  }
  const legacy = bucketFromLegacyStatus(s);
  return { bucket: legacy.bucket, sub: legacy.sub };
}

/**
 * The query string for a place — the shared vocabulary whenever it names the place exactly, so the
 * URL the operator copies is the same one Acasă, the panel and the notifications build
 * (routes.operatorBookings); the web-only pair otherwise; nothing for the default (Confirmate · Azi).
 */
export function inboxUrlValues({ bucket, sub }: InboxPlace): { [STATUS_PARAM]: string | null; [SUB_PARAM]: string | null } {
  const v = (status: string | null, filtru: string | null = null) => ({ [STATUS_PARAM]: status, [SUB_PARAM]: filtru });
  if (bucket === 'pending') return v('pending');
  if (bucket === 'all') return v('all');
  if (bucket === 'confirmed') {
    if (sub === 'today') return v(null);
    if (sub === 'toreview') return v('toreview');
    return v('confirmed', sub ?? ALL_SUB);
  }
  if (sub === 'cancelled') return v('cancelled');
  if (sub === 'rejected') return v('rejected');
  return v('unfinished', sub ?? null);
}

/** The vocabulary a notification route carries (core NotificationRoute operatorBookings) is a subset. */
export const NOTIFICATION_STATUSES: readonly OperatorBookingsStatus[] = ['pending', 'rejected', 'cancelled'];

/* ------------------------------------------------------------------------------------------------
 * Tabs and sub-filters
 * -------------------------------------------------------------------------------------------- */

/** c3 — the «De aprobat» badge: the FIRST page's pendingCount, never 0 (nor a first-load 0). */
export function pendingBadge(firstPagePendingCount: number | undefined): number | undefined {
  return firstPagePendingCount && firstPagePendingCount > 0 ? firstPagePendingCount : undefined;
}

/**
 * c4 — the chips under the tabs: only Confirmate and Nefinalizate have any; the leading «Toate»
 * (key undefined) is the bucket's unfiltered view.
 */
export function subChips(bucket: OperatorBucket): { key: OperatorSub | undefined; label: string }[] {
  const subs = subsFor(bucket);
  return subs.length === 0 ? [] : [{ key: undefined, label: 'Toate' }, ...subs.map((s) => ({ key: s, label: SUB_LABELS[s] }))];
}


/** c5 — the sub a tab shows: the one last picked in it during the visit, else its default. */
export function subOf(bucket: OperatorBucket, remembered: Partial<Record<OperatorBucket, OperatorSub | undefined>>) {
  return bucket in remembered ? remembered[bucket] : defaultSub(bucket);
}

/** c23 — the queues that owe a decision keep their buttons on the card: De aprobat, Confirmate · De evaluat. */
export function listHasCardActions({ bucket, sub }: InboxPlace): boolean {
  return bucket === 'pending' || sub === 'toreview';
}

/* ------------------------------------------------------------------------------------------------
 * The list's items (c14)
 * -------------------------------------------------------------------------------------------- */

export type InboxItem = { kind: 'one'; booking: BookingDTO } | { kind: 'turnover'; bookings: BookingDTO[] };

const standCollator = new Intl.Collator('ro', { numeric: true });

/**
 * Confirmate · Azi reads like the panel: stand by stand (natural order, 9 before 10), and a stand
 * with two or more stays today folds into one turnover card (its rows by start time). Every other
 * list keeps the server's order.
 */
export function inboxItems(rows: BookingDTO[], place: InboxPlace): InboxItem[] {
  if (place.bucket !== 'confirmed' || place.sub !== 'today') return rows.map((b) => ({ kind: 'one', booking: b }));
  const byStand = new Map<string, BookingDTO[]>();
  for (const b of rows) {
    const key = b.stand?.documentId ?? b.stand?.name ?? b.documentId;
    const g = byStand.get(key);
    if (g) g.push(b);
    else byStand.set(key, [b]);
  }
  return [...byStand.values()]
    .sort((a, b) => standCollator.compare(a[0].stand?.name ?? '', b[0].stand?.name ?? ''))
    .map((g) => {
      g.sort((a, b) => a.startDate.localeCompare(b.startDate));
      return g.length > 1 ? { kind: 'turnover' as const, bookings: g } : { kind: 'one' as const, booking: g[0] };
    });
}

export const itemKey = (it: InboxItem) => (it.kind === 'one' ? it.booking.documentId : `t-${it.bookings[0].documentId}`);

/** c26 — the index of the item holding `focus`, or -1 while it is not loaded. */
export function focusIndex(items: InboxItem[], focus: string | null | undefined): number {
  if (!focus) return -1;
  return items.findIndex((it) => (it.kind === 'one' ? it.booking.documentId === focus : it.bookings.some((b) => b.documentId === focus)));
}

/* ------------------------------------------------------------------------------------------------
 * One card (c15–c23)
 * -------------------------------------------------------------------------------------------- */

/** The money pill's colour family (fish PAYMENT fills, drawn with the kit's tokens). */
export type MoneyTone = 'success' | 'warning' | 'accent' | 'neutral';
const MONEY_TONE: Record<PaymentStatus, MoneyTone> = {
  none: 'success',
  depositPaid: 'warning',
  paidInFull: 'accent',
  refunded: 'neutral',
};

/** fish: the reason line is clamped to two lines with a toggle past this many characters. */
export const REASON_CLAMP_CHARS = 90;

export type RowModel = {
  id: string;
  name: string;
  anglerId: string | null;
  avatar: string | null;
  /** c16 — pending only: «acum 2 h 13 min»; red once stale (≥ 5 h). */
  age: string | null;
  stale: boolean;
  /** c17 — «Standul A10», or null. */
  standLabel: string | null;
  extras: { key: string; label: string }[];
  /** c18 / c14 — the turnover moment, the bare period while live, else «{period} · {h}h». */
  periodText: string;
  /** c18 — while the stay runs: the bar's share (0–100) and «{elapsed}h din {h}h». */
  live: { pct: number; label: string } | null;
  /** c19 — «1.250» (rounded, ro-RO); the unit is drawn apart (owner rule 10). */
  price: string;
  /**
   * c19 — the status pill for anything but a plain confirmed booking (a no-show included), else the
   * money pill (Numerar / Avans / Plătit / Rambursat).
   */
  pill: { kind: 'status' } | { kind: 'money'; label: string; tone: MoneyTone };
  /** c20 — cancelled, rejected and no-show cards recede. */
  quiet: boolean;
  /** c21 — the angler's note, the operator's appended reason stripped; '' hides the line. */
  note: string;
  /** c22 — «Motiv anulare» / «Motiv refuz» / «Neprezentare» and its text; `long` adds the toggle. */
  reason: { label: string; text: string; long: boolean } | null;
  /** c23 — the buttons the card keeps (only in the lists that owe a decision). */
  actions: 'pending' | 'rate' | null;
  phone: string | null;
  turnover: { kind: TodayMomentKind } | null;
};

export function rowModel(
  b: BookingDTO,
  nowMs: number,
  { cardActions = false, turnover = false }: { cardActions?: boolean; turnover?: boolean } = {},
): RowModel {
  const isPending = b.bookingStatus === 'pending';
  const appearance = statusAppearance(b.bookingStatus, { noShow: b.noShow, viewer: 'operator', cancelledBy: b.cancelledBy });
  const startMs = new Date(b.startDate).getTime();
  const endMs = new Date(b.endDate).getTime();
  const live = b.bookingStatus === 'confirmed' && nowMs >= startMs && nowMs < endMs && !b.noShow;
  const hours = bookingHours(b);
  const period = bookingPeriod(b);
  const moment = turnover ? todayMoment(b, nowMs) : null;
  const { canRate } = bookingActionGates(b, nowMs);
  const noShowNote = meaningfulNoShowNote(b.noShow, b.noShowComment);
  const reason =
    (b.bookingStatus === 'cancelled' || b.bookingStatus === 'rejected') && b.cancelReason
      ? { label: b.bookingStatus === 'cancelled' ? 'Motiv anulare' : 'Motiv refuz', text: b.cancelReason }
      : noShowNote
        ? { label: 'Neprezentare', text: noShowNote }
        : null;
  const payment = PAYMENT[b.paymentStatus as PaymentStatus] ? (b.paymentStatus as PaymentStatus) : 'none';
  const showStatus = b.bookingStatus !== 'confirmed' || !!b.noShow;
  return {
    id: b.documentId,
    name: bookingName(b),
    anglerId: b.angler?.documentId ?? null,
    avatar: b.angler?.avatar ?? null,
    age: isPending ? bookingAgeLabel(b.createdAt, nowMs) : null,
    stale: isRequestStale(b.createdAt, isPending, nowMs),
    standLabel: b.stand?.name ? `Standul ${b.stand.name}` : null,
    extras: (b.basis?.extras ?? []).map((e) => ({ key: e.key, label: e.label })),
    periodText: moment ? moment.label : live ? period : `${period} · ${hours}h`,
    live: live
      ? {
          pct: Math.max(0, Math.min(100, Math.round(((nowMs - startMs) / (endMs - startMs)) * 100))),
          label: `${Math.min(hours, Math.floor((nowMs - startMs) / 3_600_000))}h din ${hours}h`,
        }
      : null,
    price: formatLei(Math.round(b.priceTotal)),
    pill: showStatus ? { kind: 'status' } : { kind: 'money', label: PAYMENT[payment].label, tone: MONEY_TONE[payment] },
    quiet: appearance.quiet || !!b.noShow,
    note: stripAppendedCancelReason(b.notes),
    reason: reason ? { ...reason, long: reason.text.length > REASON_CLAMP_CHARS } : null,
    actions: cardActions ? (isPending ? 'pending' : canRate ? 'rate' : null) : null,
    phone: b.contactPhone ? b.contactPhone : null,
    turnover: moment ? { kind: moment.kind } : null,
  };
}

/** The open control's spoken name: the angler first (label in name), then what the card is about. */
export function rowAccessibleName(m: RowModel): string {
  return [m.name, m.standLabel, m.periodText].filter(Boolean).join(', ');
}
