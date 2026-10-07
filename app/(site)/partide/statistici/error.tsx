'use client';

import { useEffect, useState, useTransition } from 'react';
import { ListError } from '@/components/templates/T1';
import { DashboardPage, STATE_CARD } from '@/components/templates/T5';
import { routes } from '@/lib/routes';
import { VENUE_HEADER_INSET, VenueHeader } from '../../ape-publice/_components/venue/bits';

/** Retries this boundary started (a retry that throws again mounts a new card): the attempt count. */
let lastRetry: { n: number; at: number } | null = null;
const RETRY_WINDOW_MS = 30_000;

/**
 * A render error inside «Statistici comunitate» — a failed stats read is NOT this (the screen's own
 * error card, parity partide.statistici.c3). The header stays, the T5 page-state card with
 * «Încearcă din nou», which re-renders the segment; busy while it runs, «Tot nu merge» after.
 */
export default function StatsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  const [attempt] = useState(() => (lastRetry && Date.now() - lastRetry.at < RETRY_WINDOW_MS ? lastRetry.n + 1 : 1));
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <DashboardPage
      header={
        <div className={VENUE_HEADER_INSET}>
          <VenueHeader title="Statistici comunitate" backHref={routes.partide()} refresh={false} />
        </div>
      }
    >
      <div className={STATE_CARD}>
        <ListError
          title="Nu am putut încărca statisticile."
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
