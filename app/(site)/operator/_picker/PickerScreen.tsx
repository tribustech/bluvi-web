'use client';

import { useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/core/transport';
import { ownedLakesQuery } from '@/core/booking';
import { ListEmpty, ListGrid } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { OPERATOR_PICKER_TITLE, OperatorFrame } from '../_shared/OperatorFrame';
import { OperatorErrorState } from '../_shared/OperatorErrorState';
import { useOperatorTransport } from '../_shared/useOperatorTransport';
import { PICKER_BACK, pickerView } from './model';
import { OwnedLakeCard } from './OwnedLakeCard';

/**
 * /operator — operator.alege-balta (T1: one card grid, no filters). fish app/(app)/operator/index.tsx.
 * Rendered only for a signed-in viewer (page.tsx OperatorGate); the list is per owner, read in the
 * browser through /api/cms (GET /feed/owned-lakes, never cached).
 *
 * c2 loader while it loads · c3 the shared error screen (retry; «Deconectează-te» only for a dead
 * session — a SESSION_DEAD the providers already handle keeps the loader, as /notificari) · c4 one
 * lake → router.replace to its panel, the loader staying up meanwhile (no flash of the list, Back
 * leaves /operator) — the fallback only: page.tsx redirects on the server when its read of the
 * owned lakes succeeded · c5 «Nu administrezi niciun lac.» · c6 the cards in server order, auto-filling
 * the content column from 768 (one column on a phone).
 */
export function PickerScreen() {
  const t = useOperatorTransport();
  const router = useRouter();
  const titleId = useId();
  const read = useQuery(ownedLakesQuery(t));
  const view = pickerView(read);
  const redirectTo = view.kind === 'redirect' ? view.lakeId : null;

  useEffect(() => {
    if (redirectTo) router.replace(routes.operator(redirectTo));
  }, [redirectTo, router]);

  let body;
  if (view.kind === 'loading' || view.kind === 'redirect' || (view.kind === 'error' && isApiError(view.error) && view.error.code === 'SESSION_DEAD')) {
    body = <PickerLoader />;
  } else if (view.kind === 'error') {
    body = (
      <OperatorErrorState
        error={view.error}
        onRetry={() => void read.refetch()}
        retrying={read.isFetching}
        attempt={read.errorUpdateCount}
        next={routes.operator()}
      />
    );
  } else if (view.kind === 'empty') {
    body = <ListEmpty title="Nu administrezi niciun lac." description="Bălțile pe care le administrezi apar aici, cu rezervările și încasările zilei." />;
  } else {
    body = (
      <ListGrid min="lg" labelledBy={titleId}>
        {view.lakes.map((lake) => (
          <li key={lake.documentId} className="flex">
            <OwnedLakeCard lake={lake} />
          </li>
        ))}
      </ListGrid>
    );
  }

  return (
    <OperatorFrame title={OPERATOR_PICKER_TITLE} titleId={titleId} back={PICKER_BACK}>
      {body}
    </OperatorFrame>
  );
}

/**
 * c2 — fish LoadingScreen: the full-area loader. On the web, the cards' bones in the grid they will
 * fill (nothing moves when they land), announced once.
 */
export function PickerLoader() {
  return (
    <div role="status" data-testid="operator-picker-loading">
      <span className="sr-only">Se încarcă bălțile…</span>
      <ul aria-hidden className="grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fill,minmax(--spacing(85),1fr))]">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex min-h-37 flex-col justify-between rounded-card bg-surface p-4 shadow-e0 md:min-h-52 xl:p-5">
            <span className="h-5 w-[55%] animate-shimmer rounded-full" />
            <span className="grid grid-cols-[1fr_1fr_1.4fr] gap-2.25">
              {[0, 1, 2].map((j) => (
                <span key={j} className="h-14 animate-shimmer rounded-[13px] xl:h-16" />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
