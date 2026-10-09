'use client';

import { useState } from 'react';
import { ModalSurface } from '@/components/surfaces/ModalSurface';
import { COPY } from '@/lib/consent/catalog';
import { acceptAll, anyActive, useActiveCategories } from '@/lib/consent/active';
import { NO_CHOICE, type ConsentChoice } from '@/lib/consent/model';
import { ConsentActions } from './ConsentActions';
import { ConsentCategories } from './ConsentCategories';
import { PrivacyPolicyLink } from './PrivacyPolicyLink';

/**
 * The preferences dialog (fish CMP/ui/PersonalizeScreen): a switch per optional category with its
 * details, then «Refuz toate» · «Accept toate» · «Salvează preferințele». The kit's ModalSurface
 * (native <dialog>: top layer, focus contained, Escape) — a bottom sheet on the phone, a dialog
 * from 768. Escape, the X and the backdrop close WITHOUT saving; focus goes back to the opener
 * (ConsentProvider). The switches are a draft until a button decides. The provider remounts this
 * component (key) on every opening, so the draft starts from the stored decision each time.
 */
export function ConsentPreferencesDialog({
  open,
  initial,
  onClose,
  onDecide,
}: {
  open: boolean;
  /** The current decision (null = none yet: all off). */
  initial: ConsentChoice | null;
  onClose: () => void;
  onDecide: (choice: ConsentChoice) => void;
}) {
  const active = useActiveCategories();
  const [draft, setDraft] = useState<ConsentChoice>(() => (initial ? { analytics: initial.analytics, errors: initial.errors } : NO_CHOICE));
  return (
    <ModalSurface
      open={open}
      onClose={onClose}
      title={COPY.title}
      bodyClassName="bg-page py-4"
      footer={
        // Nothing optional to decide (no service configured): only the «Strict necesare» card.
        !anyActive(active) ? undefined : (
        <ConsentActions
          layout="dialog"
          onReject={() => onDecide(NO_CHOICE)}
          onAccept={() => onDecide(acceptAll(active))}
          onSave={() => onDecide(draft)}
        />
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="consent-dialog-body">
        <p className="t-body text-ink-2">
          {COPY.intro} <PrivacyPolicyLink />
        </p>
        <ConsentCategories values={draft} onChange={(k, on) => setDraft((d) => ({ ...d, [k]: on }))} />
      </div>
    </ModalSurface>
  );
}
