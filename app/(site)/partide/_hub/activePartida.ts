'use client';

import { useMemo } from 'react';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import { communityKeys, createServerClock, getActiveSession, getSession, partideHistoryQuery, partideKeys, type SessionDetailDTO } from '@/core/partide';
import type { Transport } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { useViewerState, userOf, isUnknownViewer } from '../../_shell/viewer-context';

/*
 * The viewer's live partidă on the Partide hub. fish `useActivePartida` reads a device pointer and
 * follows the session in Firestore; the web has neither yet, so — as Acasă does
 * (_home/data.ts loadActivePartida) — it asks the CMS which partidă is live (`/feed/sessions/active`,
 * the probe fish runs after sign-in) and reads that session over HTTP (rods with their deadlines,
 * the catches), through the /api/cms proxy with the session cookie. The live provider of the
 * partidă batch (core/realtime/partide) can take this over later without changing the callers.
 *
 * The rod countdowns need the CMS's clock (fish serverClock): the session read's `Date` header is
 * the sample, so a chip says «sincronizare…» until that answer has arrived — never a false «expirat».
 */

/** One clock per tab: every read of the probe feeds it. */
export const partideServerClock = createServerClock();

/** A transport that samples the server clock from each response's Date header. */
function sampling(t: Transport): Transport {
  return {
    async request<T>(req: Parameters<Transport['request']>[0]) {
      const res = await t.request<T>(req);
      partideServerClock.noteHttpDate(res.headers);
      return res;
    },
  };
}

/** The probe's key — under `partide` (fish queryKeys.partide), per viewer. */
export const activePartidaKey = (uid: string) => [...partideKeys.mine, 'active', uid] as const;

export function activePartidaQuery(t: Transport, uid: string) {
  return {
    queryKey: activePartidaKey(uid),
    queryFn: async (): Promise<SessionDetailDTO | null> => {
      const active = await getActiveSession(t);
      if (!active?.documentId) return null;
      const session = await getSession(sampling(t), active.documentId);
      return session.status === 'active' ? session : null;
    },
    staleTime: 30_000,
    // A failed probe is «unknown», never «no partidă» (owner rule 4): one quiet retry, then nothing.
    retry: 1,
  };
}

/**
 * What the hub knows about the viewer: `pending` while the session or the probe is unanswered (the
 * per-user blocks show a skeleton or nothing), `guest`, or a viewer with their live partidă — null
 * when the CMS confirmed there is none, `failed` when it could not tell (treated like pending by the
 * hero: someone fishing right now must never be offered a new partidă instead of their dock).
 * Suspends on the session read: call it under <Suspense>.
 */
export type PartideViewer =
  | { kind: 'pending' }
  | { kind: 'guest' }
  | { kind: 'viewer'; uid: string; active: SessionDetailDTO | null | 'failed' | 'pending' };

export function usePartideViewer(): PartideViewer {
  const state = useViewerState();
  const user = userOf(state);
  const t = useMemo(() => createBrowserTransport(), []);
  const probe = useQuery({ ...activePartidaQuery(t, user?.documentId ?? ''), enabled: !!user });
  if (isUnknownViewer(state)) return { kind: 'pending' };
  if (!user) return { kind: 'guest' };
  const active = probe.data !== undefined ? probe.data : probe.isError ? 'failed' : 'pending';
  return { kind: 'viewer', uid: user.documentId, active };
}

/**
 * fish handleRefresh (parity partide.comunitate.c24): refetch the own-sessions list and the live
 * probe, and invalidate every community query (queryKeys.community.all). Resolves false when a read
 * failed (DashboardRefresh says so).
 */
export async function refreshPartideHub(qc: QueryClient, t: Transport, uid: string | null): Promise<boolean> {
  const own = uid
    ? [
        qc.fetchQuery({ ...partideHistoryQuery(t), staleTime: 0 }).then(
          () => true,
          () => false,
        ),
        qc.refetchQueries({ queryKey: activePartidaKey(uid) }).then(() => !qc.getQueryState(activePartidaKey(uid))?.error),
      ]
    : [];
  const community = qc.invalidateQueries({ queryKey: communityKeys.all }).then(() => {
    const states = qc.getQueryCache().findAll({ queryKey: communityKeys.all, type: 'active' });
    return states.every(q => q.state.status !== 'error');
  });
  const results = await Promise.all([...own, community]);
  return results.every(Boolean);
}
