'use client';

import Image from 'next/image';
import { ArrowPathIcon, ArrowUpTrayIcon, CheckBadgeIcon, LockClosedIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { raffleCopy } from './copy';

/** fish raffle/confirmation.tsx:284 — the line in place of a receipt without an image URL (not in raffleCopy). */
export const RECEIPT_NO_IMAGE = 'Bon încărcat. Poți înlocui sau șterge până la termenul limită.';
/** Web only: fish swallows a failed delete (confirmation.tsx:50-57 has no catch); the web says so. */
export const RECEIPT_DELETE_FAILED = 'Nu am putut șterge bonul. Te rugăm să încerci din nou.';

export type ReceiptCardModel = {
  /** The receipt image, or null → the fallback line. */
  imageUrl: string | null;
  fallback: string | null;
  /** «Nu mai poți modifica bonul după termenul limită.» when the receipt is locked. */
  cutoffHint: string | null;
  replaceDisabled: boolean;
  deleteDisabled: boolean;
};

/**
 * What the card shows (fish confirmation.tsx:228-306): the image or the fallback line; replace and
 * delete only while `canChange` (core deriveRaffleState: not ended AND registration open), delete
 * also off while it runs; the cutoff hint when locked (c6, c7).
 */
export function receiptCardModel({ imageUrl, canChange, deleting = false }: { imageUrl: string | null; canChange: boolean; deleting?: boolean }): ReceiptCardModel {
  const url = imageUrl?.trim() ? imageUrl : null;
  return {
    imageUrl: url,
    fallback: url ? null : RECEIPT_NO_IMAGE,
    cutoffHint: canChange ? null : raffleCopy.status.receiptCutoffHint,
    replaceDisabled: !canChange,
    deleteDisabled: deleting || !canChange,
  };
}

type Props = {
  imageUrl: string | null;
  /** core RaffleState.canChangeType. */
  canChange: boolean;
  /** The card's h2 (confirmation: «Mărește-ți șansele de câștig!»); omitted → «Bonul tău încărcat» is the heading. */
  title?: string;
  headingId?: string;
  /** Opens the upload dialog in replace mode. Without it (and without onDelete) the card has no actions. */
  onReplace?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  /** Shown under the actions (role alert) — a failed delete. */
  error?: string | null;
  className?: string;
};

/**
 * «Bonul tău încărcat» (fish raffle/confirmation.tsx:228-306, reused by «Șansele mele»): the bonus
 * line, the receipt (image, contained, max 320 × 200 as fish; or the fallback line), the cutoff hint
 * when locked, «Înlocuiește bonul» and «Șterge bonul» (busy while deleting). A private receipt is
 * shown `unoptimized`: the browser fetches it directly, it never lands in the image optimizer's
 * shared cache.
 */
export function ReceiptCard({ imageUrl, canChange, title, headingId = 'bon-incarcat', onReplace, onDelete, deleting = false, error, className }: Props) {
  const m = receiptCardModel({ imageUrl, canChange, deleting });
  const C = raffleCopy.confirmation;
  const S = raffleCopy.status;
  const hasActions = Boolean(onReplace || onDelete);
  const labelId = `${headingId}-eticheta`;

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={deleting || undefined}
      data-testid="receipt-card"
      className={cn('flex flex-col gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6', className)}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-success-bg text-status-success-fg">
          <CheckBadgeIcon className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          {title ? (
            <>
              <h2 id={headingId} tabIndex={-1} className="t-heading text-ink outline-none">
                {title}
              </h2>
              <p id={labelId} className="t-body-strong text-ink-2">
                {C.receiptUploadedLabel}
              </p>
            </>
          ) : (
            <h2 id={headingId} tabIndex={-1} className="t-heading text-ink outline-none">
              {C.receiptUploadedLabel}
            </h2>
          )}
          <p className="t-caption text-ink-2">{C.receiptUploadedDescription}</p>
        </div>
      </div>

      {m.imageUrl ? (
        <div className="flex w-full max-w-84 justify-center self-center rounded-control bg-soft-fill p-2 md:self-start">
          <span className="relative block h-50 w-full max-w-80 overflow-hidden rounded-control">
            <Image src={m.imageUrl} alt={C.receiptUploadedLabel} fill unoptimized sizes="320px" className="object-contain" data-testid="receipt-card-image" />
          </span>
        </div>
      ) : (
        <p className="t-body-strong rounded-control bg-soft-fill p-3 text-ink-2" data-testid="receipt-card-fallback">
          {m.fallback}
        </p>
      )}

      {hasActions && m.cutoffHint ? (
        <p className="t-caption flex items-center gap-1.5 text-ink-2" data-testid="receipt-cutoff">
          <LockClosedIcon aria-hidden className="size-4 shrink-0" />
          {m.cutoffHint}
        </p>
      ) : null}

      {hasActions ? (
        <div className="flex flex-wrap gap-2.5">
          {onReplace ? (
            <Button size="compact" icon={<ArrowUpTrayIcon />} onClick={onReplace} disabled={m.replaceDisabled}>
              {S.replaceReceiptCta}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              size="compact"
              variant="outline"
              icon={deleting ? <ArrowPathIcon className="animate-spin motion-reduce:animate-none" /> : <TrashIcon />}
              onClick={onDelete}
              disabled={m.deleteDisabled}
              aria-busy={deleting || undefined}
            >
              {S.deleteReceiptCta}
            </Button>
          ) : null}
        </div>
      ) : null}

      {hasActions ? (
        <p role="alert" data-testid="receipt-card-error" className="t-body-strong text-status-danger-fg empty:hidden">
          {error ?? ''}
        </p>
      ) : null}
    </section>
  );
}
