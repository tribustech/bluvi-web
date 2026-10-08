'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { reopenCantarMutation } from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { TextInput } from '@/components/forms/TextInput';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { MAX_REASON, validateReason } from './model';

/*
 * c19/c20 (fish ReopenWeighingSheet + useReopenCantar). The author only. «Ești sigur că vrei să
 * redeschizi cântarul?», why it matters (the change is visible to every participant), a required
 * reason ≤ 100, «Anulează» / «Redeschide cântarul». The write flips the weighing to «started» in the
 * stand's list at once (core onMutate; rolled back on error) and refetches the weighing. Pending: a
 * spinner in place of the form. Error: the message (fallback «Eroare la redeschiderea cântarului») and
 * «Închide». The backdrop does not close it (fish pressBehavior none): a half-typed reason is not lost.
 */
export function ReopenDialog({
  open,
  onClose,
  t,
  competitionId,
  standId,
  weighingId,
}: {
  open: boolean;
  onClose: () => void;
  t: Transport;
  competitionId: string;
  standId: string;
  weighingId: string;
}) {
  const qc = useQueryClient();
  const toast = useSiteToast();
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const reopen = useMutation(reopenCantarMutation(t, qc, { weighingId, standId }));
  const error = submitted ? validateReason(reason) : undefined;

  const close = () => {
    if (reopen.isPending) return;
    setReason('');
    setSubmitted(false);
    reopen.reset();
    onClose();
  };

  const submit = () => {
    setSubmitted(true);
    if (validateReason(reason)) return;
    reopen.mutate(
      { weighingId, competitionId, reason: reason.trim() },
      {
        onSuccess: () => {
          toast('Cântarul a fost redeschis cu succes', 'success');
          setReason('');
          setSubmitted(false);
          reopen.reset();
          onClose();
        },
      },
    );
  };

  const failed = reopen.isError;
  return (
    <Dialog
      open={open}
      onClose={close}
      title={failed ? 'Cântarul nu a fost redeschis' : 'Ești sigur că vrei să redeschizi cântarul?'}
      titleHidden={failed}
      description={failed || reopen.isPending ? undefined : 'Modificările vor fi vizibile în istoricul concursului pentru toți participanții.'}
      alert={!failed && !reopen.isPending}
      backdropDismiss={false}
      actions={
        failed ? (
          <Button onClick={close} block>
            Închide
          </Button>
        ) : reopen.isPending ? null : (
          <>
            <Button variant="outline" onClick={close}>
              Anulează
            </Button>
            <Button variant="danger" onClick={submit} data-testid="reopen-confirm">
              Redeschide cântarul
            </Button>
          </>
        )
      }
    >
      {failed ? (
        <div role="alert" className="flex flex-col items-center gap-3 py-2 text-center">
          <ExclamationTriangleIcon aria-hidden className="size-8 text-status-danger-fg" />
          <p className="t-body-strong text-ink-2">{reopen.error?.message || 'Eroare la redeschiderea cântarului'}</p>
        </div>
      ) : reopen.isPending ? (
        <div role="status" className="flex flex-col items-center gap-3 py-6">
          <ArrowPathIcon aria-hidden className="size-8 text-accent motion-safe:animate-spin" />
          <p className="t-body-strong text-muted">Se redeschide cântarul…</p>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="pt-2"
        >
          <TextInput
            label="Te rugăm să indici motivul redeschiderii:"
            placeholder="Introduceți motivul…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={error}
            helper={`${reason.length}/${MAX_REASON} caractere`}
            autoFocus
            autoComplete="off"
            name="reason"
          />
        </form>
      )}
    </Dialog>
  );
}
