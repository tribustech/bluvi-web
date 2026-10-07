import Link from 'next/link';
import type { ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { formatLei, type BookingDTO } from '@/core/booking';
import { BookingLeadThumb } from './BookingLeadThumb';
import { BookingStatusPill } from './BookingStatusPill';
import { bookingCardModel } from './model';

/**
 * fish features/bookings/MyBookingRow.tsx (+ ui/BookingCard) — the angler's booking, in the
 * operator's grammar: lake thumb · lake name · bold stand + extras · period with its length (or the
 * progress while the stay runs) · total + status, then the dead reason and the pending warning.
 *
 * Two modes, as in fish:
 *  - linked (`href`): the list's card, the whole card opens the booking (fish onPress → /bookings/[id]);
 *    no action buttons in the list (booking.rezervarile-mele.c20);
 *  - inert (`href` null / absent): the detail page's copy (booking.rezervare.c2), which brings its own
 *    buttons in `actions` (review, call, cancel) and shows the dead reason in full (`clampReason`).
 * A list row whose detail page is not on the web yet (bookingHref → null) is the inert card — a plain
 * row, never a dead link.
 *
 * The card (fish BookingCard): white on the page with a soft shadow; a dead booking (`quiet`:
 * cancelled, rejected, no-show) recedes onto a flat hairline edge with a muted name and price — never
 * a soft-fill card, which would vanish on the page ground.
 */
export function BookingRow({
  booking,
  nowMs,
  href,
  actions,
  clampReason = true,
  className,
}: {
  booking: BookingDTO;
  /** The browser's clock (fish Date.now() per render): live progress, «Începe mâine». */
  nowMs: number;
  href?: string | null;
  /** Below the card's content (the detail page's buttons). */
  actions?: ReactNode;
  /** The dead reason in two lines at most (the list); false shows it all (the detail). */
  clampReason?: boolean;
  className?: string;
}) {
  const m = bookingCardModel(booking, nowMs);
  const body = (
    <>
      <div className="flex items-start gap-3">
        <BookingLeadThumb thumbUrl={booking.lake?.thumbUrl} dimmed={m.quiet} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          <div className="flex items-start gap-3">
            <p className={cn('min-w-0 flex-1 truncate t-body-strong', m.quiet ? 'text-muted' : 'text-ink')}>{m.lakeName}</p>
            <p className={cn('shrink-0 whitespace-nowrap', m.quiet ? 'text-muted' : 'text-ink')}>
              <span className="t-body-strong tabular-nums">{formatLei(m.priceTotal)}</span>{' '}
              <span className="t-caption text-muted">lei</span>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.75">
              {m.standLabel || m.extras.length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {m.standLabel ? <span className="truncate t-caption font-extrabold text-accent-ink">{m.standLabel}</span> : null}
                  {m.extras.map((e) => (
                    <span key={e.key} className="truncate rounded-full bg-status-success-bg px-1.75 py-px t-caption font-bold text-status-success-fg">
                      {e.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {/* Two lines allowed: a wide status pill («Anulată de baltă») narrows this column. */}
              <p className="line-clamp-2 t-caption text-muted">{m.periodLine}</p>
            </div>
            <BookingStatusPill status={booking.bookingStatus} cancelledBy={booking.cancelledBy} noShow={booking.noShow} />
          </div>
          {m.live ? (
            <div className="flex items-center gap-2" data-testid="booking-progress">
              <span aria-hidden className="h-1 flex-1 overflow-hidden rounded-full bg-hairline">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${m.progressPct}%` }} />
              </span>
              <span className="shrink-0 t-caption text-ink-2">{m.progressLabel}</span>
            </div>
          ) : m.startsIn ? (
            <p className="t-caption font-bold text-accent-ink">{m.startsIn}</p>
          ) : null}
        </div>
      </div>
      {m.deadReason ? (
        <p data-testid="booking-dead-reason" className={cn('t-caption text-muted', clampReason && 'line-clamp-2')}>
          {m.deadReason}
        </p>
      ) : null}
      {/* A pending request must not be misread as a reservation. */}
      {m.pending ? (
        <p className="flex items-center gap-2 rounded-control bg-status-danger-bg px-2.5 py-2 t-caption text-status-danger-fg">
          <ExclamationTriangleIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={2} />
          <span className="flex-1">Locul nu e al tău până confirmă administratorul. Primești notificare.</span>
        </p>
      ) : null}
      {actions}
    </>
  );

  const card = cn(
    'flex flex-col gap-3 rounded-card bg-surface p-4',
    m.quiet ? 'shadow-e0' : 'shadow-e1',
    className,
  );
  const data = { 'data-booking': booking.documentId, 'data-quiet': m.quiet ? '' : undefined, 'data-live': m.live ? '' : undefined };
  if (href) {
    return (
      <Link
        href={href}
        {...data}
        className={cn(
          card,
          'transition-[box-shadow,opacity] duration-(--duration-fast) ease-fast hover:shadow-e2 active:opacity-90',
          'outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        )}
      >
        {body}
      </Link>
    );
  }
  return (
    <div {...data} className={card}>
      {body}
    </div>
  );
}
