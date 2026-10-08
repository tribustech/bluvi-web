'use client';

import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';

/*
 * fish index.tsx:94-106 — Alert «Revocă penalizarea?» / «Acțiunea va elimina penalizarea din
 * clasament.» with «Anulează» and the destructive «Revocă». On the web the confirm stays open and
 * busy until the CMS answers (no second DELETE); a failure stays in the dialog.
 */
export function RevokeDialog({
  open,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      alert
      title="Revocă penalizarea?"
      description="Acțiunea va elimina penalizarea din clasament."
      actions={
        <>
          <Button variant="secondary" aria-disabled={pending || undefined} onClick={onCancel} data-testid="revoke-cancel">
            Anulează
          </Button>
          <Button
            variant="danger"
            aria-busy={pending || undefined}
            aria-disabled={pending || undefined}
            onClick={onConfirm}
            data-testid="revoke-confirm"
          >
            {pending ? 'Se revocă…' : 'Revocă'}
          </Button>
        </>
      }
    >
      {error ? (
        <p role="alert" className="t-body text-status-danger-fg" data-testid="revoke-error">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
