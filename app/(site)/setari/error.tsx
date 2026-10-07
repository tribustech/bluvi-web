'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useTransition } from 'react';
import { T4Gate } from '@/components/templates/T4/T4Gate';
import { Button } from '@/components/ui/Button';
import { SettingsFrame } from './_components/SettingsFrame';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS is
 * down or slow) — or anything else under the gate failed. Never a sign-in form for a user who may
 * well be signed in (owner rule 4): the hub's frame, without a back control (account.settings.c1, fish
 * ErrorScreen goBack={false}), with «Serverul nu răspunde» and «Încearcă din nou», which re-renders
 * the gate (model: app/(site)/setari/notificari/error.tsx).
 */
export default function SettingsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    // Handled (the user sees the state and a retry): a warning, not a console error.
    console.warn('[setari]', error);
  }, [error]);

  return (
    <SettingsFrame back={false}>
      <div className="xl:max-w-180">
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
      </div>
    </SettingsFrame>
  );
}
