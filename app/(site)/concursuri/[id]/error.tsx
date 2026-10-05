'use client';

import { useEffect } from 'react';
import { DetailBackButton, DetailError } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { LOAD_ERROR_COPY } from './_components/screen-state';

/*
 * A render error inside the competition page (fish `ErrorBoundary` export of
 * competitions/[competitionId].tsx, parity competition-page.shell.c30): the T3 page error with
 * «Încearcă din nou» (re-renders the segment) instead of breaking the app; the top bar and the
 * phone's back chip stay usable.
 */
export default function CompetitionError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <DetailError
      back={<DetailBackButton fallbackHref={routes.home()} ground="page" />}
      heading="Concursul nu a putut fi afișat"
      description={
error.digest ? `${LOAD_ERROR_COPY} Cod: ${error.digest}` : LOAD_ERROR_COPY
      }
      action={<Button onClick={() => retry()}>Încearcă din nou</Button>}
    />
  );
}
