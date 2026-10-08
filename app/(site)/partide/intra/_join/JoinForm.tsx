'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { joinPartidaMutation, partidaJoinErrorMessage } from '@/core/partide';
import { isApiError } from '@/core/transport';
import { BREAKPOINT_MD } from '@/components/surfaces/rule';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../_shell/Toast';
import { useLivePartide } from '../../_live/LivePartideProvider';
import { CodeField } from './CodeField';
import { isCompleteCode } from './code';

/** fish join/index.tsx copy. */
export const JOIN_HELPER = 'Introdu codul de acces primit de la organizatorul partidei.';

/**
 * fish app/(app)/partide/join/index.tsx (parity partide.intra c2–c5): the code, «Alătură-te» on at
 * exactly six characters, Enter submits (a real form; the button is its default button).
 *
 * The write path is fish's useJoinPartida: POST /feed/sessions/join (core joinPartidaMutation; the
 * CMS adds the member and mirrors the Firestore projection — the web writes nothing to Firestore),
 * then the active pointer (the live layer's setActive: persisted + followed) and a REPLACE to the
 * partidă, so «back» from the partidă does not land on a spent code form.
 *
 * Single flight: a ref, not the mutation's state, guards the submit (a double Enter in one frame
 * sees no re-render). After success the form stays busy until the partidă replaces it.
 * A failure is fish's mapped message (core partidaJoinErrorMessage): a toast on a phone, as fish;
 * from 768 an inline status under the field, which stays until the code changes. A dead session
 * (401) goes to sign-in and comes back here.
 */
export function JoinForm() {
  const router = useRouter();
  const live = useLivePartide();
  const toast = useSiteToast();
  const join = useMutation(joinPartidaMutation(live.transport));
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const helperId = `${id}-help`;
  const errorId = `${id}-error`;

  const complete = isCompleteCode(code);

  const onChange = (next: string) => {
    setCode(next);
    if (error) setError(null);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isCompleteCode(code) || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const dto = await join.mutateAsync(code);
      await live.setActive({ sessionId: dto.firestoreId, documentId: dto.documentId });
      router.replace(routes.partida(dto.documentId));
    } catch (err) {
      inFlight.current = false;
      setBusy(false);
      if (isApiError(err) && err.status === 401) {
        router.replace(routes.signIn(routes.partidaJoin()));
        return;
      }
      const message = partidaJoinErrorMessage(err);
      const phone = window.matchMedia(`(max-width: ${BREAKPOINT_MD - 1}px)`).matches;
      if (phone) toast(message, 'danger');
      else setError(message);
      inputRef.current?.focus();
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy || undefined} className="mx-auto flex w-full max-w-md flex-col gap-4 md:gap-5 md:py-4 xl:py-6">
      <p id={helperId} className="t-body-strong text-muted md:text-center">
        {JOIN_HELPER}
      </p>
      <label htmlFor={`${id}-code`} className="sr-only">
        Codul de acces
      </label>
      {/*
       * The field and its status share one block, so an empty status adds no gap. The status is
       * always rendered (never display:none — a live region that appears with its text is often not
       * announced); empty it is 0 tall, its margin only comes with a message.
       */}
      <div className="flex flex-col">
        <CodeField
          id={`${id}-code`}
          ref={inputRef}
          value={code}
          onChange={onChange}
          invalid={Boolean(error)}
          disabled={busy}
          describedBy={error ? `${helperId} ${errorId}` : helperId}
        />
        <p id={errorId} role="status" data-testid="join-error" className={cn('t-body-strong text-center text-status-danger-fg', error && 'mt-3 md:mt-4')}>
          {error ?? ''}
        </p>
      </div>
      <Button
        type="submit"
        variant="success"
        block
        disabled={!complete || busy}
        icon={busy ? <ArrowPathIcon className="animate-spin motion-reduce:animate-none" /> : undefined}
      >
        Alătură-te
      </Button>
    </form>
  );
}
