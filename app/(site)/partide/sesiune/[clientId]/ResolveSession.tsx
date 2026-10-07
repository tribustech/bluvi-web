'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { findMineListItem, partideHistoryQuery } from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useViewerState } from '../../../_shell/viewer-context';
import { isUnknownViewer, userOf } from '../../../_shell/viewer-state';
import { useLivePartide } from '../../_live';
import { SpectatorSkeleton } from '../../[id]/_spectator/SpectatorSkeleton';
import { SpectatorError } from '../../[id]/_spectator/states';

/** Past this, a resolution that has neither a destination nor an error is shown as the error card. */
const STALL_MS = 20_000;

/*
 * The client id → the partidă page (partide.b.notif-finished-autoclose). In order, as fish resolves
 * its /(app)/partide/[id] param (useLiveMount's pointer, then usePartidaDetail's `mine` lookup):
 *  1. the live pointer (hydrated by the Partide layer from storage, then GET /feed/sessions/active)
 *     names this session → its documentId;
 *  2. the viewer's own list (GET /feed/sessions/mine, core partideHistoryQuery — the same cache the
 *     partidă page reads next) has a row with this clientId → its documentId;
 *  3. neither, once the probe settled AND the list LOADED without a match → «Ale mele».
 * `replace`, so Back skips this hop. The partidă page then picks the member view itself
 * (OwnOrSpectator: the same pointer and the same cached list).
 *
 * Terminal states — never a skeleton that never ends, never a guess (owner rule 4, as the partidă
 * page's own b.own-vs-spectator): a failed own list keeps the URL and shows the partidă page's
 * «Nu am putut încărca partida.» + «Reîncearcă» (refetches the list); an unknown session, or a
 * resolution still pending after STALL_MS, shows the same card whose «Reîncearcă» reloads the page
 * (a fresh session read, probe and list); signed out under us → sign-in, returning here.
 */
export function ResolveSession({ clientId }: { clientId: string }) {
  const router = useRouter();
  const live = useLivePartide();
  const viewer = useViewerState();
  const unknown = isUnknownViewer(viewer);
  const uid = unknown ? undefined : (userOf(viewer)?.documentId ?? null);
  const signedIn = typeof uid === 'string';
  const t = useMemo(() => createBrowserTransport(), []);
  const mine = useQuery({ ...partideHistoryQuery(t, { enabled: signedIn }), retry: 1 });
  const done = useRef(false);

  const liveReady = signedIn && live.uid === uid && live.ready;
  const pointer = live.state.active?.sessionId === clientId ? live.state.active.documentId : null;
  const listed = findMineListItem(mine.data, clientId)?.documentId ?? null;
  const documentId = pointer ?? listed;
  const href =
    uid === null
      ? routes.signIn(routes.partidaSession(clientId))
      : documentId
        ? routes.partida(documentId)
        : liveReady && mine.isSuccess
          ? routes.partideMine()
          : null;

  useEffect(() => {
    if (!href || done.current) return;
    done.current = true;
    router.replace(href);
  }, [href, router]);

  // A resolution that neither lands nor fails (e.g. the probe never answers): the error card.
  const waiting = signedIn && !href && !mine.isError;
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!waiting) return undefined;
    const id = setTimeout(() => setStalled(true), STALL_MS);
    return () => clearTimeout(id);
  }, [waiting]);

  if (!href && (unknown || (waiting && stalled))) return <SpectatorError onRetry={() => window.location.reload()} retrying={false} />;
  if (!href && mine.isError) return <SpectatorError onRetry={() => void mine.refetch()} retrying={mine.isFetching} />;
  return (
    <div data-testid="partida-session-resolver">
      <SpectatorSkeleton />
    </div>
  );
}
