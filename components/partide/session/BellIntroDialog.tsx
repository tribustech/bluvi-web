'use client';

import { BellAlertIcon } from '@heroicons/react/24/outline';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';

/*
 * fish BellIntroSheet (parity partide.spectator.c5): before the first-ever follow of a partidă,
 * `intro` explains what following does; when the viewer's Bluvi notifications are off in their
 * profile, `reenable` offers to turn them back on AND follow in one press (shown instead of the
 * intro, never chained). Any way of closing it («Nu acum», ✕, Escape, the backdrop) only closes —
 * it never follows; the caller marks the intro as seen for both variants (fish handleIntroDismiss).
 * The kit's surface rule: a sheet on the phone, a dialog from 768 (intent `info`).
 */

export type BellIntroVariant = 'intro' | 'reenable';

const COPY: Record<BellIntroVariant, { title: string; body: string; confirm: string }> = {
  intro: {
    title: 'Notificări pentru această partidă',
    body: 'Vei primi o notificare de fiecare dată când se adaugă o captură în această partidă și când partida se încheie. Poți opri notificările oricând, din același clopoțel.',
    confirm: 'Activează notificările',
  },
  reenable: {
    title: 'Notificările Bluvi sunt dezactivate',
    body: 'Ai notificările dezactivate din profil, așa că nu ai primi capturile din această partidă. Le poți activa acum — le poți opri oricând din setări.',
    confirm: 'Activează și urmărește',
  },
};

export function BellIntroDialog({
  variant,
  onConfirm,
  onClose,
}: {
  /** null: closed. */
  variant: BellIntroVariant | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const copy = COPY[variant ?? 'intro'];
  return (
    <ResponsiveSurface
      open={variant != null}
      onClose={onClose}
      intent="info"
      title={copy.title}
      titleHidden
      sheetSnap="fit"
      // The kit's actions row: the safe choice first (stacked full width on the phone).
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Nu acum
          </Button>
          <Button onClick={onConfirm} data-testid="bell-intro-confirm">
            {copy.confirm}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 pt-1 pb-2 text-center">
        <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-accent-tint text-accent">
          <BellAlertIcon className="size-7.5" />
        </span>
        <div className="flex flex-col gap-2">
          <p className="t-heading text-ink">{copy.title}</p>
          <p className="t-caption text-muted">{copy.body}</p>
        </div>
      </div>
    </ResponsiveSurface>
  );
}
