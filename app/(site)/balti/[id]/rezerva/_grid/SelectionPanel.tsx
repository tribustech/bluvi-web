'use client';

import type { ReactNode, Ref } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { durationLabel, formatBookingPoint, rowLabelAddsMeaning, type BookingQuote } from '@/core/booking';
import { T4Spinner } from '@/components/templates/T4';
import { lei, selectionNote } from './model';
import { Button, buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * The selection panel — fish BookingSelectionSheet (+ its host). It rises with the first selection
 * and follows every change live (c36): «Stand {name}», the start / end timeline (the end minus the
 * lake's checkout buffer, c28), the server's bare-tour price (c29–c31), the duration and — only when
 * it says more — the rate row's own name (c30), the note by extras / payment mode (c33), a refusal or
 * a failed quote with its retry (c31, c32), then «Anulează» and «Continuă» (c35).
 *
 * Non-modal everywhere: no backdrop, the grid stays interactive, nothing traps focus. Below 1024 it
 * is a bottom panel in the page's flow under the grid (the grid gives it its height, so every row
 * can still scroll clear of it — c22); from 1024 the same content is the right column's summary
 * card (owner rule 1).
 */

export type PanelQuote = {
  quote: BookingQuote | null;
  /** A request is in flight (the first one, or a newer one over the previous answer). */
  quoting: boolean;
  failed: boolean;
  onRetry: () => void;
};

type Props = {
  variant: 'sheet' | 'card';
  standName: string;
  startISO: string;
  endISO: string;
  checkoutBufferMinutes: number;
  paymentMode: string | null;
  depositPercent: number | null;
  /** Extras this stand can add to THIS tour (c33, c34). */
  offeredCount: number;
  price: PanelQuote;
  onCancel: () => void;
  onContinue: () => void;
  continueRef?: Ref<HTMLButtonElement>;
  headingId?: string;
};


export function SelectionPanel({
  variant,
  standName,
  startISO,
  endISO,
  checkoutBufferMinutes,
  paymentMode,
  depositPercent,
  offeredCount,
  price,
  onCancel,
  onContinue,
  continueRef,
  headingId,
}: Props) {
  const { quote, quoting, failed, onRetry } = price;
  const refusal = quote?.refusal ?? null;
  const total = quote?.total ?? null;
  const start = new Date(startISO);
  const hours = Math.max(1, Math.round((new Date(endISO).getTime() - start.getTime()) / 3_600_000));
  const rowLabel = quote?.basis?.rowLabel ?? null;
  const held = !!refusal || total == null || quoting;
  const card = variant === 'card';
  const note = selectionNote({ offeredCount, paymentMode, depositPercent, total });
  /** A deposit read off the previous price is as stale as that price while a newer one loads. */
  const noteStale = quoting && total != null && offeredCount === 0 && paymentMode === 'deposit';

  let priceSlot: ReactNode;
  if (total != null) {
    // Dimmed while a newer answer is in flight: the number is real, it is about to be replaced.
    priceSlot = (
      <p data-testid="selection-price" data-stale={quoting || undefined} className={cn('flex items-baseline whitespace-nowrap', quoting && 'opacity-45')}>
        <span className="t-display text-accent-ink tabular-nums">{lei(total)}</span>
        <span className="t-body-strong ms-1 text-muted">{' '}lei</span>
      </p>
    );
  } else if (refusal) {
    priceSlot = (
      <p data-testid="selection-no-price" className="t-display text-muted">
        —
      </p>
    );
  } else if (failed) {
    priceSlot = (
      <div className="flex flex-col items-end gap-0.5 text-right">
        <p data-testid="selection-quote-failed" className="t-body-strong text-status-danger-fg">
          Nu am putut calcula prețul
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="t-body cursor-pointer rounded-control text-accent-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Încearcă din nou
        </button>
      </div>
    );
  } else {
    priceSlot = (
      <p data-testid="selection-quoting" className="t-body flex h-9 items-center gap-2 text-muted">
        <T4Spinner className="text-accent-ink" />
        se calculează
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col', card ? 'gap-4' : 'gap-3 md:gap-4')}>
      {card ? <p className="t-eyebrow text-muted uppercase">Selecția ta</p> : null}
      <div className={cn('flex items-start justify-between gap-4', card && 'flex-col gap-3')}>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <h2 id={headingId} className="t-title2 text-ink">{`Stand ${standName}`}</h2>
          {/* Start above, end below, joined by a rail: the period never wraps mid-date. */}
          <div className="flex gap-2.5">
            <span aria-hidden className="flex w-2 flex-col items-center py-1.5">
              <span className="size-2 shrink-0 rounded-full bg-accent-ink" />
              <span className="my-0.5 w-0.5 flex-1 rounded-full bg-hairline" />
              <span className="size-2 shrink-0 rounded-full border-2 border-accent-ink bg-surface" />
            </span>
            <dl className="flex min-w-0 flex-col gap-1.5">
              <div>
                <dt className="sr-only">Început</dt>
                <dd data-testid="selection-start" className="t-body whitespace-nowrap text-ink">
                  {formatBookingPoint(startISO)}
                </dd>
              </div>
              <div>
                <dt className="sr-only">Sfârșit</dt>
                <dd data-testid="selection-end" className="t-body whitespace-nowrap text-ink">
                  {formatBookingPoint(endISO, checkoutBufferMinutes)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        <div className={cn('flex flex-col gap-1', card ? 'items-start' : 'max-w-[45%] shrink-0 items-end')}>
          <div role="status" aria-live="polite" className={cn('flex min-h-9 flex-col justify-center', card ? 'items-start' : 'items-end')}>
            {priceSlot}
          </div>
          <div className={cn('flex flex-wrap gap-1', card ? 'justify-start' : 'justify-end')}>
            <span data-testid="selection-duration" className="t-caption rounded-full bg-soft-fill px-2 py-0.5 text-ink-2">
              {durationLabel(hours, start.getHours())}
            </span>
            {rowLabelAddsMeaning(rowLabel, hours) ? (
              <span data-testid="selection-rate" className="t-caption rounded-full bg-status-success-bg px-2 py-0.5 text-status-success-fg">
                {rowLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {note ? (
        <p data-testid="selection-note" data-stale={noteStale || undefined} className={cn('t-body text-muted', noteStale && 'opacity-45')}>
          {note}
        </p>
      ) : null}
      {refusal ? (
        <p data-testid="selection-refusal" role="alert" className="t-body text-status-danger-fg">
          {refusal.message}
        </p>
      ) : null}

      <div className={cn('flex gap-3', card && 'flex-col-reverse gap-2.5')}>
        <Button variant="outline" onClick={onCancel} className={card ? 'w-full' : 'flex-1'}>
          Anulează
        </Button>
        {/* Held, never `disabled`: focus stays on it while a price loads (the T4 demo's HeldButton). */}
        <button
          ref={continueRef}
          type="button"
          data-testid="selection-continue"
          aria-disabled={held || undefined}
          onClick={held ? undefined : onContinue}
          className={buttonClass({ disabled: held, className: card ? 'w-full' : 'flex-[2]' })}
        >
          <span aria-hidden className="flex size-5 items-center justify-center [&>svg]:size-5">
            <CheckCircleIcon />
          </span>
          Continuă
        </button>
      </div>
    </div>
  );
}
