'use client';

import { useEffect, useTransition } from 'react';
import { useBack } from '@/components/nav/useBack';
import { ListError, ListHeader, ListPage } from '@/components/templates/T1';
import { routes } from '@/lib/routes';

/**
 * The gate could not read the session (requireViewer → SessionUnknownError: a cookie, but the CMS
 * is down or slow) — or anything else under the gate failed. Never a sign-in form for a user who
 * may well be signed in (owner rule 4): the page's header, the T1 error card and «Încearcă din
 * nou», which re-renders the gate (app/(site)/setari/profil/error.tsx is the model).
 */
export default function SuggestedError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  const back = useBack(routes.home());
  useEffect(() => {
    console.warn('[pescari/sugerati]', error);
  }, [error]);

  return (
    <ListPage header={<ListHeader title="Sugestii pentru tine" back={{ label: 'Înapoi', onClick: back }} />}>
      <ListError
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        onRetry={() => startRetry(() => retry())}
        retrying={retrying}
        focusOnMount
      />
    </ListPage>
  );
}
