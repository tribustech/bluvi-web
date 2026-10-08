'use client';

import { useEffect, useTransition } from 'react';
import { ListError } from '@/components/templates/T1';
import { PanelFrame } from './_panel/PanelSkeleton';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS
 * is down or slow) — never a sign-in form for a user who may well be signed in (owner rule 4): the
 * panel's frame with «Serverul nu răspunde» and «Încearcă din nou», which re-renders the gate.
 */
export default function OrganizerError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[organizator]', error);
  }, [error]);
  return (
    <PanelFrame>
      <ListError
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        onRetry={() => startRetry(() => retry())}
        retrying={retrying}
        focusOnMount
      />
    </PanelFrame>
  );
}
