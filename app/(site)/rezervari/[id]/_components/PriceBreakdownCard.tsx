import { formatLei, type BookingBasis } from '@/core/booking';
import { Card } from './Card';
import { composedLine, priceRows } from './model';

/**
 * c11 — fish features/bookings/ui/PriceBreakdownCard.tsx: where the total came from — the tour, each
 * extra, the sum. A SNAPSHOT from when the booking was made (the title says so), never today's rates.
 * Only rendered with a basis (a booking made before the server sent one shows no card).
 */
export function PriceBreakdownCard({ basis, total }: { basis: BookingBasis; total: number }) {
  const composed = composedLine(basis);
  return (
    <Card title="Cum s-a calculat" description="Prețurile de la momentul rezervării." titleId="rezervare-pret" data-testid="price-breakdown">
      <dl className="flex flex-col gap-2.5">
        {priceRows(basis).map((row, i) => (
          <div key={`${row.label}-${i}`} className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 flex-1 t-body text-ink-2">{row.label}</dt>
            <dd className="shrink-0 t-body text-ink tabular-nums">
              {formatLei(row.value)} <span className="t-caption text-muted">lei</span>
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-2.5">
          <dt className="t-body-strong text-ink">Total</dt>
          <dd className="t-body-strong text-accent-ink tabular-nums">
            {formatLei(total)} <span className="t-caption font-bold">lei</span>
          </dd>
        </div>
      </dl>
      {composed ? <p className="t-caption text-muted">{composed}</p> : null}
    </Card>
  );
}
