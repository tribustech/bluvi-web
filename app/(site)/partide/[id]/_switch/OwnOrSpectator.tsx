'use client';

import { Suspense, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActiveSession } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { useViewerState } from '../../../_shell/viewer-context';
import { isUnknownViewer, userOf } from '../../../_shell/viewer-state';

/*
 * /partide/[id]: whose partidă is this? (parity partide.spectator.c1; fish comunitate/[id].tsx
 * ownership check). Contract shared with partide.partida (M4-B2), which takes over the member
 * branch: OwnOrSpectator({ documentId, spectator, notFound }).
 *
 *  - The static shell carries the spectator view (or `notFound` when the server had no public
 *    partidă, `spectator` null): it is the Suspense fallback, so the prerendered HTML holds the
 *    whole public page (title, total, catches) — never a skeleton — whoever opens it.
 *  - Signed out, or the session unknown: that same view.
 *  - Signed in: the viewer's live partidă is read (core getActiveSession, GET /feed/sessions/active
 *    — fish read its local active-session pointer); the spectator view stays on screen meanwhile,
 *    and a failed read keeps it.
 *  - It IS the viewer's own live partidă: fish replaces the screen with the member view. That view
 *    is M4-B2 (partide.partida); until then the spectator view stays (`data-own` marks the branch).
 *  - `notFound` is rendered as given (the page passes the not-found state, noindex) — B2 will first
 *    ask the member read (/feed/sessions/:id) whether the viewer may see a PRIVATE partidă there.
 */

export function OwnOrSpectator({ documentId, spectator, notFound }: { documentId: string; spectator: ReactNode; notFound: ReactNode }) {
  return (
    <Suspense fallback={spectator ?? notFound}>
      <Resolve documentId={documentId} spectator={spectator} notFound={notFound} />
    </Suspense>
  );
}

function Resolve({ documentId, spectator, notFound }: { documentId: string; spectator: ReactNode; notFound: ReactNode }) {
  const viewer = useViewerState();
  const signedIn = !!userOf(viewer) && !isUnknownViewer(viewer);
  const t = useMemo(() => createBrowserTransport(), []);
  const active = useQuery({
    queryKey: ['partide', 'active-session'] as const,
    queryFn: () => getActiveSession(t),
    enabled: signedIn,
    staleTime: 30_000,
    retry: false,
  });
  const shown = spectator ?? notFound;
  if (!signedIn) return <>{shown}</>;
  const own = active.isSuccess && active.data?.documentId === documentId;
  return (
    <div data-own={own || undefined} className="contents">
      {shown}
    </div>
  );
}
