'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserTransport } from '@/lib/client/transport';
import { makeQueryClient } from '@/lib/client/query-client';
import { CompetitionsScreen } from '../../../(site)/concursuri/_list/CompetitionsScreen';
import type { ListPlace } from '../../../(site)/concursuri/_list/place';
import { createDemoTransport, DEMO_DEADLINE_MS, runsInsideDeadline, withDeadline } from './demoTransport';
import type { DemoState } from './StateSwitcher';

/*
 * The T1 demo IS the shipped /concursuri screen (owner review 2026-10-06: the demo had drifted —
 * «Competiții», «Urmărite», no Județ chip, another bento and aside — so approving it did not
 * approve the page). Only two things differ: the transport, which forces the state (demoTransport.ts),
 * and a QueryClient of the demo's own per state, so a forced outage never reads or poisons the
 * real cached lists. «Eroare, apoi revine» / «CMS blocat» heal on the viewer's first click (the
 * retry), as the old demo did.
 */
export function DemoScreen({
  state,
  initial,
  isAuthenticated,
  seed,
}: {
  state: DemoState;
  initial: ListPlace;
  isAuthenticated: boolean;
  seed: number;
}) {
  const [client] = useState(() => makeQueryClient());
  const transport = useMemo(() => {
    if (!runsInsideDeadline(state)) return createDemoTransport(withDeadline(createBrowserTransport()), state);
    const demo = createDemoTransport(createBrowserTransport(), state);
    return { ...withDeadline(demo, DEMO_DEADLINE_MS), heal: demo.heal };
  }, [state]);
  useEffect(() => {
    const heal = () => transport.heal?.();
    document.addEventListener('click', heal, { capture: true, once: true });
    return () => document.removeEventListener('click', heal, { capture: true });
  }, [transport]);
  if (state === 'crash') throw new Error('T1 demo: forced render error');
  return (
    <QueryClientProvider client={client}>
      <CompetitionsScreen initial={initial} isAuthenticated={isAuthenticated} seed={seed} transport={transport} mirrorPath={false} />
    </QueryClientProvider>
  );
}
