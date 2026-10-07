'use client';

import type { ReactNode } from 'react';
import { CheckCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { ArrowUturnLeftIcon, BanknotesIcon, BoltIcon, CalendarDaysIcon, ClockIcon } from '@heroicons/react/24/solid';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { T4Spinner } from '@/components/templates/T4';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { cancellationPolicyText, formatBookingPeriod } from '@/core/booking';
import { collectsUpFront, paymentTermText, type ReviewLake } from './model';

/*
 * The final confirmation — fish features/lakes/booking/BookingConfirmSheet.tsx (c14–c17). «Continuă»
 * validated the contact form and opened it; it restates the terms the angler commits to and only its
 * CTA submits. A sheet on a phone, an alert dialog from 768 (ResponsiveSurface «decision»): focus is
 * held inside, Escape and «Înapoi» close it (not while sending), focus returns to «Continuă».
 *
 * Terms, one after another (each a beat after the previous, as fish's MotiView rows): the period;
 * the money; request vs instant; the cancellation policy ONLY when money is collected up front (a
 * refund line about cash paid on site refers to nothing). The regulation PDF when the lake has one
 * (a new tab). Rule acceptance is the press itself, said under the buttons.
 */

const TONE = {
  accent: 'bg-accent-tint text-accent-ink',
  success: 'bg-status-success-bg text-status-success-fg',
  pending: 'bg-status-pending-bg text-status-pending-fg',
  info: 'bg-status-info-bg text-status-info-fg',
  neutral: 'bg-soft-fill text-ink-2',
} as const;

function Term({ icon, tone, index, children }: { icon: ReactNode; tone: keyof typeof TONE; index: number; children: ReactNode }) {
  return (
    <li
      data-term={index}
      // Mounted with the surface: each row starts transparent and 8px low, a beat after the previous.
      style={{ transitionDelay: `${80 + index * 60}ms` }}
      className="flex translate-y-0 items-center gap-3 opacity-100 transition-[opacity,translate] duration-(--duration-medium) ease-medium starting:translate-y-2 starting:opacity-0"
    >
      <span aria-hidden className={cn('flex size-10 shrink-0 items-center justify-center rounded-full [&>svg]:size-5', TONE[tone])}>
        {icon}
      </span>
      <span className="t-body min-w-0 text-ink-2">{children}</span>
    </li>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  lake,
  standName,
  startISO,
  endISO,
  checkoutBufferMinutes,
  total,
  isRequest,
  pending,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  lake: ReviewLake;
  standName: string;
  startISO: string;
  endISO: string;
  checkoutBufferMinutes: number;
  total: number;
  isRequest: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  const close = () => {
    if (!pending) onClose();
  };
  const submitLabel = isRequest ? 'Trimite cererea' : 'Rezervă';
  return (
    <ResponsiveSurface
      open={open}
      onClose={close}
      intent="decision"
      title="Confirmă rezervarea"
      subtitle={`${lake.name} · Standul ${standName}`}
      sheetSnap="fit"
      sheetFixed
      actions={
        <div className="flex w-full flex-col gap-2.5">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={close} disabled={pending}>
              Înapoi
            </Button>
            <button
              type="button"
              data-testid="booking-confirm-submit"
              aria-disabled={pending || undefined}
              aria-busy={pending || undefined}
              onClick={pending ? undefined : onConfirm}
              className={buttonClass({ disabled: pending, className: 'flex-1' })}
            >
              <span aria-hidden className="flex size-5 items-center justify-center [&>svg]:size-5">
                {pending ? <T4Spinner /> : <CheckCircleIcon />}
              </span>
              {submitLabel}
            </button>
          </div>
          <p className="t-caption text-center text-muted">Prin continuare confirmi că ai citit și accepți regulamentul bălții.</p>
        </div>
      }
    >
      {open ? (
        <div className="flex flex-col gap-4 pt-2">
          <ul aria-label="Ce confirmi" className="flex flex-col gap-3" data-testid="booking-confirm-terms">
            <Term index={0} tone="accent" icon={<CalendarDaysIcon />}>
              {formatBookingPeriod(startISO, endISO, checkoutBufferMinutes)}
            </Term>
            <Term index={1} tone="success" icon={<BanknotesIcon />}>
              {paymentTermText(lake, total)}
            </Term>
            {isRequest ? (
              <Term index={2} tone="pending" icon={<ClockIcon />}>
                Este o cerere, nu o confirmare. Administratorul o acceptă sau o refuză.
              </Term>
            ) : (
              <Term index={2} tone="info" icon={<BoltIcon />}>
                Rezervarea se confirmă imediat.
              </Term>
            )}
            {collectsUpFront(lake.paymentMode) ? (
              <Term index={3} tone="neutral" icon={<ArrowUturnLeftIcon />}>
                {cancellationPolicyText(lake.cancellationPolicy)}
              </Term>
            ) : null}
          </ul>
          {lake.regulationUrl ? (
            <a
              href={lake.regulationUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="booking-confirm-regulation"
              className={buttonClass({ variant: 'secondary', block: true })}
            >
              <DocumentTextIcon aria-hidden className="size-5" />
              Deschide regulamentul (PDF)
              <span className="sr-only"> (se deschide într-o filă nouă)</span>
            </a>
          ) : null}
          {/* «Se trimite…» is said, not only shown on the (still focused) CTA. */}
          <p role="status" className="sr-only">
            {pending ? (isRequest ? 'Se trimite cererea…' : 'Se face rezervarea…') : ''}
          </p>
        </div>
      ) : null}
    </ResponsiveSurface>
  );
}
