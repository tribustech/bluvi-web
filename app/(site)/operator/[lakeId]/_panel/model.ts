/**
 * operator.panou — the pure copy and figures of «Panoul bălții» (fish app/(app)/operator/[lakeId]/index.tsx,
 * features/operator/dashboard/LakeTrendCard.tsx). Everything «today» is the DEVICE-LOCAL calendar day,
 * as fish (operator.b.local-day: core todayCounts); trend bucket keys are server lake-local and are
 * parsed without a timezone shift (core trendLabels).
 *
 * Web differences, all on counts: Romanian plurals take «de» from 20 (formatCount: «20 de cereri»,
 * «21 de standuri», «23 de ore») where fish writes «20 cereri».
 */
import {
  capitalize,
  cashDueToday,
  formatHHmm,
  RO_MONTHS_ABBR,
  RO_WEEKDAYS_SHORT,
  RO_WEEKDAYS_WIDE,
  trendDetailLabel,
  type TodayPhase,
} from '@/core/booking';
import type { LakeOperatorStats, OperatorStatsWindowName, OperatorTrendPoint, OperatorUpcomingBooking, OperatorWindowTotals } from '@/core/lakes';
import { yAxisScale } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { routes } from '@/lib/routes';

/** The page's title, and the breadcrumb's while the lake's name is unknown (rule 4: no «Balta» flash). */
export const PANEL_TITLE = 'Panoul bălții';

/** fish TODAY_STANDS_MAX: stands listed in «Azi la baltă» before «Vezi toate». */
export const TODAY_STANDS_MAX = 5;

/** «1.250» — ro-RO thousands, whole lei (fish formatLei on a rounded figure). */
export const lei = (n: number) => Math.round(n).toLocaleString('ro-RO');

/** c1 — fish `Azi, ${format(new Date(), 'EEEE d MMM', { locale: ro })}` → «Azi, joi 9 oct», device-local. */
export function todayCaption(now: Date): string {
  return `Azi, ${RO_WEEKDAYS_WIDE[now.getDay()]} ${now.getDate()} ${RO_MONTHS_ABBR[now.getMonth()]}`;
}

/** c15 — fish `format(d, 'EEEEEE HH:mm', { locale: ro })` capitalised → «Lu 06:00», device-local. */
export function dayTime(iso: string): string {
  const d = new Date(iso);
  return `${capitalize(RO_WEEKDAYS_SHORT[d.getDay()])} ${formatHHmm(d)}`;
}

/** c15 — «Lu 06:00 → Ma 06:00». */
export const periodLine = (b: Pick<OperatorUpcomingBooking, 'startDate' | 'endDate'>) => `${dayTime(b.startDate)} → ${dayTime(b.endDate)}`;

/** c9 — fish `waitedLabel`: «de 25 min» / «de 1 oră» / «de 6 ore» / «de 2 zile» (null when unknown). */
export function waitedLabel(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `de ${Math.max(0, Math.floor(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `de ${formatCount(hours, 'oră', 'ore')}`;
  const days = Math.floor(hours / 24);
  return `de ${formatCount(days, 'zi', 'zile')}`;
}

/** c8 — «1 cerere așteaptă răspuns» / «3 cereri așteaptă răspuns». */
export const pendingTitle = (n: number) => `${formatCount(n, 'cerere', 'cereri')} așteaptă răspuns`;

/** c9 — the oldest request, or the older-CMS line. */
export function pendingSubtitle(oldest: LakeOperatorStats['oldestPending']): string {
  if (!oldest) return 'Nu sunt confirmate până le răspunzi';
  return [oldest.anglerName ?? 'Pescar', oldest.standName ? `standul ${oldest.standName}` : null, waitedLabel(oldest.waitingMinutes)]
    .filter(Boolean)
    .join(' · ');
}

/** c20 — «1 rezervare anulată de un pescar» / «3 rezervări anulate de pescari». */
export const cancelledTitle = (n: number) =>
  n === 1 ? '1 rezervare anulată de un pescar' : `${formatCount(n, 'rezervare anulată', 'rezervări anulate')} de pescari`;

/** c21 — «1 partidă de evaluat» / «3 partide de evaluat». */
export const reviewTitle = (n: number) => `${formatCount(n, 'partidă', 'partide')} de evaluat`;

/** c13 — «Vezi toate (6 standuri)». */
export const seeAllLabel = (stands: number) => `Vezi toate (${formatCount(stands, 'stand', 'standuri')})`;

/** c6 / c8 / c20 / c21 / c13 — where each control of the panel goes. */
export function panelLinks(lakeId: string, pending: number) {
  return {
    calendar: routes.operatorCalendar(lakeId),
    // c6: the badge counts unanswered requests, so the tap lands on them (fish: same rule as Acasă).
    bookings: pending > 0 ? routes.operatorBookings(lakeId, 'pending') : routes.operatorBookings(lakeId),
    blocks: routes.operatorBlocks(lakeId),
    answer: routes.operatorBookings(lakeId, 'pending'),
    cancelled: routes.operatorBookings(lakeId, 'cancelled'),
    toReview: routes.operatorBookings(lakeId, 'toreview'),
    // c13: the inbox's default bucket (Confirmate · Azi).
    seeAll: routes.operatorBookings(lakeId),
  };
}

/** c22 — stands held right now; an older CMS → today's day count, and the label follows. */
export function occupancyFigure(stats: Pick<LakeOperatorStats, 'occupancyNow' | 'occupancyByDay'>): { booked: number; total: number; label: string } {
  const now = stats.occupancyNow;
  const o = now ?? stats.occupancyByDay?.at(-1) ?? { booked: 0, total: 0 };
  return { booked: o.booked, total: o.total, label: now ? 'Standuri ocupate acum' : 'Standuri ocupate azi' };
}

/** c23 / c24 — today's cash at the gate (the server's figure, else the client sum) and its sub-line. */
export function cashFigure(stats: Pick<LakeOperatorStats, 'deIncasatAzi' | 'deIncasat7z' | 'today'>, nowMs: number): { today: number; subline: string | null } {
  const rows = stats.today ?? [];
  const today = stats.deIncasatAzi ?? cashDueToday(rows, nowMs);
  const week = stats.deIncasat7z;
  const subline =
    week != null && week > 0
      ? `Următoarele 7 zile: ${lei(week)} lei (azi inclus)`
      : rows.length === 0
        ? 'Nicio sosire azi'
        : today === 0
          ? 'Totul e achitat'
          : null;
  return { today, subline };
}

/**
 * c17 — fish MoneyColumn: the total, then the attendance / payment state, in fish's chip colours
 * (features/bookings/ui/chipModel.ts): «Numerar» chipAppearance('payment') green, «Plătit»
 * chipAppearance('stand') indigo (StatusPill `info`: the same #F0F3FD / #4338CA), «N-a venit» danger.
 */
export function moneyColumn(b: Pick<OperatorUpcomingBooking, 'priceTotal' | 'balanceDue'>, phase: TodayPhase): { total: string | null; pill: { label: string; tone: 'danger' | 'info' | 'success' } | null } {
  const total = Number(b.priceTotal) || 0;
  const pill =
    phase === 'noshow'
      ? ({ label: 'N-a venit', tone: 'danger' } as const)
      : total <= 0
        ? null
        : b.balanceDue != null && b.balanceDue > 0
          ? ({ label: 'Numerar', tone: 'success' } as const)
          : ({ label: 'Plătit', tone: 'info' } as const);
  return { total: total > 0 ? `${lei(total)} lei` : null, pill };
}

/** c16 — fish `gone`: a finished stay or a no-show is dimmed. */
export const isDimmed = (phase: TodayPhase) => phase === 'done' || phase === 'noshow';

/* ------------------------------------------------------------------------------------------------
 * «Cum merge balta» (c25–c30)
 * ---------------------------------------------------------------------------------------------- */

export type TrendMetric = 'occupancy' | 'cash';

export const TREND_WINDOWS: { key: OperatorStatsWindowName; label: string }[] = [
  { key: 'week', label: 'Săptămâna' },
  { key: 'month', label: 'Luna' },
  { key: 'year', label: 'Anul' },
];

export const TREND_METRICS: { key: TrendMetric; label: string }[] = [
  { key: 'occupancy', label: 'Ocupare' },
  { key: 'cash', label: 'Încasări' },
];

/**
 * c27 — the y axis: occupancy is scaled to the lake's stands (a 3/12 day reads a quarter full, never
 * a full line), cash to its own busiest bucket; fish yAxisScale (three «nice» sections), labels as
 * whole numbers.
 */
export function trendScale(points: OperatorTrendPoint[], metric: TrendMetric): { max: number; ticks: number[] } {
  const stands = points[0]?.total ?? 0;
  const top = metric === 'occupancy' && stands > 0 ? stands : Math.max(0, ...points.map((p) => (metric === 'cash' ? p.cash : p.booked)));
  const s = yAxisScale(top);
  const ticks = Array.from({ length: s.noOfSections + 1 }, (_, k) => Math.round(k * s.stepValue));
  return { max: s.maxValue, ticks };
}

/** c27 — points (dots) are drawn only for a short series. */
export const showAllPoints = (n: number) => n <= 12;

/** c29 — the year's occupancy names the month's bookings (a monthly average would round to 0/21). */
export function scrubOccupancy(p: OperatorTrendPoint, window: OperatorStatsWindowName): string {
  return window === 'year' ? formatCount(p.bookings, 'rezervare', 'rezervări') : `${p.booked}/${p.total}`;
}

/** c29 — the card header while a point is scrubbed: «joi 9 oct · 3/21 · 450 lei». */
export const scrubHeader = (p: OperatorTrendPoint, window: OperatorStatsWindowName) =>
  `${trendDetailLabel(p.date, window)} · ${scrubOccupancy(p, window)} · ${lei(p.cash)} lei`;

const WINDOW_TITLE: Record<OperatorStatsWindowName, string> = { week: 'Săptămâna asta', month: 'Luna asta', year: 'Anul acesta' };

/** c30 — fish trendSummary with the web's plurals: «Săptămâna asta · 12% ocupare medie · 1.250 lei · 21 de rezervări». */
export function trendSummaryLine(window: OperatorStatsWindowName, totals: OperatorWindowTotals | null | undefined): string {
  if (!totals) return WINDOW_TITLE[window];
  return `${WINDOW_TITLE[window]} · ${totals.occupancyAvgPct}% ocupare medie · ${lei(totals.cash)} lei · ${formatCount(totals.bookings, 'rezervare', 'rezervări')}`;
}

/* ------------------------------------------------------------------------------------------------
 * The screen's state
 * ---------------------------------------------------------------------------------------------- */

export type PanelView =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'data'; data: LakeOperatorStats; window: OperatorStatsWindowName; trendFailed: boolean };

/**
 * c3 / c4 / c26 — what the body shows. `fresh` is the current window's own answer (not react-query's
 * placeholder); `settled` the last window that answered. A first load is the spinner; a failure
 * with nothing on screen the error state; once anything answered it stays on screen — a failed
 * refetch (or another window failing to load) keeps the figures and only says so in the trend card.
 */
export function panelView(input: {
  fresh: LakeOperatorStats | undefined;
  settled: { window: OperatorStatsWindowName; data: LakeOperatorStats } | null;
  window: OperatorStatsWindowName;
  isError: boolean;
  error: unknown;
}): PanelView {
  if (input.fresh) return { kind: 'data', data: input.fresh, window: input.window, trendFailed: false };
  if (input.settled) return { kind: 'data', data: input.settled.data, window: input.settled.window, trendFailed: input.isError };
  if (input.isError) return { kind: 'error', error: input.error };
  return { kind: 'loading' };
}
