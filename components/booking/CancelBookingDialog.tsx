'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { T4TextArea } from '@/components/templates/T4/T4TextArea';
import { Button } from '@/components/ui/Button';
import { cancelBookingMutation, friendlyCancelError, MIN_CANCEL_REASON_LEN, type BookingDTO } from '@/core/booking';
import { createBrowserTransport } from '@/lib/client/transport';

const FORM_ID = 'cancel-booking-form';

/**
 * fish features/bookings/CancelBookingSheet.tsx (the angler's free-text flow) + the confirm wiring of
 * app/(app)/bookings/[id].tsx / index.tsx: a sheet on the phone, a dialog from 768 (ResponsiveSurface
 * intent «decision»).
 *
 *  - Title «Anulează rezervarea»; «Această acțiune este definitivă. Spune-ne motivul — îl trimitem
 *    celeilalte părți.» plus «Avansul de {n} lei poate să nu fie restituit, conform politicii lacului.»
 *    when the booking holds a deposit.
 *  - The reason is mandatory: trimmed ≥ MIN_CANCEL_REASON_LEN (5), else after a confirm attempt the
 *    field turns red with «Motivul este obligatoriu (minim 5 caractere).». Closing resets the text and
 *    the error (fish onDismiss): the surface is mounted only while open.
 *  - «Da, anulează» sends the trimmed reason (core cancelBookingMutation: invalidates every bookings
 *    query and the operator stats); «Înapoi» is disabled while it runs. Success → toast «Rezervare
 *    anulată», the surface closes, `onCancelled` (the detail page goes back). Failure → a toast with
 *    friendlyCancelError (the server's Romanian sentence, never a bare code); the surface stays.
 */
export function CancelBookingDialog({
  booking,
  open,
  onClose,
  onCancelled,
}: {
  booking: Pick<BookingDTO, 'documentId' | 'depositAmount'> | null;
  open: boolean;
  onClose: () => void;
  onCancelled?: () => void;
}) {
  // Mounted only while open (as the home's feedback surface): closing unmounts it, which resets the
  // text and the error (fish onDismiss), and a reopen starts clean.
  if (!open || !booking) return null;
  return <CancelSurface key={booking.documentId} booking={booking} onClose={onClose} onCancelled={onCancelled} />;
}

function CancelSurface({
  booking,
  onClose,
  onCancelled,
}: {
  booking: Pick<BookingDTO, 'documentId' | 'depositAmount'>;
  onClose: () => void;
  onCancelled?: () => void;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const cancel = useMutation(cancelBookingMutation(t, qc));
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_CANCEL_REASON_LEN;
  const pending = cancel.isPending;

  const close = () => {
    if (!pending) onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setTouched(true);
    if (!valid) return;
    cancel.mutate(
      { id: booking.documentId, reason: trimmed },
      {
        onSuccess: () => {
          toast('Rezervare anulată', 'success');
          onClose();
          onCancelled?.();
        },
        onError: (err) => toast(friendlyCancelError(err), 'danger'),
      }
    );
  };

  return (
    <ResponsiveSurface
      open
      onClose={close}
      intent="decision"
      title="Anulează rezervarea"
      sheetSnap="fit"
      actions={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={pending}>
            Înapoi
          </Button>
          <Button type="submit" variant="danger" form={FORM_ID} aria-disabled={pending || undefined} aria-busy={pending || undefined}>
            {pending ? 'Se anulează…' : 'Da, anulează'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="t-body text-muted">
          Această acțiune este definitivă. Spune-ne motivul — îl trimitem celeilalte părți.
          {booking.depositAmount > 0
            ? ` Avansul de ${booking.depositAmount} lei poate să nu fie restituit, conform politicii lacului.`
            : ''}
        </p>
        <T4TextArea
          label="Motivul anulării"
          placeholder="Motivul anulării..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          readOnly={pending}
          error={touched && !valid ? `Motivul este obligatoriu (minim ${MIN_CANCEL_REASON_LEN} caractere).` : undefined}
        />
      </form>
    </ResponsiveSurface>
  );
}
