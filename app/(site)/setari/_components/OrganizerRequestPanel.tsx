'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { T4TextArea } from '@/components/templates/T4/T4TextArea';
import { Button } from '@/components/ui/Button';
import { requestOrganizerRoleMutation } from '@/core/organizer';
import { createBrowserTransport } from '@/lib/client/transport';
import { useSiteToast } from '../../_shell/Toast';

export const REQUEST_TITLE = 'Devino organizator';
export const REQUEST_TEXT =
  'După trimiterea cererii, echipa Bluvi te va contacta pentru a-ți acorda rolul de organizator. Te rugăm să ne spui câteva cuvinte despre tine și despre competițiile pe care vrei să le organizezi.';
export const MESSAGE_PLACEHOLDER = 'Spune-ne despre experiența ta și ce competiții vrei să organizezi...';
export const MESSAGE_REQUIRED = 'Te rugăm să adaugi un mesaj înainte de a trimite cererea';
export const REQUEST_SENT = 'Solicitarea ta a fost trimisă cu succes';
export const REQUEST_FAILED = 'Nu am putut trimite cererea. Încearcă din nou.';
const MAX_MESSAGE = 1000;
const FORM_ID = 'organizer-request-form';

/**
 * c9–c12 — fish components/OrganizerRoleRequestSheet.tsx + useRequestOrganizerRole: title
 * «Devino organizator», the explanation, the «Mesaj» field (max 1000, fish's placeholder), «Închide» /
 * «Trimite cerere». A sheet on the phone (fish's 90% sheet), a dialog with the actions pinned from
 * 768 (ResponsiveSurface `info`).
 * - c10: an empty or whitespace-only message → «Te rugăm să adaugi un mesaj…» on the field, nothing sent;
 * - c11: POST /user/organizer-request {message: trimmed} (core requestOrganizerRoleMutation, which
 *   invalidates the profile when it settles → the row becomes «Cerere organizator · În așteptare»);
 *   «Trimite cerere» busy while it runs (a second press is ignored); success → toast «Solicitarea ta
 *   a fost trimisă cu succes» and the panel closes (`onSent`: the row moves focus to the pending row
 *   once it flips — the «Devino organizator» button the panel returns focus to is gone by then); failure → a danger toast, the panel stays with the
 *   message (fish's toast shows the API's raw message — the web says it in Romanian);
 * - c12: closing (Închide, the X, Escape, the backdrop) resets the message and the error (fish
 *   onDismiss={reset}).
 */
export function OrganizerRequestPanel({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent?: () => void }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | undefined>();
  const sending = useRef(false);
  // The toasts ride on the mutation itself (they fire even if this panel unmounts meanwhile).
  const request = useMutation({
    ...requestOrganizerRoleMutation(t, qc),
    onSuccess: () => toast(REQUEST_SENT, 'success'),
    onError: () => toast(REQUEST_FAILED, 'danger'),
  });

  const close = () => {
    if (request.isPending) return;
    setMessage('');
    setError(undefined);
    onClose();
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (sending.current) return;
    const trimmed = message.trim();
    if (!trimmed) {
      setError(MESSAGE_REQUIRED);
      return;
    }
    sending.current = true;
    request.mutate(trimmed, {
      onSuccess: () => {
        setMessage('');
        setError(undefined);
        onSent?.();
        onClose();
      },
      onSettled: () => {
        sending.current = false;
      },
    });
  };

  return (
    <ResponsiveSurface
      open={open}
      onClose={close}
      intent="info"
      title={REQUEST_TITLE}
      sheetSnap={0.9}
      pinnedActions
      actions={
        <>
          <Button variant="outline" onClick={close} aria-disabled={request.isPending || undefined}>
            Închide
          </Button>
          <Button type="submit" form={FORM_ID} aria-disabled={request.isPending || undefined} aria-busy={request.isPending || undefined}>
            {request.isPending ? 'Se trimite…' : 'Trimite cerere'}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="t-body text-ink-2">{REQUEST_TEXT}</p>
        <T4TextArea
          label="Mesaj"
          placeholder={MESSAGE_PLACEHOLDER}
          maxLength={MAX_MESSAGE}
          capInput
          value={message}
          error={error}
          onChange={(e) => {
            setMessage(e.target.value);
            if (error) setError(undefined);
          }}
          rows={6}
        />
      </form>
    </ResponsiveSurface>
  );
}
