'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo, useTransition } from 'react';
import { T4Frame, T4Header } from '@/components/templates/T4';
import { ApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import { ExtrasScreen, type ExtrasLake } from '@/app/(site)/balti/[id]/rezerva/extra/ExtrasScreen';
import { ExtrasSkeleton } from '@/app/(site)/balti/[id]/rezerva/extra/ExtrasSkeleton';
import { OperatorErrorState } from '../../../_shared/OperatorErrorState';
import { useOwnedLakeName } from '../../../_shared/useOwnedLakeName';
import { walkInFlow } from '../_walkin/flowConfig';

/*
 * The client half of operator.calendar-extra: the walk-in FlowConfig holds path builders, so it is
 * built here, once per mount, never passed from the server page.
 */

export function WalkInExtrasScreen({ lake }: { lake: ExtrasLake }) {
  const config = useMemo(() => walkInFlow(lake.documentId), [lake.documentId]);
  return <ExtrasScreen lake={lake} config={config} />;
}

/**
 * Before the gate answered (and loading.tsx): the step's frame, its back link to the calendar and
 * the lake's name once the owned-lakes list knows it (a line skeleton until then, never «Balta»
 * swapped for the name — rule 4).
 */
export function WalkInExtrasSkeleton() {
  const { lakeId } = useParams<{ lakeId: string }>();
  const name = useOwnedLakeName(lakeId);
  return <ExtrasSkeleton lakeName={name} gridHref={routes.operatorCalendar(lakeId)} />;
}

/** The CMS's own refusal for a lake that is not yours (what the calendar's owner-gated list answers). */
const NOT_YOURS = new ApiError({ message: 'Forbidden', status: 403, code: 'HTTP' });

/**
 * Signed in, but not this lake's owner (operator.b.role-gating): the step's frame with the operator
 * screens' one refusal state, «Nu ai acces» (OperatorErrorState, as the calendar shows it) — never
 * the walk-in extras and their live «Continuă». «Încearcă din nou» re-runs the server check (a lake
 * handed over meanwhile opens the step).
 */
export function WalkInExtrasForbidden({ lakeId, lakeName, next }: { lakeId: string; lakeName: string; next: string }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  return (
    <T4Frame
      header={<T4Header eyebrow={lakeName || 'Balta'} title="Extra" back={{ label: 'Înapoi la calendar', href: routes.operatorCalendar(lakeId) }} />}
      pageState
    >
      <OperatorErrorState error={NOT_YOURS} next={next} focusOnMount retrying={retrying} onRetry={() => startRetry(() => router.refresh())} />
    </T4Frame>
  );
}
