'use client';

import type { ReactNode } from 'react';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';

/*
 * The partidă confirmations (fish *Sheet.tsx under features/partide/components): a bottom sheet on
 * the phone, a centred alert dialog from 768 (ResponsiveSurface intent «decision», Fundații §07).
 *
 * Single-flight (parity partide.partida.c18): while `pending`, the confirm says so (aria-busy,
 * aria-disabled — it stays focusable) and ignores every activation, and the surface cannot be
 * dismissed (fish: no pan-down, a non-dismissable backdrop) — the caller's ref guard is the second
 * lock. A failure is shown inline above the buttons (fish `error` prop), the surface stays open.
 */
export function ConfirmSurface({
  open,
  onClose,
  title,
  pending = false,
  error,
  confirmLabel,
  pendingLabel,
  dismissLabel,
  onConfirm,
  confirmVariant = 'danger',
  confirm,
  testId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  pending?: boolean;
  error?: string | null;
  confirmLabel: string;
  pendingLabel?: string;
  dismissLabel: string;
  onConfirm: () => void;
  confirmVariant?: 'danger' | 'primary' | 'success';
  /** Replaces the confirm button (the delete's hold-to-confirm). */
  confirm?: ReactNode;
  testId?: string;
  children?: ReactNode;
}) {
  const close = () => {
    if (!pending) onClose();
  };
  return (
    <ResponsiveSurface
      open={open}
      onClose={close}
      intent="decision"
      title={title}
      sheetSnap="fit"
      actions={
        // Phone: stacked full width, the confirm on top (fish); from 768 the dialog's row.
        <div className="flex w-full flex-col-reverse gap-2 md:w-auto md:flex-row md:justify-end">
          <Button type="button" variant="outline" aria-disabled={pending || undefined} onClick={close}>
            {dismissLabel}
          </Button>
          {confirm ?? (
            <Button
              type="button"
              variant={confirmVariant}
              aria-busy={pending || undefined}
              aria-disabled={pending || undefined}
              data-testid={testId ? `${testId}-confirm` : undefined}
              onClick={() => {
                if (!pending) onConfirm();
              }}
            >
              {pending ? (pendingLabel ?? `${confirmLabel}…`) : confirmLabel}
            </Button>
          )}
        </div>
      }
    >
      <div data-testid={testId} className="flex flex-col gap-4">
        {children}
        {error ? (
          <p role="alert" className="t-body-strong text-status-danger-fg">
            {error}
          </p>
        ) : null}
      </div>
    </ResponsiveSurface>
  );
}
