'use client';

import { OPERATOR_CANCEL_REASONS } from '@/core/booking';
import { ReasonDialog, type ReasonDialogProps } from './ReasonField';

/**
 * fish OperatorActionSheets' cancel sheet (CancelBookingSheet + OPERATOR_CANCEL_REASONS): «Anulează
 * rezervarea» with a required pick of six reasons that prefill the editable text («Alt motiv» leaves
 * it empty). «Da, anulează», or «Da, marchează» while «Pescarul nu s-a prezentat» is picked — that
 * one is a no-show, not a cancellation (the caller routes on the key).
 */
export function OperatorCancelDialog(props: ReasonDialogProps) {
  return (
    <ReasonDialog
      {...props}
      title="Anulează rezervarea"
      confirmLabel="Da, anulează"
      placeholder="Motivul anulării..."
      fieldLabel="Mesajul pentru pescar"
      reasons={OPERATOR_CANCEL_REASONS}
      testId="cancel-dialog"
    />
  );
}
