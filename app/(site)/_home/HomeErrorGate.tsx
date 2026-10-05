'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, type Query } from '@tanstack/react-query';
// TODO(core): describeError belongs in core/shared next to ApiError (its own TODO); Acasă is the
// second screen that needs it, and this task may not touch core/.
import { describeError } from '@/app/dev/templates/t1/describeError';
import { ListError } from '@/components/templates/T1/ListStates';
import { STATE_CARD } from '@/components/templates/T5';
import { Button } from '@/components/ui/Button';
import { createBrowserTransport } from '@/lib/client/transport';
import { useSiteToast } from '../_shell/Toast';
import { announce, prepareAnnouncer, restoreFocusTo } from './announce';
import { useHomeRefetch } from './HomeRefresh';
import { homeLakesQuery, homeNewsQuery } from './queries';

/**
 * fish (tabs)/index.tsx `isError` → <ErrorScreen goBack={false}>: when the lakes or the news read
 * fails, the whole of Acasă is replaced by the error card (title and message from describeError,
 * «Încearcă din nou» while retrying can help, «Deconectează-te» for a dead session); the retry
 * refetches everything. The competition rails are left out (they show their own error and retry).
 * The profile and the unread count are server reads on the web: a dead session renders the
 * signed-out page (lib/server/viewer.ts) and a failed count only hides the dot, so they never
 * reach this gate.
 *
 * Web difference, on purpose: only a read that failed WITH NOTHING ON SCREEN counts (T5: a failed
 * refetch keeps its data); fish also blanks the page when a background refetch of data it already
 * shows fails.
 */
export function HomeErrorGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const t = useMemo(() => createBrowserTransport(), []);
  const keys = useMemo(() => [homeLakesQuery(t).queryKey, homeNewsQuery(t).queryKey], [t]);

  const subscribe = useCallback((onChange: () => void) => qc.getQueryCache().subscribe(onChange), [qc]);
  const failed = useSyncExternalStore(
    subscribe,
    () => firstFailure(keys.map((k) => qc.getQueryCache().find({ queryKey: k, exact: true }))),
    () => null,
  );

  if (!failed) return children;
  return <HomeError error={failed} />;
}

function firstFailure(queries: (Query | undefined)[]): unknown {
  for (const q of queries) {
    if (q && q.state.status === 'error' && q.state.data === undefined) return q.state.error;
  }
  return null;
}

function HomeError({ error }: { error: unknown }) {
  const described = describeError(error);
  // No toast here: the card's own «Tot nu merge. Încercarea N.» is the one failure message.
  const refetch = useHomeRefetch();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const [retrying, startRetry] = useTransition();
  const [signingOut, startSignOut] = useTransition();
  const [attempt, setAttempt] = useState(1);
  const asked = useRef(false);

  // A retry that works unmounts this card with focus on its button: put focus on the page's
  // heading (from 768 the header's h1; on a phone the profile card's) and say what happened.
  useEffect(() => {
    prepareAnnouncer();
    return () => {
      if (!asked.current) return;
      announce('Datele au fost reîncărcate.');
      const h1 = Array.from(document.querySelectorAll<HTMLElement>('main h1')).find((h) => h.offsetParent !== null);
      restoreFocusTo(h1);
    };
  }, []);

  const signOut = () =>
    startSignOut(async () => {
      const ok = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(
        (r) => r.ok,
        () => false,
      );
      if (!ok) {
        toast('Nu am putut închide sesiunea. Încearcă din nou.', 'danger');
        return;
      }
      qc.clear();
      startSignOut(() => router.refresh());
    });

  return (
    <div className={STATE_CARD}>
      <ListError
        title={described.title}
        description={described.message}
        attempt={attempt}
        retrying={retrying}
        onRetry={
          described.canRetry
            ? () => {
                if (retrying) return;
                asked.current = true;
                startRetry(async () => {
                  await refetch();
                  setAttempt((n) => n + 1);
                });
              }
            : undefined
        }
        secondaryAction={
          described.showSignOut ? (
            <Button variant="secondary" onClick={signOut} aria-disabled={signingOut || undefined}>
              {signingOut ? 'Se deconectează…' : 'Deconectează-te'}
            </Button>
          ) : null
        }
      />
    </div>
  );
}
