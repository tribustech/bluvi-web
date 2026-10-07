'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PhoneIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { BookingStatusPill } from '@/components/booking';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { formatLei, type BookingDTO } from '@/core/booking';
import { track } from '@/lib/analytics';
import { routes } from '@/lib/routes';
import { formatPhone, type BookingDetailModel } from './model';
import { RebookCard } from './RebookCard';

/*
 * The booking page's actions (fish MyBookingRow `actions`, features/bookings/MyBookingRow.tsx:95-229):
 *  - c3 «Lasă o recenzie» — yellow with the star (fish SlimButton «rating»: amber-500 with white text
 *    fails AA, so the kit's rating amber with the medal ink), to the lake's review form filed against
 *    this booking;
 *  - c4 the call — «Sună pentru anulare» / «Sună la baltă», tel: + contact_pressed;
 *  - c5 «Anulează» — opens the cancel dialog (the page owns it).
 * Two homes: the phone's bottom bar (DetailActionBar, below 1024) and the sticky summary card on the
 * right from 1024 (ActionsCard).
 */

/** fish SlimButton «rating»: filled amber, star, the medal ink on it (AA in both themes). */
const REVIEW_CLASS = cn(
  'inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control',
  't-body-strong h-12 px-5 xl:h-10',
  'bg-rating text-on-medal shadow-button hover:brightness-95 active:opacity-80',
  'transition-[filter,opacity] duration-(--duration-fast) ease-fast',
);

export type ActionHandlers = {
  /** The cancel dialog opener (it remembers its trigger, for the focus return). */
  onCancel: (trigger: HTMLElement) => void;
  /** «Lasă o recenzie» is offered (c3, the viewer's review read settled with none — rule 4). */
  canReview: boolean;
};

export function bookingActionButtons({
  booking,
  model,
  canReview,
  onCancel,
  block = false,
  showNumber = false,
}: {
  booking: BookingDTO;
  model: BookingDetailModel;
  block?: boolean;
  /** The action card (from 1024): the number printed under the call — a desktop's tel: may do nothing. */
  showNumber?: boolean;
} & ActionHandlers) {
  const lakeId = booking.lake?.documentId;
  const buttons: ReactNode[] = [];
  if (canReview && lakeId) {
    buttons.push(
      <Link key="review" href={routes.lakeReview(lakeId, { rezervare: booking.documentId })} className={cn(REVIEW_CLASS, block && 'w-full')}>
        <StarIcon aria-hidden className="size-4" />
        Lasă o recenzie
      </Link>,
    );
  }
  if (model.callLabel && model.lakePhone) {
    const phone = model.lakePhone;
    const call = (
      <a
        key="call"
        href={`tel:${phone.replace(/\s+/g, '')}`}
        data-testid="booking-call"
        className={buttonClass({ variant: 'secondary', block })}
        onClick={() => track('contact_pressed', { contact_type: 'Booking lake contact', lake_id: lakeId, lake_name: booking.lake?.name })}
      >
        <PhoneIcon aria-hidden className="size-5" strokeWidth={1.8} />
        {model.callLabel}
      </a>
    );
    buttons.push(
      showNumber ? (
        // A desktop's tel: often does nothing (or opens an app picker), and with the notice window
        // closed the call is the only way to cancel (c5): the number itself, selectable.
        <div key="call" className="flex flex-col gap-1">
          {call}
          <p data-testid="booking-call-number" className="text-center t-caption text-muted">
            Telefon baltă: <span className="select-all t-body-strong whitespace-nowrap text-ink tabular-nums">{formatPhone(phone)}</span>
          </p>
        </div>
      ) : (
        call
      ),
    );
  }
  if (model.showCancel) {
    buttons.push(
      <Button key="cancel" variant="danger" block={block} onClick={(e) => onCancel(e.currentTarget)}>
        Anulează
      </Button>,
    );
  }
  return buttons.length ? <>{buttons}</> : null;
}

/**
 * The sticky summary card from 1024 (owner rule 1, Airbnb's booking card): the total as the headline
 * (unit spaced, rule 10) with the status pill, the lake and stand, the actions at full width (the
 * call with its number printed under it), the notice line (c5) as its footnote, and — for a past
 * booking — the rebook block (c10).
 * A dead booking (`quiet`: cancelled, rejected, no-show — the booking card beside it recedes, fish
 * MyBookingRow mutes its price) owes nothing: no price headline (rule 4); the card leads with the
 * status pill and the rebook block.
 */
export function ActionsCard({ booking, model, quiet, canReview, onCancel }: { booking: BookingDTO; model: BookingDetailModel; quiet: boolean } & ActionHandlers) {
  const buttons = bookingActionButtons({ booking, model, canReview, onCancel, block: true, showNumber: true });
  const lake = booking.lake;
  return (
    <div data-testid="booking-actions-card" data-quiet={quiet ? '' : undefined} className="flex flex-col gap-4 rounded-card bg-surface p-6 shadow-e2">
      {quiet ? (
        <BookingStatusPill status={booking.bookingStatus} cancelledBy={booking.cancelledBy} noShow={booking.noShow} className="self-start" />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <SignatureNumber size="stat" value={formatLei(booking.priceTotal)} unit="lei" caption="Total" />
          <BookingStatusPill status={booking.bookingStatus} cancelledBy={booking.cancelledBy} noShow={booking.noShow} className="mt-2" />
        </div>
      )}
      {lake ? (
        <p className="t-body text-ink-2">
          <Link href={routes.lake(lake.documentId)} className="t-body-strong text-ink underline-offset-2 hover:underline">
            {lake.name}
          </Link>
          {booking.stand?.name ? ` · Standul ${booking.stand.name}` : null}
        </p>
      ) : null}
      {buttons ? <div className="flex flex-col gap-2">{buttons}</div> : null}
      {model.noticeLine ? <p className="t-caption text-muted">{model.noticeLine}</p> : null}
      {model.rebook ? (
        <RebookCard bare lakeId={model.rebook.lakeId} lakeName={model.rebook.lakeName} bookingId={booking.documentId} className="border-t border-hairline pt-4" />
      ) : null}
    </div>
  );
}
