'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckIcon } from '@heroicons/react/20/solid';
import { useSiteToast } from '@/app/(site)/_shell/Toast';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { T4TextArea } from '@/components/templates/T4/T4TextArea';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { sendFeedbackMutation } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';

/*
 * «Spune-ne ce nu merge» (parity partide.partida.c22; fish components/PartidaFeedbackSheet.tsx) —
 * filed from inside a partidă. Deliberately not the home feedback form: no mandatory rating; it goes
 * out as a neutral 5 with `ratingAsked: false` in metadata (the CMS requires `rating` ≥ 1).
 * Categories as fish (the three an angler writes from the bank), mapped onto the CMS enum; a text
 * of at most 1000; an empty text says «Scrie câteva cuvinte despre ce s-a întâmplat.» instead of
 * sending. Metadata: the partidă (clientId, documentId, captures, elapsed) + the entry point + the
 * web build envelope (fish feedbackMetadata). Success → «Mulțumim! Mesajul a ajuns la echipă.»,
 * the surface closes and `onSent` (the nudge counts it as answered); failure → «N-am putut trimite
 * mesajul. Mai încearcă o dată.», the surface stays. Mounted only while open (a reopen starts clean).
 */

const CATEGORIES = [
  { key: 'technical', label: 'Problemă tehnică' },
  { key: 'feature', label: 'Idee nouă' },
  { key: 'other', label: 'Altceva' },
] as const;
type CategoryKey = (typeof CATEGORIES)[number]['key'];

export type PartidaFeedbackContext = {
  sessionClientId?: string | null;
  sessionDocumentId?: string | null;
  captures?: number;
  elapsedMs?: number;
  /** Where it was opened from — the summary's «Raportează o problemă», or the live nudge. */
  entryPoint: 'info' | 'nudge';
};

const FORM_ID = 'partida-feedback-form';

export function PartidaFeedbackDialog({ open, context, onSent, onClose }: { open: boolean; context: PartidaFeedbackContext; onSent?: () => void; onClose: () => void }) {
  if (!open) return null;
  return <FeedbackSurface context={context} onSent={onSent} onClose={onClose} />;
}

function FeedbackSurface({ context, onSent, onClose }: { context: PartidaFeedbackContext; onSent?: () => void; onClose: () => void }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const toast = useSiteToast();
  const send = useMutation(sendFeedbackMutation(t));
  const [category, setCategory] = useState<CategoryKey>('technical');
  const [message, setMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const pending = send.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const text = message.trim();
    // A category with no words is a ticket nobody can action.
    if (!text) {
      setShowError(true);
      return;
    }
    send.mutate(
      {
        rating: 5,
        category,
        feedback: text,
        metadata: {
          source: 'partida',
          ratingAsked: false,
          entryPoint: context.entryPoint,
          sessionClientId: context.sessionClientId ?? null,
          sessionDocumentId: context.sessionDocumentId ?? null,
          captures: context.captures ?? null,
          elapsedMs: context.elapsedMs ?? null,
          // fish helpers/feedbackMetadata.ts: the build + device envelope.
          version: `v${process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'}`,
          environment: process.env.NODE_ENV,
          device: { os: 'web', userAgent: navigator.userAgent },
        },
      },
      {
        onSuccess: () => {
          toast('Mulțumim! Mesajul a ajuns la echipă.', 'success');
          onClose();
          onSent?.();
        },
        onError: () => toast('N-am putut trimite mesajul. Mai încearcă o dată.', 'danger'),
      },
    );
  };

  return (
    <ResponsiveSurface
      open
      onClose={() => !pending && onClose()}
      intent="info"
      title="Spune-ne ce nu merge"
      pinnedActions
      actions={
        <Button type="submit" form={FORM_ID} variant="success" block aria-busy={pending || undefined} aria-disabled={pending || undefined}>
          {pending ? 'Se trimite…' : 'Trimite'}
        </Button>
      }
    >
      <form id={FORM_ID} noValidate onSubmit={submit} data-testid="feedback-dialog" className="flex flex-col gap-5">
        <p className="t-body text-muted">
          Orice ți se pare greoi, greșit sau lipsă — scrie aici. Citim tot, iar mesajul vine cu detaliile partidei și ale
          dispozitivului, ca să nu le mai scrii tu.
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 t-caption text-muted">Despre ce e vorba</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => {
              const on = c.key === category;
              return (
                <label
                  key={c.key}
                  className={cn(
                    'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3.5 t-label has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
                    on ? 'border-accent bg-accent-tint text-accent-ink' : 'border-hairline bg-surface text-ink-2 hover:bg-soft-fill',
                  )}
                >
                  <input type="radio" name="partida-feedback-category" value={c.key} checked={on} onChange={() => setCategory(c.key)} className="sr-only" />
                  {on ? <CheckIcon aria-hidden className="size-3.5" /> : null}
                  {c.label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <T4TextArea
          label="Detalii"
          rows={5}
          maxLength={1000}
          capInput
          placeholder="Ex: cronometrul lansetei 2 a luat-o de la capăt după ce am salvat o captură."
          value={message}
          readOnly={pending}
          onChange={e => {
            setMessage(e.target.value);
            if (showError) setShowError(false);
          }}
          error={showError ? 'Scrie câteva cuvinte despre ce s-a întâmplat.' : undefined}
        />
      </form>
    </ResponsiveSurface>
  );
}
