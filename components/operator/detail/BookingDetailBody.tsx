'use client';

import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';
import {
  BanknotesIcon,
  CalculatorIcon,
  CalendarIcon,
  ChatBubbleLeftIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  XCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { BookingStatusPill } from '@/components/booking';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { BookingDTO } from '@/core/booking';
import { track } from '@/lib/analytics';
import { anglerHref } from '@/lib/routes';
import { AnglerRatingBadge } from '../AnglerRatingBadge';
import { NoShowPill } from '../NoShowPill';
import type { BookingDetailModel, DetailLine } from './model';

/** A soft block under the header (fish Block): hairline on top, icon + title, then its lines. */
function Block({ title, icon, testId, children }: { title: string; icon: ReactNode; testId: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2.5 border-t border-hairline pt-3.5">
      <h3 className="flex items-center gap-1.5 t-body-strong text-ink">
        <span aria-hidden className="text-muted [&>svg]:size-4">
          {icon}
        </span>
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Line({ label, value, strong }: DetailLine) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 shrink t-body text-muted">{label}</span>
      <span className={cn('truncate text-right tabular-nums text-ink', strong ? 't-body-strong' : 't-body')}>{value}</span>
    </div>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="t-body break-words whitespace-pre-line text-ink">{children}</p>;
}

/**
 * The booking opened up (fish DetailBody): the card's header — avatar with the rating pill, name with
 * the no-show pill, stand + extras, period, price and the status pill — then the soft blocks with
 * everything the card does not say. `onNavigate` closes the dialog and goes to `href` (the profile).
 */
export function BookingDetailBody({
  booking,
  model: m,
  onNavigate,
}: {
  booking: BookingDTO;
  model: BookingDetailModel;
  onNavigate: (href: string) => void;
}) {
  const profile = m.anglerId ? anglerHref(m.anglerId) : null;
  const go = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!profile || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(profile);
  };
  const avatar = (
    <Avatar name={m.name} src={m.avatar} size={48} tone={toneForId(m.anglerId ?? booking.documentId)} />
  );
  return (
    <div data-testid="booking-detail" data-booking={booking.documentId} className="flex flex-col gap-3.5">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          {profile ? (
            // The name is the link for assistive tech; the avatar repeats it for the pointer.
            <Link href={profile} onClick={go} tabIndex={-1} aria-hidden className="flex rounded-full transition-opacity hover:opacity-80">
              {avatar}
            </Link>
          ) : (
            avatar
          )}
          <AnglerRatingBadge userId={m.anglerId} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.75">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {profile ? (
              <Link
                href={profile}
                onClick={go}
                data-testid="booking-detail-angler"
                className="min-w-0 rounded-sm break-words t-heading text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
              >
                {m.name}
              </Link>
            ) : (
              <span data-testid="booking-detail-angler" className="min-w-0 break-words t-heading text-ink">
                {m.name}
              </span>
            )}
            <NoShowPill userId={m.anglerId} />
          </div>
          {m.standLabel || m.extras.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {m.standLabel ? <span className="t-caption font-extrabold text-accent-ink">{m.standLabel}</span> : null}
              {m.extras.map((e) => (
                <span key={e.key} className="rounded-full bg-status-success-bg px-1.75 py-px t-caption font-bold text-status-success-fg">
                  {e.label}
                </span>
              ))}
            </div>
          ) : null}
          <p data-testid="booking-detail-period" className="t-caption text-muted">
            {m.periodLine}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <p data-testid="booking-detail-price" className="t-body-strong whitespace-nowrap tabular-nums text-ink">
            {m.price}
          </p>
          <BookingStatusPill status={booking.bookingStatus} cancelledBy={booking.cancelledBy} noShow={booking.noShow} viewer="operator" />
        </div>
      </div>

      {m.basis ? (
        <Block title="Cum s-a calculat" icon={<CalculatorIcon />} testId="booking-detail-basis">
          {m.basis.lines.map((l, i) => (
            <Line key={i} {...l} />
          ))}
          <span aria-hidden className="h-px bg-hairline" />
          <Line {...m.basis.total} />
        </Block>
      ) : null}

      <Block title="Plată" icon={<BanknotesIcon />} testId="booking-detail-payment">
        {m.payment.map((l) => (
          <Line key={l.label} {...l} />
        ))}
      </Block>

      <Block title="Rezervare" icon={<CalendarIcon />} testId="booking-detail-request">
        {m.request.map((l) => (
          <Line key={l.label} {...l} />
        ))}
      </Block>

      {m.note ? (
        <Block title="Mesaj de la pescar" icon={<ChatBubbleLeftIcon />} testId="booking-detail-note">
          <Prose>{`„${m.note}”`}</Prose>
        </Block>
      ) : null}
      {m.reason ? (
        <Block title={m.reason.title} icon={<XCircleIcon />} testId="booking-detail-reason">
          <Prose>{m.reason.text}</Prose>
        </Block>
      ) : null}
      {m.noShowNote ? (
        <Block title="Neprezentare" icon={<ExclamationTriangleIcon />} testId="booking-detail-no-show">
          <Prose>{m.noShowNote}</Prose>
        </Block>
      ) : null}
    </div>
  );
}

/**
 * fish BookingActionRow, stretched (the sheet's variant): «Sună» first whenever there is a phone, then
 * pending → Refuză + Acceptă; cancellable → Anulează rezervarea; rateable → Evaluează pescarul.
 * Renders null when there is nothing to do (no phone, no action).
 */
export function BookingDetailActions({
  booking,
  model: m,
  lakeId,
  lakeName,
  acting,
  onAccept,
  onReject,
  onCancel,
  onRate,
}: {
  booking: BookingDTO;
  model: BookingDetailModel;
  lakeId: string;
  lakeName?: string | null;
  acting: boolean;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onRate: () => void;
}) {
  if (!m.phone && m.actions === 'none') return null;
  const call = m.phone ? (
    <a
      href={`tel:${m.phone}`}
      aria-label="Sună"
      title="Sună"
      data-testid="booking-detail-call"
      onClick={() =>
        track('contact_pressed', {
          contact_type: 'Operator guest contact',
          lake_id: booking.lake?.documentId ?? lakeId,
          lake_name: booking.lake?.name ?? lakeName,
        })
      }
      className={buttonClass({ variant: 'secondary', className: 'w-12 px-0! xl:w-10' })}
    >
      <PhoneIcon aria-hidden className="size-5" />
    </a>
  ) : null;
  return (
    <div data-testid="booking-detail-actions" data-variant={m.actions} className="flex w-full items-center gap-2">
      {call}
      {m.actions === 'pending' ? (
        <>
          <Button variant="danger" className="flex-1" disabled={acting} onClick={onReject} icon={<XMarkIcon strokeWidth={2.4} />}>
            Refuză
          </Button>
          <Button className="flex-1" disabled={acting} onClick={onAccept} icon={<CheckIcon strokeWidth={2.4} />}>
            Acceptă
          </Button>
        </>
      ) : m.actions === 'cancel' ? (
        <Button variant="danger" className="flex-1" disabled={acting} onClick={onCancel}>
          Anulează rezervarea
        </Button>
      ) : m.actions === 'rate' ? (
        <Button className="flex-1" onClick={onRate} icon={<StarIcon className="text-rating" />}>
          Evaluează pescarul
        </Button>
      ) : null}
    </div>
  );
}
