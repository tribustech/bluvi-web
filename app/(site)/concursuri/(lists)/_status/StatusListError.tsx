'use client';

import { useEffect, useState, useTransition } from 'react';
import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import { ListError, ListHeader, ListPage } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { STATUS_LISTS, statusListTrail, type StatusListKey } from './config';
import { StatusTabs } from './StatusListShell';

/** Retries started per list within the window: a retry that throws again mounts a new card. */
const retried = new Map<StatusListKey, { n: number; at: number }>();
const RETRY_WINDOW_MS = 30_000;

/*
 * The route error boundary of a status list (fish: each status screen exports RouteErrorBoundary —
 * parity viitoare.c15 / live.c15 / incheiate.c15, competitions-list.b.route-error-boundary): a crash
 * shows a retry card for THIS route only, under the page's own header; the top bar and the rest of
 * the site keep working. The retry re-reads and re-renders the route (Next `retry`), stays busy
 * while it runs and says so when it fails again; focus lands on its button.
 */
export function StatusListError({ list, error, retry }: { list: StatusListKey; error: Error & { digest?: string }; retry: () => void }) {
  const cfg = STATUS_LISTS[list];
  const [pending, start] = useTransition();
  const [attempt] = useState(() => {
    const last = retried.get(list);
    return last && Date.now() - last.at < RETRY_WINDOW_MS ? last.n : 0;
  });
  useEffect(() => {
    // Handled: the card says so and offers the retry.
    console.warn('[concursuri]', error);
  }, [error]);

  return (
    <>
      <BreadcrumbBand trail={statusListTrail(list)} />
      <ListPage header={<ListHeader title={cfg.title} back={{ label: 'Înapoi', href: routes.competitions() }} below={<StatusTabs active={list} />} />}>
        <ListError
          title="Concursurile nu s-au putut afișa"
          description={`A apărut o eroare pe această pagină. Încearcă din nou.${error.digest ? ` Cod: ${error.digest}` : ''}`}
          focusOnMount
          attempt={attempt + 1}
          retrying={pending}
          onRetry={() => {
            retried.set(list, { n: attempt + 1, at: Date.now() });
            start(() => retry());
          }}
        />
      </ListPage>
    </>
  );
}
