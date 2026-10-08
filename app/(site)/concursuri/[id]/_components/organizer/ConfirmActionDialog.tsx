'use client';

import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';

/**
 * fish's confirmation of an organizer write (start / end the competition, close or start a feeder
 * leg): an alert dialog that must be answered. From the header menu it reads like fish's bar
 * («Anulează» / «Confirmă»); from the «Acțiuni» sheet like fish's Alert («Închide» / «Start» |
 * «Încheie»). The phone's bar asks in the bar itself (ActionBar BarConfirmRow). Irreversible writes
 * that notify everyone (start, end, close a leg) confirm with the danger button, as fish's Alert
 * style 'destructive' (components/CompetitionActionSheet.tsx:160,190); a click on the backdrop does
 * not dismiss the question (it must be answered; Escape still answers «Anulează»).
 */
export function ConfirmActionDialog({
  open,
  question,
  cancelLabel,
  confirmLabel,
  confirmVariant = 'primary',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  question: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={question}
      alert
      backdropDismiss={false}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
