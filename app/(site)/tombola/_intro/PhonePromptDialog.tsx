'use client';

import { useId, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as z from 'zod';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { TextInput } from '@/components/forms/TextInput';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { profileKeys, updateProfileMutation } from '@/core/social';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { raffleCopy } from '../_shared/copy';

const C = raffleCopy.phoneRequired;

/** fish RafflePhoneRequiredSheet rules: required, then at least 7 characters. */
export const phoneSchema = z.string().min(1, C.required).min(7, C.min);

export function phoneError(value: string): string | null {
  const r = phoneSchema.safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? C.required);
}

/**
 * fish components/raffle/RafflePhoneRequiredSheet.tsx (participant.raffle-intro.c13): opened by
 * «Intră în tragerea la sorți» when the profile has no phone. «Salvează» PATCHes the profile phone
 * (core updateProfileMutation), toasts «Număr salvat.», waits for the refreshed profile and closes —
 * the user then presses the CTA again (fish does not join by itself). A failure toasts the server's
 * message or «Eroare la salvare.» and keeps the dialog. Mounted only while open (fish resets the
 * field to the profile's phone on every open).
 */
export function PhonePromptDialog({ open, onClose, initialPhone }: { open: boolean; onClose: () => void; initialPhone: string | null }) {
  if (!open) return null;
  return <PhoneSurface onClose={onClose} initialPhone={initialPhone} />;
}

function PhoneSurface({ onClose, initialPhone }: { onClose: () => void; initialPhone: string | null }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const save = useMutation(updateProfileMutation(t, qc));
  const formId = useId();
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const error = submitted ? phoneError(phone) : null;

  const close = () => {
    if (!busy) onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    if (phoneError(phone)) return;
    setBusy(true);
    try {
      await save.mutateAsync({ phone });
      toast(C.saved, 'success');
      // fish invalidates profile.my; the CTA reads the refreshed phone on the next press.
      await qc.refetchQueries({ queryKey: profileKeys.my });
      onClose();
    } catch (err) {
      // fish: the error's message, else «Eroare la salvare.». The transport keeps the server's own
      // sentence only for a coded (bluCode) error; anything else is fish's fallback.
      const message = isApiError(err) && err.bluCode && err.message ? err.message : C.saveFailed;
      toast(message, 'danger');
      setBusy(false);
    }
  };

  return (
    <ResponsiveSurface
      open
      onClose={close}
      intent="decision"
      title={C.title}
      sheetSnap="fit"
      actions={
        <>
          <Button type="button" variant="outline" onClick={close} disabled={busy}>
            {C.close}
          </Button>
          <Button type="submit" form={formId} aria-busy={busy || undefined} aria-disabled={busy || undefined}>
            {C.cta}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="flex flex-col gap-4">
        <p className="t-body text-muted">{C.message}</p>
        <TextInput
          label={C.label}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={C.placeholder}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          readOnly={busy}
          error={error ?? undefined}
          autoFocus
        />
      </form>
    </ResponsiveSurface>
  );
}
