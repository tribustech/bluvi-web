'use client';

import { useEffect, useTransition } from 'react';
import { ListError } from '@/components/templates/T1';
import { DetailBackButton } from '@/components/templates/T3';
import { routes } from '@/lib/routes';

/**
 * The profile's error boundary (parity account.angler-profile). It sits in the (profil) group with the
 * page and its loading, so it wraps /pescari/[id] only: /conexiuni keeps its own error.tsx. Without it
 * a render that throws under the profile (the HydrationBoundary, AnglerProfileView) fell through to
 * the site-level boundary, which has no back control and no heading.
 *
 * The profile's own frame: the back chip (in-app history, else home), an sr-only h1 «Profil de
 * pescar», the T1 error card and «Încearcă din nou», which re-renders the route (conexiuni/error.tsx
 * is the model). Two causes, two copies: a server failure (it reaches the browser with a digest) is
 * fish ErrorScreen's «Serverul nu răspunde»; a throw while rendering in the browser is fish
 * AppErrorFallback's «Ceva n-a mers».
 */
export default function AnglerProfileError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[pescari/profil]', error);
  }, [error]);

  const server = !!error.digest;
  return (
    <div className="flex min-h-dvh flex-col pb-12" data-testid="profile-error">
      <h1 className="sr-only">Profil de pescar</h1>
      <div className="flex min-h-14 items-center px-4 pt-2 md:px-6 xl:px-8 xl:pt-4">
        <DetailBackButton fallbackHref={routes.home()} ground="page" inApp />
      </div>
      <ListError
        title={server ? 'Serverul nu răspunde' : 'Ceva n-a mers'}
        description={server ? 'Lucrăm la asta. Încearcă din nou în câteva minute.' : 'A apărut o problemă neașteptată pe acest ecran.'}
        onRetry={() => startRetry(() => retry())}
        retrying={retrying}
        focusOnMount
      />
    </div>
  );
}
