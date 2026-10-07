'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useTransition } from 'react';
import { SettingsScreenFrame } from '@/components/account/settings';
import { T4Gate } from '@/components/templates/T4/T4Gate';
import { Button } from '@/components/ui/Button';
import { NOTIFICATION_SETTINGS_BACK, NOTIFICATION_SETTINGS_TITLE, TITLE_ID } from './_components/NotificationSettingsSkeleton';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS is
 * down or slow) — or anything else under the gate failed. Never a sign-in form for a user who may
 * well be signed in (owner rule 4): the screen's frame with «Serverul nu răspunde» and «Încearcă din
 * nou», which re-renders the gate (model: app/(site)/setari/profil/error.tsx).
 */
export default function NotificationSettingsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    // Handled (the user sees the state and a retry): a warning, not a console error.
    console.warn('[setari/notificari]', error);
  }, [error]);

  return (
    <SettingsScreenFrame title={NOTIFICATION_SETTINGS_TITLE} titleId={TITLE_ID} backFallback={NOTIFICATION_SETTINGS_BACK}>
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
    </SettingsScreenFrame>
  );
}
