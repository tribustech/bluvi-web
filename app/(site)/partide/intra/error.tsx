'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useTransition } from 'react';
import { FlowHeader, FlowLayout } from '@/components/templates/T6';
import { T4Gate } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS
 * is down or slow) — never a sign-in form for someone who may be signed in (owner rule 4). The
 * flow's header and the T6 gate (T4Gate in a bare, narrow FlowLayout) with «Încearcă din nou»,
 * which re-renders the gate (model: app/(site)/balti/[id]/rezerva/confirmare/error.tsx).
 */
export default function JoinPartidaError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    // Handled (the user sees the state and a retry): a warning, not a console error.
    console.warn('[partide/intra]', error);
  }, [error]);
  return (
    <FlowLayout header={<FlowHeader title="Alătură-te unei partide" backHref={routes.partide()} backLabel="Înapoi la Partide" />} variant="bare" narrow>
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
    </FlowLayout>
  );
}
