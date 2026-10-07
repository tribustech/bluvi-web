'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { T4Gate } from '@/components/templates/T4/T4Gate';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { BookingFrame } from './_grid/BookingFrame';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS
 * is down or slow), the lake read failed, or the screen crashed — never a sign-in form for a user
 * who may well be signed in (owner rule 4): the step's frame with «Serverul nu răspunde» and
 * «Încearcă din nou», which re-renders the gate. Model: app/(site)/setari/profil/error.tsx.
 */
export default function BookLakeError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { id } = useParams<{ id: string }>();
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    // Handled (the user sees the state and a retry): a warning, not a console error.
    console.warn('[balti/rezerva]', error);
  }, [error]);
  return (
    <BookingFrame title="Rezervare" back={{ href: routes.lake(id), label: 'Înapoi la baltă' }}>
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
    </BookingFrame>
  );
}
