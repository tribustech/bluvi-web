// Ported from fish `features/partide/helpers/evolution.ts` (pure).
import { fmtClock, fmtKg } from './format';

export type EvolutionLineSeries = {
  /** shape ActivityLineChart consumes — count is that catch's kg */
  series: { label: string; count: number }[];
  /** per point, shown in the card header while scrubbing */
  detailLabels: string[];
};

/** ≤4 x-axis label indices: first, last, ~equidistant middles. HH:MM labels
 * are ~30px wide — labelIndices' "all at ≤12" density would cram them. */
export function axisLabelIndices(n: number): number[] {
  if (n <= 4) return Array.from({ length: n }, (_, i) => i);
  const idx = new Set<number>();
  for (let i = 0; i <= 3; i++) idx.add(Math.round((i * (n - 1)) / 3));
  return [...idx].sort((a, b) => a - b);
}

/**
 * Per-catch series for the interactive "Evoluția capturilor" chart:
 * one point per weighed catch in chronological order, y = that catch's kg
 * (equal x spacing — scrubbing snaps catch-to-catch by design, spec 2026-08-02).
 * Null under 2 weighed catches — the card hides entirely.
 */
export function buildEvolutionLineSeries(
  catches: { weightKg: number | null; species: string | null; occurredAt: string }[]
): EvolutionLineSeries | null {
  const weighed = catches
    .filter(c => (c.weightKg ?? 0) > 0)
    .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  if (weighed.length < 2) return null;

  const shown = new Set(axisLabelIndices(weighed.length));
  const series = weighed.map((c, i) => ({
    count: c.weightKg!,
    label: shown.has(i) ? fmtClock(new Date(c.occurredAt).getTime()) : '',
  }));
  const detailLabels = weighed.map(
    c => `${c.species ?? 'Captură'} · ${fmtKg(c.weightKg!)} kg · ${fmtClock(new Date(c.occurredAt).getTime())}`
  );
  return { series, detailLabels };
}
