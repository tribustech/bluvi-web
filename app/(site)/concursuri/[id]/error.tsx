'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { DetailBackButton, DetailError } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { COMPETITIONS_CRUMB } from './_components/crumbs';
import { LOAD_ERROR_COPY } from './_components/screen-state';

/**
 * Retries this boundary started, per page: a retry that throws again mounts a NEW error card (the
 * segment rendered in between), so the count lives outside the component. An entry older than
 * RETRY_WINDOW_MS belongs to a retry that worked (a later, unrelated error starts at 1 again).
 */
const retried = new Map<string, { n: number; at: number }>();
const RETRY_WINDOW_MS = 30_000;

/*
 * A render error inside the competition page (fish `ErrorBoundary` export of
 * competitions/[competitionId].tsx, parity competition-page.shell.c30): the T3 page error with
 * «Încearcă din nou» (re-renders the segment) instead of breaking the app; the top bar and the
 * phone's back chip stay usable. From 768 the page's own breadcrumb band (Competiții / Eroare).
 *
 * The retry is never silent (QueryRetry's pattern): while it runs the button is busy («Se
 * încarcă…», aria-busy, aria-disabled — focus stays on it); when it fails again the new card says
 * so in a polite status («Tot nu s-a putut încărca.») and under the button, with the attempt.
 */
export default function CompetitionError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePathname() ?? '';
  const [pending, start] = useTransition();
  const [attempt] = useState(() => {
    const last = retried.get(pathname);
    return last && Date.now() - last.at < RETRY_WINDOW_MS ? last.n : 0;
  });
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <DetailError
      trail={[COMPETITIONS_CRUMB]}
      back={<DetailBackButton fallbackHref={routes.home()} ground="page" />}
      heading="Concursul nu a putut fi afișat"
      description={error.digest ? `${LOAD_ERROR_COPY} Cod: ${error.digest}` : LOAD_ERROR_COPY}
      action={
        <>
          <Button
            aria-busy={pending || undefined}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (pending) return;
              retried.set(pathname, { n: attempt + 1, at: Date.now() });
              start(() => retry());
            }}
          >
            {pending ? 'Se încarcă…' : 'Încearcă din nou'}
          </Button>
          {attempt > 0 && !pending ? (
            <p className="t-caption text-muted">Tot nu s-a putut încărca. Încercarea {attempt + 1}.</p>
          ) : null}
          <span role="status" className="sr-only">
            {attempt > 0 && !pending ? 'Tot nu s-a putut încărca.' : ''}
          </span>
        </>
      }
    />
  );
}
