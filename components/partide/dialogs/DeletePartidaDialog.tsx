'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { formatCount } from '@/core/realtime/chat/format';
import { ConfirmSurface } from './shared';

/*
 * «Ștergi această partidă?» (parity partide.partida.c14; fish components/DeletePartidaSheet.tsx):
 * owner-only, live or ended. Names the venue and what is lost (fish lossSummary), and confirms with
 * a HOLD — the same guard fish uses: a plain click cannot destroy a whole partidă. Pointer: press
 * and hold for HOLD_MS; keyboard: hold Space or Enter. Releasing early resets. While the delete
 * runs the hold is inert (single-flight, c18); a failure shows inline and the hold re-arms.
 */

export const HOLD_MS = 1200;

/**
 * fish lossSummary: «Se șterg definitiv {n capturi} și {n fotografii}, împreună cu tot jurnalul
 * partidei.» … Plurals by formatCount (owner rule, over fish's «25 capturi»): «25 de capturi»,
 * «Cei 20 de coechipieri»; fish's «o captură» / «o fotografie» singulars stay.
 */
export function lossSummary(captureCount: number, photoCount: number, teammateCount: number): string {
  const parts: string[] = [];
  if (captureCount > 0) parts.push(captureCount === 1 ? 'o captură' : formatCount(captureCount, 'captură', 'capturi'));
  if (photoCount > 0) parts.push(photoCount === 1 ? 'o fotografie' : formatCount(photoCount, 'fotografie', 'fotografii'));
  const lost = parts.length ? `Se șterg definitiv ${parts.join(' și ')}, împreună cu tot jurnalul partidei.` : 'Se șterge definitiv tot jurnalul partidei.';
  const team =
    teammateCount > 0
      ? teammateCount === 1
        ? ' Coechipierul tău pierde și el accesul și capturile lui.'
        : ` Cei ${formatCount(teammateCount, 'coechipier', 'coechipieri')} pierd și ei accesul și capturile lor.`
      : '';
  return `${lost}${team} Acțiunea nu poate fi anulată.`;
}

export function DeletePartidaDialog({
  open,
  venueName,
  captureCount,
  photoCount,
  teammateCount,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  venueName: string;
  captureCount: number;
  photoCount: number;
  teammateCount: number;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <ConfirmSurface
      open={open}
      onClose={onClose}
      title="Ștergi această partidă?"
      pending={pending}
      error={error}
      confirmLabel="Ține apăsat pentru a șterge"
      dismissLabel="Renunță"
      onConfirm={onConfirm}
      confirm={<HoldToConfirm label="Ține apăsat pentru a șterge" pendingLabel="Se șterge…" pending={pending} onConfirm={onConfirm} />}
      testId="delete-dialog"
    >
      <p className="t-body-strong text-ink">{venueName}</p>
      <p className="t-caption text-muted">{lossSummary(captureCount, photoCount, teammateCount)}</p>
    </ConfirmSurface>
  );
}

function HoldToConfirm({ label, pendingLabel, pending, onConfirm }: { label: string; pendingLabel: string; pending: boolean; onConfirm: () => void }) {
  const [progress, setProgress] = useState(0);
  const start = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const fired = useRef(false);
  const hintId = useId();

  const stop = () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    frame.current = null;
    start.current = null;
    if (!fired.current) setProgress(0);
  };
  const tick = (now: number) => {
    if (start.current == null) start.current = now;
    const p = Math.min(1, (now - start.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      frame.current = null;
      start.current = null;
      fired.current = true;
      onConfirm();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  };
  const begin = () => {
    if (pending || frame.current != null) return;
    fired.current = false;
    frame.current = requestAnimationFrame(tick);
  };
  // A settled attempt (failure) re-arms the hold (state adjusted during render, not in an effect).
  const [wasPending, setWasPending] = useState(pending);
  if (wasPending !== pending) {
    setWasPending(pending);
    if (!pending) setProgress(0);
  }
  useEffect(() => {
    if (!pending) fired.current = false;
  }, [pending]);
  useEffect(() => () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) begin();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') stop();
  };

  return (
    <>
      <Button
        type="button"
        variant="danger"
        aria-busy={pending || undefined}
        aria-disabled={pending || undefined}
        aria-describedby={hintId}
        data-testid="delete-dialog-hold"
        data-progress={Math.round(progress * 100)}
        onPointerDown={e => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          begin();
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onBlur={stop}
        onContextMenu={e => e.preventDefault()}
        className="relative overflow-hidden select-none [touch-action:none]"
      >
        <span
          aria-hidden
          className={cn('absolute inset-y-0 left-0 bg-status-danger-fg/20', progress === 0 && 'opacity-0')}
          style={{ width: `${progress * 100}%` }}
        />
        <span className="relative">{pending ? pendingLabel : label}</span>
      </Button>
      <span id={hintId} className="sr-only">
        Ține apăsat butonul (sau tasta Spațiu) până se umple, ca să confirmi ștergerea.
      </span>
    </>
  );
}
