'use client';

import { ExclamationTriangleIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { buttonClass } from '@/components/ui/Button';
import { track } from '@/lib/analytics';

/** Bluvi's phone (fish CannotEditCompetitionSheet BLUVI_PHONE). */
export const BLUVI_PHONE = '+40733017091';

/**
 * organizer.b.cannot-edit-started — fish CannotEditCompetitionSheet: «Modifică» on a started
 * competition never opens the wizard; it says why and offers «Apelează» (tel: Bluvi). Shared by the
 * organizer panel's cards (organizer.b.card-edit-entry) and the competition page's organizer menu.
 */
export function CannotEditDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="info"
      title="Nu poți modifica competiția"
      titleHidden
      sheetSnap="fit"
      actions={
        <a
          href={`tel:${BLUVI_PHONE}`}
          onClick={() => {
            // fish: contact_pressed {contact_type: 'Bluvi cannot edit contact'} before the call.
            track('contact_pressed', { contact_type: 'Bluvi cannot edit contact' });
            onClose();
          }}
          className={buttonClass({ variant: 'primary', block: true })}>
          <PhoneIcon aria-hidden className="size-5" />
          Apelează
        </a>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center" data-testid="cannot-edit">
        <ExclamationTriangleIcon aria-hidden className="size-8 text-status-warning-fg" />
        <p className="t-heading text-ink" aria-hidden>
          Nu poți modifica competiția
        </p>
        <p className="t-body text-ink-2">Competiția a început deja. Pentru modificări, contactează echipa Bluvi.</p>
      </div>
    </ResponsiveSurface>
  );
}
