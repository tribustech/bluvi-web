'use client';

import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { useBack } from '@/components/nav/useBack';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { FlowHeader, FlowLayout } from '@/components/templates/T6';
import { routes } from '@/lib/routes';
import { OperatorRouteError } from '../../_shared/OperatorErrorState';
import { RATE_TITLE } from './_rate/model';

/** The screen's T6 header + OperatorRouteError: «Serverul nu răspunde» for a server failure, «Ceva n-a mers» for a browser crash. */
export default function RateAnglerError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const goBack = useBack(routes.operator());
  return (
    <FlowLayout
      header={
        <FlowHeader
          title={RATE_TITLE}
          id="evalueaza-titlu"
          backPlaceholder={
            <button type="button" onClick={goBack} aria-label="Înapoi" className={headerChipClass()}>
              <ChevronLeftIcon aria-hidden />
            </button>
          }
        />
      }
      labelledBy="evalueaza-titlu"
      variant="bare"
      narrow
    >
      <OperatorRouteError error={error} retry={retry} scope="operator.evalueaza-pescar" />
    </FlowLayout>
  );
}
