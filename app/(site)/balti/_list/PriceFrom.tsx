import { formatInt } from '@/components/cards/format';
import { cn } from '@/components/ui/cn';

/*
 * The lake's signature price, «de la 45 RON / Permis 24h» — one treatment for the map's row card
 * (LakeRowCard) and the detail page's summary card (LakeScreen), so the two never drift apart
 * (owner rules 1, 7 and 10, ROADMAP §4b): «de la» small and muted, the number big (t-display), the
 * unit beside it, smaller and muted.
 *
 * The unit is the price's own note, never a made-up one (rule 4): a booking quote's «tura de N ore»
 * or the legacy row's header (priceFrom.ts, legacyPriceFrom). Without a note the unit is «RON» alone.
 */

export type PriceFromValue = { price: number; note: string | null };

/** The cheapest legacy price row, its header as the note (fish LakePriceSection's rows). */
export function legacyPriceFrom(rows: readonly { header: string | null; price: number | null }[]): PriceFromValue | null {
  let best: PriceFromValue | null = null;
  for (const r of rows) if (r.price != null && (!best || r.price < best.price)) best = { price: r.price, note: r.header?.trim() || null };
  return best;
}

/** «tura de 12 ore» — the note of a booking quote with no row label. */
export const quoteHoursNote = (h: number) => `tura de ${h} ${h === 1 ? 'oră' : 'ore'}`;

export function PriceFrom({ price, note, className, testId }: PriceFromValue & { className?: string; testId?: string }) {
  return (
    <p data-price-from="" className={cn('flex flex-wrap items-baseline gap-x-1.5 text-ink', className)}>
      <span className="t-caption text-muted">de la</span>
      <span className="t-display tabular-nums tracking-tight" data-testid={testId}>
        {formatInt(price)}
      </span>
      <span className="t-body-strong text-ink-2" data-price-unit="">
        RON{note ? ` / ${note}` : null}
      </span>
    </p>
  );
}
