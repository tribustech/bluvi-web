'use client';

import { useParams } from 'next/navigation';
import { routes } from '@/lib/routes';
import { BookingFrame } from '@/app/(site)/balti/[id]/rezerva/_grid/BookingFrame';
import { OperatorRouteError } from '../../_shared/OperatorErrorState';
import { useOwnedLakeName } from '../../_shared/useOwnedLakeName';
import { walkInFlow } from './_walkin/flowConfig';

/**
 * The gate could not read the session (SessionUnknownError: a cookie, but the CMS is down or slow),
 * the lake read failed, or the screen crashed: the calendar's own frame with «Serverul nu răspunde» /
 * «Ceva n-a mers» and «Încearcă din nou» (OperatorRouteError) — never a sign-in form for a user who
 * may well be signed in (owner rule 4).
 */
export default function OperatorCalendarError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { lakeId } = useParams<{ lakeId: string }>();
  const config = walkInFlow(lakeId);
  const name = useOwnedLakeName(lakeId);
  return (
    <BookingFrame title={name === undefined ? undefined : name || config.titleFallback} eyebrow={config.eyebrow} back={{ href: routes.operator(lakeId), label: 'Înapoi' }}>
      <OperatorRouteError error={error} retry={retry} scope="operator/calendar" />
    </BookingFrame>
  );
}
