'use client';

import { CheckIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { T4Rows, T4TotalLine } from '@/components/templates/T4/T4Summary';
import { Button } from '@/components/ui/Button';
import { formatLei, type BookingDTO } from '@/core/booking';
import { acceptSummary } from './model';

/**
 * fish features/operator/AcceptBookingSheet.tsx — the confirmation before an operator accepts a
 * request. Accepting notifies the angler and locks the stand for that interval, neither recoverable
 * from a mis-click, so «Acceptă» opens this instead of acting. A sheet on the phone, an alert dialog
 * from 768 (intent «decision»).
 *
 * Body: stand badge (when a stand), angler, period; rows «Stand» / «Extra» (only when present); the
 * total «Încasezi · la fața locului · {n} lei». «Renunță» closes; «Confirmă» hands over to the caller,
 * which closes this and runs the write (the row's buttons carry the wait, fish actingId). While any
 * other write runs, «Confirmă» is busy (fish `isPending: !!actingId`).
 */
export function AcceptBookingDialog({
  booking,
  submitting,
  onClose,
  onConfirm,
}: {
  booking: BookingDTO | null;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!booking) return null;
  const s = acceptSummary(booking);
  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="decision"
      title="Accepți rezervarea?"
      sheetSnap="fit"
      actions={
        // Phone sheet: one row, the confirm a little wider (fish flex 1 / 1.25); the dialog lays them out itself.
        <div className="flex gap-2 md:contents">
          <Button type="button" variant="secondary" onClick={onClose} className="max-md:flex-1">
            Renunță
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            aria-busy={submitting || undefined}
            icon={
              submitting ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
              ) : (
                <CheckIcon strokeWidth={2.4} />
              )
            }
            data-testid="accept-confirm"
            className="max-md:flex-[1.25]"
          >
            Confirmă
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="accept-dialog">
        <p className="t-body text-muted">Pescarul primește notificare, iar standul se blochează pentru acest interval.</p>
        <div className="flex items-center gap-3">
          {s.standName ? (
            // fish StandBadge: a pill, not a square — stand codes run to «A10».
            <span
              aria-hidden
              data-testid="accept-stand-badge"
              className="t-body-strong flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-accent-tint px-2 text-accent-ink"
            >
              {s.standName}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="t-heading truncate text-ink">{s.anglerName}</p>
            <p className="t-caption text-muted">{s.period}</p>
          </div>
        </div>
        {s.rows.length ? <T4Rows rows={s.rows} /> : null}
        <T4TotalLine total={{ label: 'Încasezi', sub: 'la fața locului', value: formatLei(s.amount), unit: 'lei' }} />
      </div>
    </ResponsiveSurface>
  );
}
