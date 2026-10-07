'use client';

import { useEffect, useState, useTransition } from 'react';
import { ListError } from '@/components/templates/T1';
import { DashboardPage, STATE_CARD } from '@/components/templates/T5';
import { PartideHeader, PartideTabs } from './_hub/PartideChrome';

/** Retries this boundary started (a retry that throws again mounts a new card): the attempt count. */
let lastRetry: { n: number; at: number } | null = null;
const RETRY_WINDOW_MS = 30_000;

/**
 * A render error inside Partide — a failed overview is NOT this (fish retry false: it renders as
 * empty sections). fish RouteErrorBoundary: the chrome stays, the T5 page-state card with «Încearcă
 * din nou», which re-renders the segment; busy while it runs, «Tot nu merge. Încercarea N.» after.
 */
export default function PartideError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  const [attempt] = useState(() => (lastRetry && Date.now() - lastRetry.at < RETRY_WINDOW_MS ? lastRetry.n + 1 : 1));
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <DashboardPage header={<PartideHeader />} toolbar={<PartideTabs current="comunitate" />}>
      <div className={STATE_CARD}>
        <ListError
          title="Partidele nu au putut fi afișate."
          description="A apărut o eroare neașteptată. Încearcă din nou; dacă persistă, scrie-ne."
          onRetry={() => {
            if (pending) return;
            lastRetry = { n: attempt, at: Date.now() };
            start(() => retry());
          }}
          retrying={pending}
          attempt={attempt}
          focusOnMount
        />
      </div>
    </DashboardPage>
  );
}
