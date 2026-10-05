'use client';

import { useEffect, useTransition } from 'react';
import { catchError, type ErrorInfo } from 'next/error';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { T4Gate } from '@/components/templates/T4';
import { FlowHeader, FlowLayout } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';

/**
 * The flow's error boundary (Next `catchError`): an unexpected throw while rendering a step — on
 * the server or in AddCatchFlow on the client — lands on the same danger gate as a failed read
 * (page.tsx ErrorFlow), inside the shell (top bar, breadcrumb), with a «Reîncearcă» that re-fetches
 * and re-renders the step (`retry`). An error.tsx would replace the page that renders SiteLayout,
 * so the top bar would go with it.
 */
function DemoErrorFallback({ stepTwo, backHref }: { stepTwo: boolean; backHref: string }, { error, retry }: ErrorInfo) {
  const [pending, start] = useTransition();
  useEffect(() => {
    console.error('[t6] render failed', error);
  }, [error]);
  const blank = <span aria-hidden>{' '}</span>;
  return (
    <FlowLayout
      header={
        <FlowHeader
          id="t6-title"
          title={stepTwo ? 'Adaugă captură' : 'Alege standul'}
          eyebrow={blank}
          meta={blank}
          backHref={backHref}
          backLabel={stepTwo ? 'Înapoi la standuri' : 'Înapoi la concursuri'}
        />
      }
      labelledBy="t6-title"
      variant="bare"
      narrow
    >
      <T4Gate
        tone="danger"
        icon={<ExclamationCircleIcon aria-hidden />}
        title="Pagina nu a putut fi afișată"
        description={<span role="alert">A apărut o eroare neașteptată. Încearcă din nou; dacă persistă, scrie-ne.</span>}
        actions={
          <Button disabled={pending} aria-busy={pending || undefined} onClick={() => start(() => retry())}>
            {pending ? 'Se reîncarcă…' : 'Reîncearcă'}
          </Button>
        }
      />
    </FlowLayout>
  );
}

export const DemoErrorBoundary = catchError(DemoErrorFallback);
