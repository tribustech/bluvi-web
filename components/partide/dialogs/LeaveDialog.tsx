'use client';

import { ConfirmSurface } from './shared';

/*
 * «Părăsești partida?» (parity partide.partida.c15; fish SessionMembershipSheet mode «leave»): a
 * non-owner member of a live partidă. fish's access-loss explanation, «Părăsește partida» /
 * «Rămân în partidă»; the failure stays inline.
 */
export const LEAVE_BODY =
  'Vei pierde accesul la partidă. Partida, capturile și fotografiile rămân pentru echipă, dar nu vor mai apărea în istoricul, statisticile și galeria profilului tău. Poți reveni doar folosind un cod de acces valid.';

export function LeaveDialog({
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
      title="Părăsești partida?"
      pending={pending}
      error={error}
      confirmLabel="Părăsește partida"
      pendingLabel="Se părăsește…"
      dismissLabel="Rămân în partidă"
      onConfirm={onConfirm}
      testId="leave-dialog"
    >
      <p className="t-body text-ink-2">{LEAVE_BODY}</p>
    </ConfirmSurface>
  );
}
