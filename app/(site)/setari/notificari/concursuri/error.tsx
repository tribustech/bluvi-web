'use client';

import { useEffect, useTransition } from 'react';
import { ListError } from '@/components/templates/T1';
import { FollowedFrame } from './_components/FollowedFrame';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS
 * is down or slow) — or anything else under the gate failed. Never a sign-in form for a user who
 * may well be signed in (owner rule 4): the page's frame with its real «Înapoi», the T1 error card
 * and «Încearcă din nou», which re-renders the gate (app/(site)/setari/profil/error.tsx is the model).
 */
export default function FollowedCompetitionsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[setari/notificari/concursuri]', error);
  }, [error]);

  return (
    <FollowedFrame>
      <ListError
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        onRetry={() => startRetry(() => retry())}
        retrying={retrying}
        focusOnMount
      />
    </FollowedFrame>
  );
}
