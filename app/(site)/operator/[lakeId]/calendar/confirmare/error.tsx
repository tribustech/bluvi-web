'use client';

import { useParams } from 'next/navigation';
import { T4Frame, T4Header, T4LineBar } from '@/components/templates/T4';
import { routes } from '@/lib/routes';
import { OperatorRouteError } from '../../../_shared/OperatorErrorState';
import { useOwnedLakeName } from '../../../_shared/useOwnedLakeName';

/**
 * The gate could not read the session (the CMS down or slow), the lake read failed, or the screen
 * crashed: the step's own header with «Serverul nu răspunde» / «Ceva n-a mers» and «Încearcă din
 * nou» (OperatorRouteError) — never a sign-in form for a user who may well be signed in (rule 4).
 * Back leaves to the calendar (no selection to keep: the step could not read it).
 */
export default function OperatorWalkInReviewError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lakeId } = useParams<{ lakeId: string }>();
  const name = useOwnedLakeName(lakeId);
  return (
    <T4Frame
      pageState
      label="Confirmă rezervarea"
      header={
        <T4Header
          title="Confirmă rezervarea"
          eyebrow={name ?? <T4LineBar type="t-eyebrow" className="w-28" />}
          back={{ href: routes.operatorCalendar(lakeId), label: 'Înapoi' }}
        />
      }
    >
      <OperatorRouteError error={error} retry={retry} scope="operator/calendar/confirmare" />
    </T4Frame>
  );
}
