import { formatDecimal } from '@/components/cards/format';
import { DashboardSection } from '@/components/templates/T5';
import type { SpeciesShare } from '@/core/partide';

/*
 * «Specii prinse» — fish SpeciesCard (parity partide.statistici.c9): one bar per species, its share
 * of the period's catches (the bar is the share of the track, as fish), the percentage beside it with
 * the Romanian comma. One grid for the card (rows as subgrids): the names' column is as wide as the
 * longest name up to 45% of the card, so every bar starts on one line, and the bars stop at 20rem on
 * a wide card (owner rule 16: never a track stretched across the screen).
 */

export function SpeciesBars({ species, className }: { species: SpeciesShare[]; className?: string }) {
  return (
    <DashboardSection className={className} title="Specii prinse">
      <ul className="grid grid-cols-[fit-content(45%)_minmax(--spacing(16),--spacing(80))_--spacing(12)] gap-x-2.5 gap-y-2.5" data-testid="species-card">
        {species.map((s, i) => (
          <li key={s.name} className="col-span-3 grid grid-cols-subgrid items-center" data-testid="species-row">
            <span className="truncate t-label text-ink">{s.name}</span>
            <span aria-hidden className="h-2 overflow-hidden rounded-full bg-accent-tint">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, s.pct))}%`, opacity: i === 0 ? 1 : Math.max(0.3, 1 - i * 0.22) }} />
            </span>
            <span className="text-right t-micro-strong text-muted tabular-nums">{formatDecimal(s.pct, 0, 1)}%</span>
          </li>
        ))}
      </ul>
    </DashboardSection>
  );
}
