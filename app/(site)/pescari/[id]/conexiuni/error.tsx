'use client';

import { useParams } from 'next/navigation';
import { useEffect, useTransition } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { useBack } from '@/components/nav/useBack';
import { ListError, ListHeader, ListPage } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { UNNAMED_TRAIL } from './_components/ConnectionsSkeleton';

/**
 * The route's error boundary. Never a sign-in form for a user who may well be signed in (owner
 * rule 4): the page's header — the same box as the loaded page and its skeleton, with a real
 * «Înapoi» (in-app history, else the angler's profile) — the T1 error card and «Încearcă din nou»,
 * which re-renders the route. The band keeps the skeleton's «Acasă / Conexiuni» (UNNAMED_TRAIL):
 * never the URL-derived «Pescari», which has no page.
 *
 * Two causes, two copies (app/(site)/profil/error.tsx is the model):
 *  - the server part failed — the gate could not read the session (requireViewer →
 *    SessionUnknownError: a cookie, but the CMS is down or slow) or the render threw on the server
 *    (those reach the browser with a `digest`): fish ErrorScreen's «Serverul nu răspunde»;
 *  - the list or a row threw while rendering in the browser (no digest): fish AppErrorFallback's
 *    «Ceva n-a mers» (its «we sent the details» line left out: the web has no crash reporting yet).
 */
export default function ConnectionsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  const { id } = useParams<{ id: string }>();
  const back = useBack(routes.angler(id));
  useEffect(() => {
    console.warn('[pescari/conexiuni]', error);
  }, [error]);

  const server = !!error.digest || error.name === 'SessionUnknownError';
  return (
    <ListPage header={<ListHeader title="Conexiuni" back={{ label: 'Înapoi', onClick: back }} />}>
      <SetBreadcrumb trail={UNNAMED_TRAIL} />
      <ListError
        title={server ? 'Serverul nu răspunde' : 'Ceva n-a mers'}
        description={server ? 'Lucrăm la asta. Încearcă din nou în câteva minute.' : 'A apărut o problemă neașteptată pe acest ecran.'}
        onRetry={() => startRetry(() => retry())}
        retrying={retrying}
        focusOnMount
      />
    </ListPage>
  );
}
