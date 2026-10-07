'use client';

import { useEffect, useTransition } from 'react';
import { ListError, ListHeader } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { NotificationsFrame } from './_components/NotificationsSkeleton';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS
 * is down or slow) — never a sign-in form for a user who may well be signed in (owner rule 4): the
 * page's frame with «Serverul nu răspunde» and «Încearcă din nou», which re-renders the gate.
 * Model: app/(site)/setari/profil/error.tsx.
 */
export default function NotificationsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[notificari]', error);
  }, [error]);
  return (
    <NotificationsFrame header={<ListHeader title="Notificări" back={{ href: routes.home(), label: 'Înapoi' }} />}>
      <ListError
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        onRetry={() => startRetry(() => retry())}
        retrying={retrying}
        focusOnMount
      />
    </NotificationsFrame>
  );
}
