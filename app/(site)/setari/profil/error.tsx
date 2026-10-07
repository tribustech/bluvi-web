'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useTransition } from 'react';
import { T4Gate } from '@/components/templates/T4/T4Gate';
import { Button } from '@/components/ui/Button';
import { EditProfileFrame } from './_components/EditProfileFrame';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS
 * is down or slow) — or anything else under the gate failed. Never a sign-in form for a user who
 * may well be signed in (owner rule 4): the screen's frame with fish ErrorScreen's server copy and
 * «Încearcă din nou», which re-renders the gate (`retry`: re-fetches the route's server part).
 * The model for every later requireViewer page.
 */
export default function EditProfileError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    // Handled (the user sees the state and a retry): a warning, not a console error.
    console.warn('[setari/profil]', error);
  }, [error]);

  return (
    <EditProfileFrame variant="bare">
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
    </EditProfileFrame>
  );
}
