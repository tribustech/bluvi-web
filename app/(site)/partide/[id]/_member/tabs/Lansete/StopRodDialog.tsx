'use client';

import { StopIcon } from '@heroicons/react/24/solid';
import { ConfirmSurface } from '@/components/partide/dialogs/shared';

/*
 * «Oprești cronometrul?» (fish components/StopRodSheet.tsx, parity partide.partida-lansete.c9): stop
 * a running rod WITHOUT recording an outcome. The subtitle names the rod as its card does
 * («Stânga · 60 m», or only the distance when the lane is not known). «Da, oprește» / «Nu». A bottom
 * sheet on the phone, an alert dialog from 768 (the partidă's ConfirmSurface). Pure presentation:
 * the board owns the move (forceStop → POST …/rods/:n/stop). The board keeps `rodLabel` while the
 * surface closes (fish: a subtitle cleared with the state vanished from a sheet still on screen).
 */
export function StopRodDialog({ open, rodLabel, onConfirm, onClose }: { open: boolean; rodLabel: string | null; onConfirm: () => void; onClose: () => void }) {
  return (
    <ConfirmSurface
      open={open}
      onClose={onClose}
      title="Oprești cronometrul?"
      confirmLabel="Da, oprește"
      dismissLabel="Nu"
      onConfirm={onConfirm}
      testId="stop-rod-dialog"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg">
          <StopIcon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="t-body text-ink-2">Vrei să oprești cronometrul fără să înregistrezi o acțiune?</p>
          {rodLabel ? (
            <p data-testid="stop-rod-label" className="t-body-strong text-ink">
              {rodLabel}
            </p>
          ) : null}
        </div>
      </div>
    </ConfirmSurface>
  );
}
