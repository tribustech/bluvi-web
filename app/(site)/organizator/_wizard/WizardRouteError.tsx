'use client';

import { useEffect, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { T4Frame, T4Gate, T4Header } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The wizard routes' error boundary (as concursuri/[id]/inscriere/error.tsx): the session could not
 * be read (SessionUnknownError — a cookie, but the CMS is down or slow) or the page failed. Never a
 * sign-in form for a viewer who may well be signed in (owner rule 4): the frame with «Serverul nu
 * răspunde» and a retry that re-renders the page.
 */
export function WizardRouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ id?: string }>();
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[organizator/asistent]', error);
  }, [error]);
  const competitionId = params?.id;
  return (
    <T4Frame
      pageState
      label={competitionId ? 'Modifică competiția' : 'Competiție nouă'}
      header={
        <T4Header
          title={competitionId ? 'Modifică competiția' : 'Competiție nouă'}
          back={{ label: 'Înapoi', href: competitionId ? routes.competition(competitionId) : routes.organizer() }}
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
