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
 * Non-modal everywhere: no backdrop, the grid stays interactive, nothing traps focus. On a phone it
 * is a bottom panel in the page's flow under the grid (the grid gives it its height, so every row
 * can still scroll clear of it — c22). From 768 the same content is one bar docked at the bottom of
 * the grid card, full width (`bar`, owner 2026-10-11: no card beside the grid): stand, period and
 * the note / refusal on the left; on the right, vertically centred, the price (none on a refusal —
 * the reason is on the left), the duration chip and the actions.
 */

export type PanelQuote = {
  quote: BookingQuote | null;
  /** A request is in flight (the first one, or a newer one over the previous answer). */
  quoting: boolean;
  failed: boolean;
  onRetry: () => void;
};

type Props = {
  variant: 'sheet' | 'bar';
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
  /** Continuă is held for a reason of the mount (FlowConfig.continueHeld), said under the buttons. */
  continueHeld?: string | null;
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
  continueHeld = null,
}: Props) {
  const { quote, quoting, failed, onRetry } = price;
  const refusal = quote?.refusal ?? null;
  const total = quote?.total ?? null;
  const start = new Date(startISO);
  const hours = Math.max(1, Math.round((new Date(endISO).getTime() - start.getTime()) / 3_600_000));
  const rowLabel = quote?.basis?.rowLabel ?? null;
  const held = !!refusal || total == null || quoting || !!continueHeld;
  const heldNoteId = headingId ? `${headingId}-held` : undefined;
  const bar = variant === 'bar';
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

  const continueBtn = (
    // Held, never `disabled`: focus stays on it while a price loads (the T4 demo's HeldButton).
    <button
      ref={continueRef}
      type="button"
      data-testid="selection-continue"
      aria-disabled={held || undefined}
      aria-describedby={continueHeld ? heldNoteId : undefined}
      onClick={held ? undefined : onContinue}
      className={buttonClass({ disabled: held, className: bar ? 'min-w-36' : 'flex-[2]' })}
    >
      <span aria-hidden className="flex size-5 items-center justify-center [&>svg]:size-5">
        <CheckCircleIcon />
      </span>
      Continuă
    </button>
  );
  const chips = (
    <div className="flex flex-wrap justify-end gap-1">
      <span data-testid="selection-duration" className="t-caption rounded-full bg-soft-fill px-2 py-0.5 text-ink-2">
        {durationLabel(hours, start.getHours())}
      </span>
      {rowLabelAddsMeaning(rowLabel, hours) ? (
        <span data-testid="selection-rate" className="t-caption rounded-full bg-status-success-bg px-2 py-0.5 text-status-success-fg">
          {rowLabel}
        </span>
      ) : null}
    </div>
  );
  const notes = (
    <>
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
    </>
  );
  const heldNote = continueHeld ? (
    <p id={heldNoteId} data-testid="selection-continue-held" className="t-caption text-muted">
      {continueHeld}
    </p>
  ) : null;

  if (bar) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 xl:flex-nowrap">
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col justify-center gap-1">
          <h2 id={headingId} className="t-heading text-ink">{`Stand ${standName}`}</h2>
          {/* One line, start → end; each end never wraps mid-date. */}
          <p className="t-body flex flex-wrap items-center gap-x-2 text-ink">
            <span className="sr-only">De la </span>
            <span data-testid="selection-start" className="whitespace-nowrap">
              {formatBookingPoint(startISO)}
            </span>
            <span aria-hidden className="text-muted">→</span>
            <span className="sr-only"> până la </span>
            <span data-testid="selection-end" className="whitespace-nowrap">
              {formatBookingPoint(endISO, checkoutBufferMinutes)}
            </span>
          </p>
          {notes}
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-4">
          {/* The price, when there is one (a refusal says why on the left; no «—» here), then the duration. */}
          <div role="status" aria-live="polite" className="flex min-h-9 flex-col items-end justify-center">
            {refusal ? null : priceSlot}
          </div>
          {chips}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Anulează
              </Button>
              {continueBtn}
            </div>
            {heldNote}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="flex items-start justify-between gap-4">
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
        <div className="flex max-w-[45%] shrink-0 flex-col items-end gap-1">
          <div role="status" aria-live="polite" className="flex min-h-9 flex-col items-end justify-center">
            {priceSlot}
          </div>
          {chips}
        </div>
      </div>

      {notes}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Anulează
        </Button>
        {continueBtn}
      </div>
      {heldNote}
    </div>
  );
}
