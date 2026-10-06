// Ported from fish `features/partide/components/activityLineChart.helpers.ts` (pure parts used by
// the «Activitate» card of the venue / community statistics screens).

const RO_MONTHS_SHORT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'noi', 'dec'];
const RO_MONTHS_FULL = [
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
const RO_DAYS_SHORT = ['dum', 'lun', 'mar', 'mie', 'joi', 'vin', 'sâm']; // JS getDay() order (Sun..Sat)

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Human date for each series bucket, mirroring the server's bucket layout (daily buckets end
 * today; year buckets run Jan→now):
 *   week  → "mie 29 iul"   month → "29 iul"   year → "Iulie"
 * Shown in the card header while scrubbing — the axis keeps its terse labels.
 */
export function seriesDetailLabels(period: 'week' | 'month' | 'year', n: number, now: Date): string[] {
  if (period === 'year') return Array.from({ length: n }, (_, i) => RO_MONTHS_FULL[i % 12]);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getTime() - (n - 1 - i) * DAY_MS);
    const base = `${d.getDate()} ${RO_MONTHS_SHORT[d.getMonth()]}`;
    return period === 'week' ? `${RO_DAYS_SHORT[d.getDay()]} ${base}` : base;
  });
}

/**
 * Which x labels render on the Activitate chart: all of them at ≤12 buckets, every 5th at 30
 * (month period), always including the last — dropping the previous kept index when the last
 * lands within 3 of it so the two never cram together.
 */
export function labelIndices(n: number): number[] {
  if (n <= 12) return Array.from({ length: n }, (_, i) => i);
  const idx: number[] = [];
  for (let i = 0; i < n; i += 5) idx.push(i);
  const last = n - 1;
  if (idx[idx.length - 1] !== last) {
    if (last - idx[idx.length - 1] < 3) idx.pop();
    idx.push(last);
  }
  return idx;
}

/**
 * Y-axis scale: 3 sections with a "nice" step (1/1.5/2/2.5/3/4/5/6/8 × 10^k) so the section
 * labels come out round — max 4363 → step 1500 → 1500/3000/4500.
 */
export function yAxisScale(max: number): { maxValue: number; noOfSections: number; stepValue: number } {
  const noOfSections = 3;
  const rawStep = Math.max(1, Math.ceil(max / noOfSections));
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  let step = 10 * pow;
  for (const c of candidates) {
    const s = c * pow;
    if (Number.isInteger(s) && s >= rawStep) {
      step = s;
      break;
    }
  }
  return { maxValue: step * noOfSections, noOfSections, stepValue: step };
}
