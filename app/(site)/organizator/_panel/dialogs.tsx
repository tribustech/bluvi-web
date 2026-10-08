'use client';

import { useId, useState } from 'react';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { controlShell } from '@/components/forms/Field';
import { Button } from '@/components/ui/Button';
import { HoldToConfirmButton } from '@/components/ui/HoldToConfirmButton';
import { cn } from '@/components/ui/cn';
import { REASON_MAX } from './model';

/**
 * c19 — «Ștergi această ciornă?» (fish Alert): «Renunță», destructive «Șterge». A decision: the
 * kit's alert dialog (a bottom sheet on a phone).
 */
export function DeleteDraftDialog({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <ResponsiveSurface
      open={open}
      onClose={onClose}
      intent="decision"
      title="Ștergi această ciornă?"
      sheetSnap="fit"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Renunță
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Șterge
          </Button>
        </>
      }
    >
      <p className="t-body text-ink-2">Ciorna va fi ștearsă definitiv și nu o vei mai putea recupera.</p>
    </ResponsiveSurface>
  );
}

/**
 * c23 / c24 — fish CancelCompetitionSheet: the competition's name, what cancelling does, an
 * optional reason (max 280, a live «n / 280» counter, placeholder «ex. Vreme nefavorabilă»), and
 * the 1.5 s press-and-hold «Ține apăsat pentru a șterge» (keyboard hold and a double activation
 * for assistive tech: components/ui/HoldToConfirmButton). «Renunță» closes; closing clears the
 * reason (the parent unmounts this on close). While submitting the hold button is busy.
 */
export function CancelCompetitionDialog({
  name,
  submitting,
  onClose,
  onConfirm,
}: {
  name: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const id = useId();
  const counterId = `${id}-count`;
  return (
    <ResponsiveSurface
      open
      onClose={() => {
        if (!submitting) onClose();
      }}
      intent="decision"
      title="Anulezi această competiție?"
      sheetSnap="fit"
      pinnedActions
      actions={
        <div className="flex w-full flex-col gap-2">
          <HoldToConfirmButton label="Ține apăsat pentru a șterge" onConfirm={() => onConfirm(reason)} busy={submitting} />
          <Button variant="ghost" block onClick={onClose} aria-disabled={submitting || undefined} disabled={submitting}>
            Renunță
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="t-heading text-ink" data-testid="cancel-name">
          {name}
        </p>
        <p className="t-body text-ink-2">Toți participanții vor primi o notificare și înscrierile lor vor fi anulate. Această acțiune nu poate fi anulată.</p>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="t-label text-ink-2">
            Motiv (opțional)
          </label>
          <div className={cn(controlShell(false, submitting), 'h-auto items-start py-2')}>
            <textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              maxLength={REASON_MAX}
              rows={3}
              disabled={submitting}
              placeholder="ex. Vreme nefavorabilă"
              aria-describedby={counterId}
              className="t-body min-h-20 w-full resize-none bg-transparent text-ink outline-none placeholder:text-muted"
            />
          </div>
          <p id={counterId} className="self-end t-caption text-muted tabular-nums" data-testid="reason-counter">
            {reason.length} / {REASON_MAX}
          </p>
        </div>
      </div>
    </ResponsiveSurface>
  );
}
