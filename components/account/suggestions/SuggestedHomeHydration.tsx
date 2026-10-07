'use client';

import { HydrationBoundary, useQueryClient, type DehydratedState } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { anglersKeys } from '@/core/social';

/**
 * The Home rail's server-read suggestions, hydrated ONLY into an empty cache (account.suggested
 * c13, home.b.suggested-cache-policy).
 *
 * fish reads suggested-home once per launch (services/queries/useSuggestedAnglersHome.ts:16-20 —
 * no refetch on mount, focus or reconnect; a follow only marks it stale). On the web every server
 * render of Home — a client Link navigation too, the page being dynamic per viewer — prefetches a
 * fresh, server-rotated page 1, and a plain HydrationBoundary writes it over the browser's
 * ['anglers','suggested-home'] entry whenever its timestamp is newer: the pages /pescari/sugerati
 * had loaded, its order and the cards just followed were replaced by a reshuffled page 1.
 *
 * Here the decision is taken once, when the rail mounts: the browser already holds the pool (this
 * tab read it on Home or on «Vezi toate») → the server's copy is ignored and the rail and the page
 * keep the tab's one answer; the cache is empty (a fresh load, the server render) → hydrated as
 * before, so the rail paints with the page.
 */
export function SuggestedHomeHydration({ state, children }: { state: DehydratedState; children: ReactNode }) {
  const qc = useQueryClient();
  const [seed] = useState(() => (qc.getQueryData(anglersKeys.suggestedHome) === undefined ? state : undefined));
  return <HydrationBoundary state={seed}>{children}</HydrationBoundary>;
}
