'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { T4Frame, T4Gate, T4Header } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The session could not be read (SessionUnknownError: a cookie, but the CMS is down or slow) — or
 * anything else on the page failed. Never a sign-in form for a viewer who may well be signed in
 * (owner rule 4): the form's frame with «Serverul nu răspunde» and a retry that re-renders the page
 * (as balti/[id]/recenzie/error.tsx).
 */
export default function RegistrationError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ id?: string }>();
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[concursuri/inscriere]', error);
  }, [error]);

  return (
    <T4Frame
      pageState
      label="Înscriere"
      header={
        <T4Header
          title="Înscriere"
          back={{
            label: 'Înapoi la concurs',
            href: params?.id ? routes.competition(params.id) : routes.competitions(),
          }}
        />
      }
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
