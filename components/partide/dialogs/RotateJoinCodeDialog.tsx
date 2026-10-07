'use client';

import { ConfirmSurface } from './shared';

/*
 * «Schimbi codul de acces?» (parity partide.partida.c17; fish components/RotateJoinCodeSheet.tsx):
 * owner, live partidă. «Codul și linkurile trimise anterior nu vor mai funcționa.»;
 * «Schimbă codul» / «Anulează»; the failure stays inline.
 */
export function RotateJoinCodeDialog({
  open,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmSurface
      open={open}
      onClose={onClose}
      title="Schimbi codul de acces?"
      pending={pending}
      error={error}
      confirmLabel="Schimbă codul"
      pendingLabel="Se schimbă…"
      dismissLabel="Anulează"
      onConfirm={onConfirm}
      testId="rotate-dialog"
    >
      <p className="t-body text-ink-2">Codul și linkurile trimise anterior nu vor mai funcționa.</p>
    </ConfirmSurface>
  );
}
