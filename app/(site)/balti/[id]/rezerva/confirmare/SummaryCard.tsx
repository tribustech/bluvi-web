import type { ReactNode } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { BanknotesIcon, ClockIcon, MapPinIcon } from '@heroicons/react/16/solid';
import { T4PriceRows, T4Rows, T4TotalLine, type T4Row } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';
import { buildBookingChips, formatBookingPeriod, formatLei, rowLabelAddsMeaning, type ChipVariant } from '@/core/booking';
import { priceRows, totalRow, type PricedQuote, type ReviewLake } from './model';

/*
 * The booking under review — fish features/lakes/booking/BookingReview.tsx (c4–c7): the stand badge,
 * the lake and its county, the chips (stand, duration, «Numerar» for a cash lake), the period (end
 * minus the lake's checkout buffer), the rate row's own name only when it says more than the
 * duration, then the server's breakdown and the total by payment mode. Below 1280 the money is in
 * this card; from 1280 it moves to the summary column beside the CTA (`moneyBelowXl`).
 * From 1280 the card is two halves (the form track runs 900–1300 wide there): who and what (badge,
 * lake, chips) | when (the period, the rate's name), split by a hairline — never a 300px column
 * hugging the left edge of an empty card.
 */

/** fish chipModel APPEARANCE, on the system's tints (stand indigo, duration grey, payment green, gate yellow). */
const CHIP: Record<ChipVariant, { box: string; icon: ReactNode }> = {
  stand: { box: 'bg-accent-tint text-accent-ink', icon: <MapPinIcon /> },
  duration: { box: 'bg-soft-fill text-ink-2', icon: <ClockIcon /> },
  payment: {
    box: 'bg-status-success-bg text-status-success-fg',
    icon: <BanknotesIcon />,
  },
  gate: {
    box: 'bg-status-warning-bg text-status-warning-fg',
    icon: <ClockIcon />,
  },
};

/** «300 lei»: the unit apart from the figure (owner rule 10). */
export function Lei({ amount }: { amount: number }) {
  return (
    <span className="whitespace-nowrap">
      <span className="tabular-nums">{formatLei(amount)}</span> <span className="t-body text-muted">lei</span>
    </span>
  );
}

/** The breakdown rows and the total, shared by the card (below 1280) and the summary column. */
export function moneyRows(quote: PricedQuote): T4Row[] {
  return priceRows(quote).map(r => ({
    label: r.label,
    value: <Lei amount={r.amount} />,
  }));
}

export function MoneyTotal({ lake, quote, live = false }: { lake: ReviewLake; quote: PricedQuote; live?: boolean }) {
  const t = totalRow(lake, quote.total);
  return (
    <T4TotalLine
      live={live}
      total={{
        label: t.label,
        sub: t.sub,
        value: formatLei(t.amount),
        unit: 'lei',
      }}
    />
  );
}

export function SummaryCard({
  lake,
  standName,
  startISO,
  endISO,
  checkoutBufferMinutes,
  quote,
  refreshing,
  stacked = false,
}: {
  lake: ReviewLake;
  standName: string;
  startISO: string;
  endISO: string;
  checkoutBufferMinutes: number;
  quote: PricedQuote;
  /** A newer price is in flight (after a price change): the figures are dimmed until it lands. */
  refreshing: boolean;
  /**
   * One column at every width, the money always inside (the operator's walk-in review docks this
   * card in its own ~360 right column from 1024). Off (the angler's review): the halves from 1280
   * and the money moved to PriceAside there.
   */
  stacked?: boolean;
}) {
  const start = new Date(startISO);
  const hours = Math.max(1, Math.round((new Date(endISO).getTime() - start.getTime()) / 3_600_000));
  const chips = buildBookingChips({
    standName,
    hours,
    startHour: start.getHours(),
    paymentMode: lake.paymentMode,
  });
  const rate = quote.basis.rowLabel;
  return (
    <section
      aria-labelledby="rezervare-balta"
      data-testid="review-summary"
      className={cn(
        'flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6',
        !stacked && 'xl:grid xl:grid-cols-2 xl:gap-x-8'
      )}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-3">
          {/* fish StandBadge: a pill, not a square — stand codes run to «A10». */}
          <span
            data-testid="stand-badge"
            aria-hidden
            className="t-body-strong flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-accent-tint px-2 text-accent-ink"
          >
            {standName}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="rezervare-balta" className="t-heading text-ink">
              {lake.name}
            </h2>
            {lake.county ? <p className="t-caption text-muted">{lake.county}</p> : null}
          </div>
        </div>

        <ul aria-label="Detalii" className="flex flex-wrap gap-1.75">
          {chips.map(c => (
            <li
              key={`${c.variant}-${c.label}`}
              data-chip={c.variant}
              className={cn(
                't-caption flex items-center gap-1.25 rounded-control px-2.5 py-1.25 [&>svg]:size-4 [&>svg]:shrink-0',
                CHIP[c.variant].box
              )}
            >
              {CHIP[c.variant].icon}
              {c.label}
            </li>
          ))}
        </ul>
      </div>

      <div
        data-testid="review-when"
        className={cn('flex min-w-0 flex-col gap-4', !stacked && 'xl:justify-center xl:border-l xl:border-hairline xl:pl-8')}
      >
        <p className="t-body flex items-center gap-2 text-ink-2" data-testid="review-period">
          <CalendarIcon aria-hidden className="size-5 shrink-0 text-muted" />
          {formatBookingPeriod(startISO, endISO, checkoutBufferMinutes)}
        </p>

        {/* The operator's own name for this tour, only when it says more than the duration chip:
          «Pachet weekend redus» earns the space, «Tur 12h» repeats it (fish BookingReview:115-126). */}
        {rowLabelAddsMeaning(rate, quote.basis.durationHours) ? (
          <p data-testid="review-rate" className="t-caption self-start rounded-full bg-status-success-bg px-2 py-0.5 text-status-success-fg">
            {rate}
          </p>
        ) : null}
      </div>

      <div
        className={cn('flex flex-col gap-3', !stacked && 'xl:hidden', refreshing && 'opacity-45')}
        data-testid="review-money"
        data-stale={refreshing || undefined}
      >
        <T4PriceRows rows={moneyRows(quote)} />
        <MoneyTotal lake={lake} quote={quote} live />
      </div>
    </section>
  );
}

/** From 1280: the right column's price, above the CTA. */
export function PriceAside({ lake, quote, refreshing }: { lake: ReviewLake; quote: PricedQuote; refreshing: boolean }) {
  return (
    <section
      aria-label="Prețul"
      data-testid="review-aside"
      data-stale={refreshing || undefined}
      className={cn('flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6', refreshing && '[&>*:not(h2)]:opacity-45')}
    >
      <h2 className="t-eyebrow text-muted uppercase">Prețul</h2>
      <T4Rows rows={moneyRows(quote)} />
      <MoneyTotal lake={lake} quote={quote} live />
    </section>
  );
}
