/** fish `features/operator/dashboard/trendLabels.ts` (verbatim; stats types are minimal local slices). */
/** Slices of fish `models/operatorStats.type.ts`; the full types are owned by the operator-stats domain. */
export type OperatorStatsWindowName = 'week' | 'month' | 'year';
/** One bucket of the trend chart: a local day (`YYYY-MM-DD`), or a month (`YYYY-MM`) at year grain. */
export type OperatorTrendPoint = { date: string; booked: number; total: number; cash: number; bookings: number };
export type OperatorWindowTotals = { cash: number; bookings: number; occupancyAvgPct: number };

const RO_MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const RO_MONTHS_FULL = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
const RO_DAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S']; // JS getDay() order (Sun..Sat)
const RO_DAYS_FULL = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];

/**
 * Parse a bucket key WITHOUT letting the device's timezone shift it.
 *
 * `new Date('2026-08-23')` is parsed as UTC midnight and then read back in local
 * time, which in a negative-offset zone lands on the 22nd. The server already did
 * the lake-local day maths; these keys are labels, not instants.
 */
function partsOf(dateKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateKey.split('-').map(Number);
  return { y, m, d: d || 1 };
}

/** Weekday index (0=Sun) for a `YYYY-MM-DD` key, timezone-independent. */
function dayOfWeek(dateKey: string): number {
  const { y, m, d } = partsOf(dateKey);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * The x-axis labels. A week names its days; a month is too dense to label every
 * bucket, so it labels every fifth plus the last; a year names its months.
 *
 * Returns one entry per point — an empty string means "no label here", which is
 * what the chart's `presetLabels` mode expects.
 */
export function trendAxisLabels(points: OperatorTrendPoint[], name: OperatorStatsWindowName): string[] {
  if (name === 'year') return points.map(p => RO_MONTHS_SHORT[(partsOf(p.date).m - 1) % 12]);
  if (name === 'week') return points.map(p => RO_DAYS_SHORT[dayOfWeek(p.date)]);
  // Month: every 5th day plus the last, so the labels never collide.
  const last = points.length - 1;
  return points.map((p, i) => (i % 5 === 0 || i === last ? String(partsOf(p.date).d) : ''));
}

/** The bucket named in full, for the card header while scrubbing. */
export function trendDetailLabel(dateKey: string, name: OperatorStatsWindowName): string {
  const { m, d } = partsOf(dateKey);
  if (name === 'year') return RO_MONTHS_FULL[(m - 1) % 12];
  const base = `${d} ${RO_MONTHS_SHORT[m - 1]}`;
  return name === 'week' ? `${RO_DAYS_FULL[dayOfWeek(dateKey)]} ${base}` : base;
}

/**
 * The occupancy half of the scrub header. A day reads as stands: `3/21`. A month
 * bucket's `booked` is a daily AVERAGE, which rounds a quiet-but-paying month down
 * to `0/21` — misleading next to real lei — so a year names the month's bookings.
 */
export function trendScrubOccupancy(point: OperatorTrendPoint, name: OperatorStatsWindowName): string {
  if (name !== 'year') return `${point.booked}/${point.total}`;
  return point.bookings === 1 ? '1 rezervare' : `${point.bookings} rezervări`;
}

const WINDOW_TITLE: Record<OperatorStatsWindowName, string> = {
  week: 'Săptămâna asta',
  month: 'Luna asta',
  year: 'Anul acesta',
};

const formatLei = (n: number) => Math.round(n).toLocaleString('ro-RO');

/**
 * The line under the chart: what the whole window adds up to.
 *
 * It exists because a chart alone answers "which day", never "how much" — the
 * shape is the question and the total is the answer. Reservations are named last
 * because they are the least actionable of the three.
 */
export function trendSummary(name: OperatorStatsWindowName, totals: OperatorWindowTotals | null): string {
  if (!totals) return WINDOW_TITLE[name];
  const bookings =
    totals.bookings === 1 ? '1 rezervare' : `${totals.bookings} rezervări`;
  return `${WINDOW_TITLE[name]} · ${totals.occupancyAvgPct}% ocupare medie · ${formatLei(totals.cash)} lei · ${bookings}`;
}

/** Which bucket is "now", so the chart can mark it; -1 when today is outside the window. */
export function todayIndex(points: OperatorTrendPoint[], name: OperatorStatsWindowName, now: Date): number {
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const key = name === 'year' ? `${now.getFullYear()}-${mm}` : `${now.getFullYear()}-${mm}-${String(now.getDate()).padStart(2, '0')}`;
  return points.findIndex(p => p.date === key);
}
