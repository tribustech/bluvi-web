import type { StandHandicapSummary } from '@/core/organizer/domain/standHandicaps';
import { cellNumber, readCell, type RankingRowData } from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import { formatKg } from './ranking';

/**
 * fish AnglerStatsSheet HandicapCard («handicap pe stand»), in the angler sheet and the ranking's
 * person popover: how the stand's kg became the ranking's kg — caught, the
 * percent that counts, what is in the ranking (a kg penalty, when any, on its own line).
 */
export function HandicapCard({ handicap, decimals, className }: { handicap: StandHandicapSummary; decimals: number; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-card bg-accent-tint p-4', className)} data-testid="angler-handicap" aria-label="Handicap pe stand">
      <div className="flex items-center justify-between gap-3">
        <p className="t-body-strong text-ink">Handicap pe stand</p>
        <span className="rounded-full bg-surface px-2.5 py-0.5 t-caption font-extrabold text-accent-ink">{handicap.percent}% din kg</span>
      </div>
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="t-caption text-muted">Prins</span>
          <span className="t-body-strong text-ink tabular-nums" data-testid="angler-handicap-real">
            {formatKg(handicap.realQuantity, decimals)} kg
          </span>
        </div>
        <span aria-hidden className="pb-0.5 text-muted">
          →
        </span>
        <div className="flex flex-1 flex-col items-end gap-0.5">
          <span className="t-caption text-muted">În clasament</span>
          <span className="t-body-strong font-extrabold text-accent-ink tabular-nums" data-testid="angler-handicap-counted">
            {formatKg(handicap.quantity, decimals)} kg
          </span>
        </div>
      </div>
      {handicap.penaltyKg > 0 ? (
        <p className="t-caption text-muted">Include o penalizare de {formatKg(handicap.penaltyKg, decimals)} kg.</p>
      ) : null}
    </section>
  );
}

/** The breakdown of a ranking table row whose Cantitate cell carries a handicap; undefined otherwise. */
export function handicapOfRow(row: RankingRowData | undefined): StandHandicapSummary | undefined {
  const handicap = row ? readCell(row.quantity).handicap : null;
  const quantity = row ? cellNumber(row.quantity) : null;
  const realQuantity = handicap ? Number(handicap.realQuantity) : NaN;
  if (!handicap || quantity === null || !Number.isFinite(realQuantity)) return undefined;
  const penaltyKg = Math.max(0, Number(((realQuantity * handicap.percent) / 100 - quantity).toFixed(3)));
  return { percent: handicap.percent, realQuantity, quantity, penaltyKg };
}
