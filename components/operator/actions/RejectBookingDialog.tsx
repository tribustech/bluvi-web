'use client';

import { ReasonDialog, type ReasonDialogProps } from './ReasonField';

/**
 * fish OperatorActionSheets' reject sheet (CancelBookingSheet with the reject copy): «Respinge
 * rezervarea», mandatory free-text reason (≥ 5 after trim), «Înapoi» / «Da, respinge».
 */
export function RejectBookingDialog(props: ReasonDialogProps) {
  return (
    <ReasonDialog
      {...props}
      title="Respinge rezervarea"
      confirmLabel="Da, respinge"
      placeholder="Motivul refuzului..."
      fieldLabel="Motivul refuzului"
      testId="reject-dialog"
    />
  );
}
