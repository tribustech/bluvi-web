'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightEndOnRectangleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { deleteProfileMutation } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { useSiteToast } from '../../_shell/Toast';

export const SIGN_OUT_LABEL = 'Deconectare';
export const SIGN_OUT_QUESTION = 'Ești sigur că dorești să te deconectezi?';
export const DELETE_LABEL = 'Șterge contul';
export const DELETE_QUESTION = 'Ești sigur că îți dorești să ștergi contul?';
export const DELETE_WARNING = 'Această acțiune este ireversibilă';
export const DELETE_FAILED = 'Nu am putut șterge contul. Încearcă din nou.';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/**
 * c18 + c19 (fish settings.tsx:58-97, 317-347): leaving the account.
 * - «Deconectare» — fish's white bar with the red label and icon — asks «Ești sigur că dorești să te
 *   deconectezi?» (Închide / Deconectare, an alert dialog at every width, as fish's Alert); confirming
 *   runs the site's one sign-out (lib/client/sign-out via `onSignOut`), the dialog stays, busy, until
 *   the signed-out page lands.
 * - «Șterge contul» — small and muted — asks «Ești sigur că îți dorești să ștergi contul?» /
 *   «Această acțiune este ireversibilă» (Închide / Ștergere); confirming sends DELETE /user/profile
 *   (core deleteProfileMutation: the CMS anonymises the account and the profile query is invalidated)
 *   and then signs out. A failed DELETE keeps the dialog and says so (fish leaves the rejection
 *   unhandled); the account is untouched, so nothing is signed out. A failed sign-out (after either
 *   confirm) keeps its dialog open and usable: the hook toasts and changes nothing, a retry runs it again.
 * `onLeaving` fires before the DELETE, so the screen stops reading the profile (its refetch would
 * answer 401 for an anonymised account).
 */
export function LeaveActions({ onSignOut, signingOut, onLeaving }: { onSignOut: () => void; signingOut: boolean; onLeaving: (leaving: boolean) => void }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const [ask, setAsk] = useState<'none' | 'sign-out' | 'delete'>('none');
  const remove = useMutation(deleteProfileMutation(t, qc));
  const busy = signingOut || remove.isPending;
  const close = () => {
    if (!busy) setAsk('none');
  };

  const confirmDelete = () => {
    if (busy) return;
    // The account is already gone and only the sign-out failed (its toast said so): a retry signs
    // out again, never a second DELETE.
    if (remove.isSuccess) {
      onSignOut();
      return;
    }
    onLeaving(true);
    remove.mutate(undefined, {
      onSuccess: () => onSignOut(),
      onError: () => {
        onLeaving(false);
        toast(DELETE_FAILED, 'danger');
      },
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-haspopup="dialog"
        data-testid="settings-logout-button"
        onClick={() => setAsk('sign-out')}
        className={cn(
          'flex min-h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-card bg-surface px-4 py-3.5 shadow-e0',
          't-heading text-status-danger-fg transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-70',
          FOCUS,
        )}
      >
        <ArrowRightEndOnRectangleIcon aria-hidden className="size-5 shrink-0" />
        {SIGN_OUT_LABEL}
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setAsk('delete')}
        className={cn(
          'mx-auto flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-control px-3 t-caption text-muted transition-colors duration-(--duration-fast) ease-fast hover:bg-soft-fill hover:text-ink-2',
          FOCUS,
        )}
      >
        <TrashIcon aria-hidden className="size-4 shrink-0" />
        {DELETE_LABEL}
      </button>

      <Dialog
        open={ask === 'sign-out'}
        onClose={close}
        alert
        title={SIGN_OUT_QUESTION}
        actions={
          <>
            <Button variant="outline" onClick={close} aria-disabled={busy || undefined}>
              Închide
            </Button>
            <Button variant="danger" onClick={() => !busy && onSignOut()} aria-disabled={busy || undefined} aria-busy={signingOut || undefined}>
              {signingOut ? 'Se deconectează…' : 'Deconectare'}
            </Button>
          </>
        }
      />
      <Dialog
        open={ask === 'delete'}
        onClose={close}
        alert
        title={DELETE_QUESTION}
        description={DELETE_WARNING}
        actions={
          <>
            <Button variant="outline" onClick={close} aria-disabled={busy || undefined}>
              Închide
            </Button>
            <Button variant="danger" onClick={confirmDelete} aria-disabled={busy || undefined} aria-busy={busy || undefined}>
              {busy ? 'Se șterge…' : 'Ștergere'}
            </Button>
          </>
        }
      />
    </div>
  );
}
