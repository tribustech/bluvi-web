'use client';

import { useEffect, useState, useTransition } from 'react';
import { ListError } from '@/components/templates/T1';
import { DashboardPage, STATE_CARD } from '@/components/templates/T5';
import { PartideHeader, PartideTabs } from '../_hub/PartideChrome';

/** Retries this boundary started (a retry that throws again mounts a new card): the attempt count. */
let lastRetry: { n: number; at: number } | null = null;
const RETRY_WINDOW_MS = 30_000;

/**
 * A render error inside Explorează — a failed list read is NOT this (it renders its own state with a
 * retry). fish RouteErrorBoundary: the chrome stays, the page-state card with «Încearcă din nou».
 */
export default function ExploreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  const [attempt] = useState(() => (lastRetry && Date.now() - lastRetry.at < RETRY_WINDOW_MS ? lastRetry.n + 1 : 1));
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <DashboardPage header={<PartideHeader />} toolbar={<PartideTabs current="exploreaza" />}>
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
