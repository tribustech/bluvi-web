'use client';

import { useEffect, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { T4Gate } from '@/components/templates/T4';
import { FlowHeader, FlowLayout } from '@/components/templates/T6';
import { Button, ButtonLink } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { TITLE, TITLE_ID } from './_revisions/RevisionsSkeleton';

/**
 * The session could not be read (SessionUnknownError: a cookie, but the CMS is down or slow) — or
 * anything else on the page failed. Never a sign-in form for a viewer who may be signed in (owner
 * rule 4): «Serverul nu răspunde» with a retry and the way back to the weighing, in the page's frame.
 */
export default function RevisionsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const params = useParams<{ id?: string; standId?: string; weighingId?: string }>();
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[concursuri/cantar/modificari]', error);
  }, [error]);
  const back =
    params?.id && params.standId && params.weighingId
      ? routes.competitionScaleWeighing(params.id, params.standId, params.weighingId)
      : params?.id
        ? routes.competitionScale(params.id)
        : routes.competitions();
  return (
    <FlowLayout
      header={<FlowHeader title={TITLE} id={TITLE_ID} backHref={back} backLabel="Înapoi la cântar" />}
      variant="bare"
      narrow
      labelledBy={TITLE_ID}
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
              Înapoi la cântar
            </ButtonLink>
          </>
        }
      />
    </FlowLayout>
  );
}
