'use client';

import { useEffect, useTransition } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { DetailSectionState } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { BookingFrame } from './_components/frame';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS is
 * down or slow) — never a sign-in form for a user who may well be signed in (owner rule 4): the
 * page's frame with «Serverul nu răspunde» and «Încearcă din nou», which re-renders the gate.
 * ONE frame: BookingFrame already draws the page's h1 «Rezervare» and the phone's back chip, so the
 * error is a card in the body with an h2 (DetailSectionState) — not DetailError, whose own h1 and
 * back chip would stack a second heading and a second back button on the phone.
 */
export default function BookingError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[rezervari/[id]]', error);
  }, [error]);
  return (
    <BookingFrame>
      <div role="alert" data-testid="booking-gate-error" className="px-4 pt-4 pb-8 md:px-6 md:pt-6 md:pb-12 xl:px-8 xl:pt-8">
        <DetailSectionState
          icon={
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg [&>svg]:size-6">
              <ExclamationCircleIcon aria-hidden />
            </span>
          }
          heading="Serverul nu răspunde"
          description="Lucrăm la asta. Încearcă din nou în câteva minute."
          action={
            <Button variant="secondary" aria-busy={retrying || undefined} aria-disabled={retrying || undefined} onClick={() => !retrying && startRetry(() => retry())}>
              {retrying ? 'Se încarcă…' : 'Încearcă din nou'}
            </Button>
          }
        />
      </div>
    </BookingFrame>
  );
}
