'use client';

import { useEffect, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { T4Gate } from '@/components/templates/T4';
import { FlowHeader, FlowLayout } from '@/components/templates/T6';
import { Button, ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The session could not be read (SessionUnknownError) — or anything else on the page failed. Never a
 * sign-in form for a viewer who may be signed in (owner rule 4): «Serverul nu răspunde» with a retry
 * and the way back to the penalties, in the form's own frame.
 */
export default function ApplyPenaltyError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ id?: string }>();
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[concursuri/penalizari/aplica]', error);
  }, [error]);
  const back = params?.id ? routes.competitionPenalties(params.id) : routes.competitions();
  return (
    <FlowLayout
      header={<FlowHeader title="Aplică penalizare" id="aplica-penalizare-titlu" backHref={back} backLabel="Înapoi la penalizări" />}
      variant="bare"
      narrow
      labelledBy="aplica-penalizare-titlu"
    >
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        actions={
          <>
            <Button onClick={() => startRetry(() => retry())} disabled={retrying} aria-busy={retrying || undefined}>
              Încearcă din nou
            </Button>
            <ButtonLink variant="secondary" href={back}>
              Înapoi la penalizări
            </ButtonLink>
          </>
        }
      />
    </FlowLayout>
  );
}
