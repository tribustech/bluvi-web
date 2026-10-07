'use client';

import { ConfirmSurface } from './shared';

/*
 * «Elimini participantul?» (parity partide.partida.c16; fish SessionMembershipSheet mode «kick»):
 * the owner removes a member (never the host). Names the member and says the join code is rotated
 * automatically; «Elimină participantul» / «Anulează».
 */
export const kickBody = (memberName: string) =>
  `${memberName} va pierde accesul la partidă. Capturile și fotografiile rămân pentru echipă, dar nu vor mai apărea în istoricul, statisticile și galeria profilului său. Codul de acces va fi schimbat automat.`;

export function KickDialog({
  open,
  memberName,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  memberName: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmSurface
      open={open}
      onClose={onClose}
      title="Elimini participantul?"
      pending={pending}
      error={error}
      confirmLabel="Elimină participantul"
      pendingLabel="Se elimină…"
      dismissLabel="Anulează"
      onConfirm={onConfirm}
      testId="kick-dialog"
    >
      <p className="t-body text-ink-2">{kickBody(memberName)}</p>
    </ConfirmSurface>
  );
}
