'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { T4Frame, T4Gate, T4Header } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS
 * is down or slow) — or anything else under the gate failed. Never a sign-in form for a user who may
 * well be signed in (owner rule 4): the form's frame with «Serverul nu răspunde» and a retry that
 * re-renders the gate (as setari/profil/error.tsx).
 */
export default function ReviewFormError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ id?: string }>();
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[balti/recenzie]', error);
  }, [error]);

  return (
    <T4Frame
      pageState
      label="Recenzie"
      header={<T4Header title="Recenzie" back={{ label: 'Înapoi', href: params?.id ? routes.lakeReviews(params.id) : routes.lakes() }} />}
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
