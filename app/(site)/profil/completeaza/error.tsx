'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useTransition } from 'react';
import { T4Gate } from '@/components/templates/T4/T4Gate';
import { Button } from '@/components/ui/Button';
import { CompleteProfileFrame } from './_components/CompleteProfileFrame';

/**
 * The gate could not read the session (SessionUnknownError: a cookie, but the CMS is down or slow):
 * never a sign-in form (owner rule 4) — the screen's frame with «Serverul nu răspunde» and a retry
 * that re-renders the gate (as setari/profil/error.tsx).
 */
export default function CompleteProfileError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[profil/completeaza]', error);
  }, [error]);

  return (
    <CompleteProfileFrame variant="bare">
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
    </CompleteProfileFrame>
  );
}
