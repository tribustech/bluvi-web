'use client';

import { useEffect, useTransition } from 'react';
import { describeError, ListError } from '@/components/templates/T1';
import { Button } from '@/components/ui/Button';
import { useSignOut } from '@/lib/client/sign-out';
import { routes } from '@/lib/routes';
import { isServerFailure } from './route-error';

/**
 * fish components/ErrorScreen.tsx for every operator screen — a read failed and nothing is cached
 * (a failed refetch WITH data keeps the data on screen: don't render this then). The templates' one
 * page-state card (T1 ListError, the T5 DashboardError look): what describeError says about the
 * error, «Încearcă din nou» when retrying can help (`onRetry`: refetch the failed queries), and
 * «Deconectează-te» only for a dead session (401) — signing out fixes nothing else. A refusal of
 * the CMS's owner gate (403: not your lake) reads «Nu ai acces» (operator.b.role-gating).
 *
 * `next`: where /intra returns after the sign-out (the page's own path with its query).
 * `attempt`: TanStack errorUpdateCount, so a retry that fails again is said again.
 */
export function OperatorErrorState({
  error,
  onRetry,
  retrying = false,
  attempt,
  next,
  focusOnMount,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  attempt?: number;
  next: string;
  focusOnMount?: boolean;
}) {
  const d = describeError(error);
  const { signOut, signingOut } = useSignOut({ to: routes.signIn(next) });
  return (
    <ListError
      title={d.title}
      description={d.message}
      onRetry={d.canRetry ? onRetry : undefined}
      retrying={retrying}
      attempt={attempt}
      focusOnMount={focusOnMount}
      secondaryAction={
        d.showSignOut ? (
          <Button variant="outline" aria-disabled={signingOut || undefined} aria-busy={signingOut || undefined} onClick={() => signOut()}>
            {signingOut ? 'Se deconectează…' : 'Deconectează-te'}
          </Button>
        ) : undefined
      }
    />
  );
}

/**
 * The body of an operator route's error.tsx. Two causes, two copies (never the raw message), as
 * /profil/error.tsx:
 *  - the server part failed — the gate could not read the session (requireViewer →
 *    SessionUnknownError: a cookie, but the CMS is down or slow) or the render threw on the server.
 *    Those reach the browser with a `digest`: «Serverul nu răspunde» (never a sign-in form for a user
 *    who may well be signed in, owner rule 4);
 *  - the screen threw while rendering in the browser (no digest): «Ceva n-a mers».
 * «Încearcă din nou» = `retry()`, which re-renders the gate. Wrap it in the page's own OperatorFrame:
 *
 *   'use client';
 *   export default function E({ error, retry }) {
 *     return <OperatorFrame …><OperatorRouteError error={error} retry={retry} /></OperatorFrame>;
 *   }
 */
export function OperatorRouteError({
  error,
  retry,
  scope = 'operator',
}: {
  error: Error & { digest?: string };
  retry: () => void;
  scope?: string;
}) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    // Handled (the user sees the state and a retry): a warning, not a console error.
    console.warn(`[${scope}]`, error);
  }, [error, scope]);
  const server = isServerFailure(error);
  return (
    <ListError
      title={server ? 'Serverul nu răspunde' : 'Ceva n-a mers'}
      description={server ? 'Lucrăm la asta. Încearcă din nou în câteva minute.' : 'A apărut o problemă neașteptată pe acest ecran.'}
      onRetry={() => startRetry(() => retry())}
      retrying={retrying}
      focusOnMount
    />
  );
}
