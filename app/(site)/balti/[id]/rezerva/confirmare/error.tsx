'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { T4Frame, T4Gate, T4Header } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The gate could not read the session (SessionUnknownError: a cookie, but the CMS is down or slow),
 * the lake read failed, or the step crashed — never a sign-in form for a user who may well be signed
 * in (owner rule 4): the step's frame with «Serverul nu răspunde» and «Încearcă din nou», which
 * re-renders the gate. Model: ../error.tsx (the grid).
 */
export default function BookingReviewError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { id } = useParams<{ id: string }>();
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    // Handled (the user sees the state and a retry): a warning, not a console error.
    console.warn('[balti/rezerva/confirmare]', error);
  }, [error]);
  return (
    <T4Frame
      pageState
      label="Confirmă rezervarea"
      header={<T4Header title="Confirmă rezervarea" back={{ href: routes.lakeBooking(id), label: 'Înapoi' }} />}
    >
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        actions={
          <Button onClick={() => startRetry(() => retry())} disabled={retrying} aria-busy={retrying || undefined}>
            Încearcă din nou
          </Button>
        }
      />
    </T4Frame>
  );
}
