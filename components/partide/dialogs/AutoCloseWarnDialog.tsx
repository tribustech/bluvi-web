'use client';

import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { pad2 } from '@/core/partide';

/*
 * «Încă pescuiești?» (parity partide.partida.c13; fish components/AutoCloseWarnSheet.tsx): the
 * owner's live partidă carries `warnedAt` (the CMS auto-close sweep). Non-dismissable — no
 * backdrop, no Escape, no X: the angler must choose. «Se închide automat în {countdown}» (the
 * server clock), «Da, continui» (the page extends the session) and «Nu, închid partida» (the page
 * runs the very same finish as «Termină»). The page opens / closes it from `warnedAt`.
 */

/** fish fmtCountdown: «11h 42m» above an hour, «42m» under it, clamped to «0m» (never negative). */
export function autoCloseCountdown(autoCloseAt: number | null, now: number): string {
  const remainingMs = autoCloseAt == null ? 0 : autoCloseAt - now;
  const totalMin = Math.max(0, Math.floor(remainingMs / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${pad2(m)}m` : `${m}m`;
}

export function AutoCloseWarnDialog({
  open,
  autoCloseAt,
  now,
  extending,
  onConfirmStillFishing,
  onFinishPartida,
}: {
  open: boolean;
  autoCloseAt: number | null;
  now: number;
  extending: boolean;
  onConfirmStillFishing: () => void;
  onFinishPartida: () => void;
}) {
  return (
    <ResponsiveSurface
      open={open}
      onClose={() => {}}
      intent="decision"
      title="Încă pescuiești?"
      sheetSnap="fit"
      sheetFixed
      actions={
        <div className="flex w-full flex-col-reverse gap-2 md:w-auto md:flex-row md:justify-end">
          <Button type="button" variant="danger" aria-disabled={extending || undefined} onClick={() => !extending && onFinishPartida()}>
            Nu, închid partida
          </Button>
          <Button
            type="button"
            variant="success"
            aria-busy={extending || undefined}
            aria-disabled={extending || undefined}
            onClick={() => !extending && onConfirmStillFishing()}
          >
            {extending ? 'Se prelungește…' : 'Da, continui'}
          </Button>
        </div>
      }
    >
      <p data-testid="autoclose-dialog" className="t-body text-ink-2">
        Se închide automat în <span data-visual-mask className="t-body-strong text-ink tabular-nums">{autoCloseCountdown(autoCloseAt, now)}</span>
      </p>
    </ResponsiveSurface>
  );
}
