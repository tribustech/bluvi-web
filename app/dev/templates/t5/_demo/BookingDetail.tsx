'use client';

import { createContext, use, useState, type ReactNode } from 'react';
import type { OperatorUpcomingBooking } from '@/core/lakes';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { Avatar } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatBookingPeriod, lei } from './format';
import { operatorLinks } from './links';

/**
 * The booking detail of a today row (parity operator.panou.c19 → operator.detaliu-rezervare).
 * A STUB until M7 builds the real dialog: it opens on the row's own booking (detaliu-rezervare.c2
 * — the row's data at once) with the header facts and a link to the booking in «Rezervări». One
 * surface per page (the rows sit in both compositions of the layout), on the Fundații rule: a
 * sheet on a phone, a dialog from 768.
 */
type Open = (booking: OperatorUpcomingBooking) => void;
const OpenContext = createContext<Open | null>(null);

export function BookingDetailProvider({
  lakeId,
  initial = null,
  children,
}: {
  lakeId: string;
  /** Open on this booking at first render (the demo's ?state=detail). */
  initial?: OperatorUpcomingBooking | null;
  children: ReactNode;
}) {
  const [booking, setBooking] = useState<OperatorUpcomingBooking | null>(initial);
  const [open, setOpen] = useState(initial !== null);
  const mobile = useBreakpoint() === 'mobile';
  const close = () => setOpen(false);
  const show: Open = (b) => {
    setBooking(b);
    setOpen(true);
  };

  const name = booking?.anglerName ?? 'Pescar';
  const total = Number(booking?.priceTotal) || 0;
  const due = booking?.balanceDue != null && booking.balanceDue > 0;
  const title = 'Rezervare';
  const subtitle = booking?.standName ? `Standul ${booking.standName}` : undefined;
  const body = booking ? (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={name} src={booking.anglerAvatar} size={48} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate t-body-strong text-ink">{name}</p>
          <p className="t-caption text-muted">{formatBookingPeriod(booking.startDate, booking.endDate)}</p>
        </div>
      </div>
      <dl className="flex flex-col divide-y divide-hairline rounded-control bg-page">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="t-body text-muted">Total</dt>
          <dd className="t-body-strong text-ink tabular-nums">{total > 0 ? `${lei(total)} lei` : 'Gratuit'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="t-body text-muted">Plată</dt>
          <dd>
            {booking.noShow ? (
              <StatusPill tone="neutral">N-a venit</StatusPill>
            ) : total <= 0 ? (
              <span className="t-body text-ink">—</span>
            ) : due ? (
              <StatusPill tone="warning">Numerar la sosire</StatusPill>
            ) : (
              <StatusPill tone="success">Plătit</StatusPill>
            )}
          </dd>
        </div>
        {booking.code ? (
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="t-body text-muted">Cod</dt>
            <dd className="t-body-strong text-ink">{booking.code}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  ) : null;
  const link = booking?.documentId ? (
    <ButtonLink href={`${operatorLinks.bookings(lakeId)}?booking=${encodeURIComponent(booking.documentId)}`} variant="secondary" className="w-full md:w-auto">
      Vezi în Rezervări
    </ButtonLink>
  ) : null;

  return (
    <OpenContext value={show}>
      {children}
      {mobile ? (
        <Sheet open={open} onClose={close} title={title} subtitle={subtitle} footer={link}>
          {body ?? <span />}
        </Sheet>
      ) : (
        <Dialog open={open} onClose={close} title={title} subtitle={subtitle} actions={link} closeButton>
          {body}
        </Dialog>
      )}
    </OpenContext>
  );
}

/**
 * The row's one control: the angler's name as a button whose hit area covers the whole row (the
 * stretched-link pattern of CardShell — the row's other text stays plain text for screen readers,
 * and the focus ring draws round the row). The row needs `relative`. Without a documentId (or
 * outside the provider) the name stays plain text: those rows are not interactive (c19).
 */
export function BookingRowName({
  booking,
  label,
  className,
}: {
  booking: OperatorUpcomingBooking;
  /** Accessible name: «Mihai Popescu, standul 1». */
  label: string;
  className?: string;
}) {
  const open = use(OpenContext);
  const name = booking.anglerName ?? 'Pescar';
  if (!booking.documentId || !open) return <span className={className}>{name}</span>;
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      onClick={() => open(booking)}
      className={cn(
        'cursor-pointer text-left outline-none',
        "after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent",
        className,
      )}
    >
      {name}
    </button>
  );
}
