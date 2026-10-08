'use client';

import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';

/*
 * fish components/EmptyTeamMembersSheet.tsx (parity participant.register.c13): a team registration
 * with nobody added asks first. Non-dismissable, as fish's (renderNonDismissableBackdrop, no pan):
 * no backdrop click, no Escape — only «Sunt sigur» (continues the submit) or «Închide» (cancels).
 */

export const EMPTY_TEAM_QUESTION = 'Nu ați adăugat niciun coechipier. Sunteți sigur că doriți să înregistrați echipa fără coechipieri?';

export function EmptyTeamConfirm({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Dialog
      open={open}
      // Escape does nothing: the question must be answered (fish: enablePanDownToClose false).
      onClose={() => {}}
      alert
      backdropDismiss={false}
      title="Echipă fără coechipieri"
      titleHidden
      description={<span className="t-body-strong text-ink">{EMPTY_TEAM_QUESTION}</span>}
      actions={
        <>
          <Button variant="danger" onClick={onCancel}>
            Închide
          </Button>
          <Button onClick={onConfirm}>Sunt sigur</Button>
        </>
      }
    />
  );
}
