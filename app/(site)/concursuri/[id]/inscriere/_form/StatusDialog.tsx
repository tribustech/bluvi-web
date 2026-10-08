'use client';

import { useEffect, useRef } from 'react';
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@/components/surfaces/Dialog';
import { T4Spinner } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * fish components/RegistrationStatusModalSheet.tsx (Create / Update / Leave) — parity
 * participant.register c16 / c18 / c19. One modal for the three writes:
 *  - pending: the busy disc and «Înscriere în curs...» / «Modificare în curs...»; it cannot be
 *    dismissed (no Escape, no backdrop) — fish's backdrop pressBehavior 'none';
 *  - success: the check, fish's lines; it closes itself after 3 s (AUTO_CLOSE_MS) and the screen
 *    returns to the competition (onDone); Escape / the backdrop close it at once the same way;
 *  - error: the server's message (fallback in model.ts) and «Închide».
 * Centred at every width: fish's sheet is a detached card floating above the content.
 */

export type StatusKind = 'create' | 'update' | 'leave';
export type StatusPhase = 'pending' | 'success' | 'error';
export type StatusState = {
  kind: StatusKind;
  phase: StatusPhase;
  message?: string;
};

/** fish closeModalAndRedirectOnSuccess: dismiss 3 s after success. */
export const AUTO_CLOSE_MS = 3000;

const PENDING: Record<StatusKind, string> = {
  create: 'Înscriere în curs...',
  update: 'Modificare în curs...',
  leave: 'Modificare în curs...',
};

const SUCCESS: Record<StatusKind, string[]> = {
  create: [
    'Felicitări!',
    'Solicitarea ta a fost înregistrată cu succes.',
    'Vei fi contactat în cel mai scurt timp pentru confirmarea locului.',
  ],
  update: ['Felicitări!', 'Înregistrarea ta a fost modificată cu succes.'],
  leave: ['Ai părăsit competiția.'],
};

type Props = {
  state: StatusState | null;
  /** Error: «Închide» (back to the form). */
  onClose: () => void;
  /** Success, after AUTO_CLOSE_MS (or at once on Escape): leave for the competition. */
  onDone: () => void;
};

export function StatusDialog({ state, onClose, onDone }: Props) {
  const phase = state?.phase;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (phase !== 'success') return;
    const timer = window.setTimeout(() => done.current(), AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const kind = state?.kind ?? 'create';
  const lines = phase === 'success' ? SUCCESS[kind] : phase === 'pending' ? [PENDING[kind]] : [state?.message ?? ''];
  const close = phase === 'pending' ? () => {} : phase === 'success' ? onDone : onClose;

  return (
    <Dialog
      open={state !== null}
      onClose={close}
      alert
      title={lines[0] ?? ''}
      titleHidden
      backdropDismiss={phase !== 'pending'}
      className="max-w-100"
      actions={
        phase === 'error' ? (
          <Button variant="secondary" block onClick={onClose} className="md:w-full">
            Închide
          </Button>
        ) : undefined
      }
    >
      <div
        className="flex flex-col items-center gap-4 px-1 pt-3 pb-2 text-center"
        data-testid="registration-status"
        data-phase={phase}
        data-kind={kind}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-16 items-center justify-center rounded-full [&>svg]:size-8',
            phase === 'success'
              ? 'bg-status-success-bg text-status-success-fg'
              : phase === 'error'
                ? 'bg-status-danger-bg text-status-danger-fg'
                : 'bg-accent-tint text-accent-ink',
          )}
        >
          {phase === 'success' ? <CheckIcon /> : phase === 'error' ? <ExclamationTriangleIcon /> : <T4Spinner className="size-8" />}
        </span>
        <div role={phase === 'error' ? 'alert' : 'status'} className="flex flex-col gap-1">
          {lines.map((line, i) => (
            <p key={i} className={i === 0 && lines.length > 1 ? 't-title2 text-ink' : 't-body-strong text-ink'}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </Dialog>
  );
}
