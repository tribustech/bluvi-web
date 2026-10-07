'use client';

import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';

/*
 * The capture anti-spam soft-confirm (parity partide.partida-lansete.c8; fish
 * components/CaptureSpamGuardHost.tsx): a capture in the same rod bucket (or the free bucket) within
 * 30 s of the previous one asks «Sigur adaugi altă captură?» — «Da, adaug» goes on, «Anulează»
 * drops the intent. A bottom sheet on the phone, a centred alert dialog from 768 (Fundații §07,
 * intent «decision»). One per screen: useCaptureFlow renders it for a button entry point, the
 * capture page renders it for a link entry point (the dock, a deep link).
 */
export function CaptureSpamGuard({ secondsAgo, onConfirm, onCancel }: { secondsAgo: number | null; onConfirm: () => void; onCancel: () => void }) {
  return (
    <ResponsiveSurface
      open={secondsAgo != null}
      onClose={onCancel}
      intent="decision"
      title="Sigur adaugi altă captură?"
      sheetSnap="fit"
      actions={
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row-reverse md:justify-start">
          <Button type="button" onClick={onConfirm} data-testid="capture-spam-confirm">
            Da, adaug
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Anulează
          </Button>
        </div>
      }
    >
      {secondsAgo != null ? (
        <p data-testid="capture-spam-guard" className="t-body text-ink-2">
          Ai adăugat o captură acum {secondsAgo}s. Ești sigur că vrei să adaugi alta?
        </p>
      ) : null}
    </ResponsiveSurface>
  );
}
