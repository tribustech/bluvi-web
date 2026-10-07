'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useTransition } from 'react';
import { T4Gate } from '@/components/templates/T4/T4Gate';
import { Button } from '@/components/ui/Button';

/**
 * /profil's route-level error boundary — fish exports RouteErrorBoundary from (tabs)/profile.tsx
 * (parity account.own-profile c7): when the page throws, the user gets a retry instead of a blank
 * body, and the rest of the app (the top bar, every other page) keeps working.
 *
 * Two causes, two copies (never the raw message):
 *  - the server part failed — requireViewer could not read the session (SessionUnknownError: a
 *    cookie, but the CMS is down or slow) or the render threw on the server. Those errors reach the
 *    browser with a `digest` (their message is redacted in production): fish ErrorScreen's server
 *    copy «Serverul nu răspunde», as /setari/profil (never a sign-in form for a user who may well be
 *    signed in, owner rule 4);
 *  - the page threw while rendering in the browser (no digest): fish AppErrorFallback's «Ceva n-a
 *    mers» (its «we sent the details» line is left out: the web has no crash reporting yet).
 * «Încearcă din nou» = `retry()`: re-fetches the route's server part and re-renders it.
 */
export default function OwnProfileError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    // Handled (the user sees the state and a retry): a warning, not a console error.
    console.warn('[profil]', error);
  }, [error]);

  const server = !!error.digest || error.name === 'SessionUnknownError';
  return (
    <div className="flex min-h-[60dvh] flex-col px-4 py-6 md:px-6 md:py-10 xl:px-8" data-testid="profile-error">
      <h1 className="sr-only">Profilul meu</h1>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title={server ? 'Serverul nu răspunde' : 'Ceva n-a mers'}
        description={
          server ? 'Lucrăm la asta. Încearcă din nou în câteva minute.' : 'A apărut o problemă neașteptată pe acest ecran.'
        }
        actions={
          <Button onClick={() => startRetry(() => retry())} disabled={retrying} aria-busy={retrying || undefined}>
            Încearcă din nou
          </Button>
        }
      />
    </div>
  );
}
