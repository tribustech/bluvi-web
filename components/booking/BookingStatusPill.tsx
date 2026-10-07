import { cn } from '@/components/ui/cn';
import { statusAppearance, type CancelledBy } from '@/core/booking';
import { bookingTone, type BookingTone } from './model';

/*
 * fish features/bookings/ui/StatusPill.tsx — the booking's state, written from the viewer's side
 * (core statusAppearance: «Anulată de tine» / «Anulată de baltă» / «Anulare automată», a no-show
 * «Nu a venit» whatever the status, an unknown status as «În așteptare»). The shape is the kit
 * StatusPill's (components/ui/StatusPill: a state is radius 999); the colours are fish's semantic
 * tints on the kit's status tokens — yellow, green, an outlined white for «Încheiată», red for every
 * bad ending.
 */
const TONE: Record<BookingTone, string> = {
  warning: 'bg-status-warning-bg text-status-warning-fg',
  success: 'bg-status-success-bg text-status-success-fg',
  outline: 'bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--color-accent-tint-2)]',
  danger: 'bg-status-danger-bg text-status-danger-fg',
};

export function BookingStatusPill({
  status,
  cancelledBy,
  noShow,
  viewer = 'angler',
  className,
}: {
  status: string;
  cancelledBy?: CancelledBy;
  noShow?: boolean;
  viewer?: 'angler' | 'operator';
  className?: string;
}) {
  const { label } = statusAppearance(status, { cancelledBy, viewer, noShow });
  const tone = bookingTone(status, noShow);
  return (
    <span
      data-tone={tone}
      className={cn('t-label inline-flex h-6.5 shrink-0 items-center whitespace-nowrap rounded-full px-2.5', TONE[tone], className)}
    >
      {label}
    </span>
  );
}
