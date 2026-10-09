'use client';

import { useParams } from 'next/navigation';
import { T4Frame, T4Header } from '@/components/templates/T4';
import { routes } from '@/lib/routes';
import { OperatorRouteError } from '../../../_shared/OperatorErrorState';
import { useOwnedLakeName } from '../../../_shared/useOwnedLakeName';

/**
 * The gate could not read the session (SessionUnknownError: a cookie, but the CMS is down or slow),
 * the lake read failed, or the screen crashed: the step's own frame with «Serverul nu răspunde» /
 * «Ceva n-a mers» and «Încearcă din nou» (OperatorRouteError) — never a sign-in form (owner rule 4).
 */
export default function OperatorCalendarExtrasError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lakeId } = useParams<{ lakeId: string }>();
  const name = useOwnedLakeName(lakeId);
  return (
    <T4Frame
      header={<T4Header eyebrow={name || 'Balta'} title="Extra" back={{ label: 'Înapoi la calendar', href: routes.operatorCalendar(lakeId) }} />}
      pageState
    >
      <OperatorRouteError error={error} retry={retry} scope="operator/calendar/extra" />
    </T4Frame>
  );
}
