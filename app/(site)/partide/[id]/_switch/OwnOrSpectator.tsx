'use client';

import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { communitySessionQuery, findMineDocument, partideHistoryQuery, type SessionListItemDTO } from '@/core/partide';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { useViewerState } from '../../../_shell/viewer-context';
import { isUnknownViewer, userOf } from '../../../_shell/viewer-state';
import { useLivePartide } from '../../_live';
import { MemberView } from '../_member/MemberView';
import { SpectatorSkeleton } from '../_spectator/SpectatorSkeleton';
import { SpectatorError } from '../_spectator/states';

/*
 * /partide/[id]: whose partidă is this? (parity partide.b.own-vs-spectator, partide.spectator.c1;
 * fish community/useOpenPartida.ts + comunitate/[id].tsx's own-live redirect). The member view
 * (partide.partida, ../_member) or the spectator view (../_spectator) on one URL.
 *
 *  - The static shell carries the spectator view when the server had a public partidă: it is the
 *    Suspense fallback, so the prerendered HTML holds the whole public page whoever opens it. When
 *    the server had none (`spectator` null: private, deleted or unknown) the fallback is the
 *    skeleton, never «not found» — the partidă may be the viewer's own private one (rule 4).
 *  - The viewer is read here (the session, as the chrome reads it — not the live layer's copy, which
 *    lags one effect behind): signed out → the spectator view, or `notFound`.
 *  - Signed in: the member view when the live layer's pointer (hydrated from GET
 *    /feed/sessions/active, ../_live) names this documentId, or when it is in the viewer's own list
 *    (GET /feed/sessions/mine, core partideHistoryQuery — fish's cached `mine` list). Meanwhile the
 *    spectator view stays on screen — unless its public read answered 404 (it would say «not
 *    found»): that, like a server not-found, keeps the skeleton until the live
 *    probe and the own list have both settled without a match — only then «not found». A failed
 *    own-list read over a server not-found is the error state with «Reîncearcă» (we do not know).
 *  - Session unknown (a cookie, but /users/me failed): the spectator view, or — nothing public to
 *    show — the error state with «Reîncearcă»: «not found» would be a guess.
 *  - Once the member view was chosen it stays for the page's lifetime (same viewer): deleting or
 *    leaving refetches the own list before the page navigates away, and the row disappearing must
 *    not swap in the spectator page of a partidă just deleted (fish stays on its screen until
 *    router.replace).
 *  - Private partide (the CMS's public 404, visibleOnProfile false) open for their members here
 *    from their own list: their member read is per-user (GET /feed/sessions/:id).
 */

type Props = {
  documentId: string;
  /** The spectator view, or null when the server's public read said 404 (`missing`). */
  spectator: ReactNode;
  notFound: ReactNode;
};

export function OwnOrSpectator(props: Props) {
  return (
    <Suspense fallback={props.spectator ?? <SpectatorSkeleton />}>
      <Resolve {...props} />
    </Suspense>
  );
}

type Latch = { documentId: string; uid: string; item: SessionListItemDTO | null };

function Resolve({ documentId, spectator, notFound }: Props) {
  const live = useLivePartide();
  const viewer = useViewerState();
  const unknown = isUnknownViewer(viewer);
  const uid = unknown ? undefined : (userOf(viewer)?.documentId ?? null);
  const signedIn = typeof uid === 'string';
  const t = useMemo(() => createBrowserTransport(), []);
  const mine = useQuery({ ...partideHistoryQuery(t, { enabled: signedIn }), retry: 1 });
  const liveCaughtUp = signedIn && live.uid === uid;
  // The spectator view's own public read (the same query — no second request): its 404 would say
  // «not found» while the membership is still being resolved.
  const community = useQuery({ ...communitySessionQuery(t, documentId), enabled: !!spectator });
  const publicGone = isApiError(community.error) && (community.error.status === 404 || community.error.status === 400);

  const item = signedIn ? findMineDocument(mine.data, documentId) : null;
  const isMember = signedIn && ((liveCaughtUp && live.state.active?.documentId === documentId) || !!item);

  // The member decision, latched (state adjusted during render): it also keeps the last list row.
  const [latch, setLatch] = useState<Latch | null>(null);
  if (isMember && (latch?.documentId !== documentId || latch.uid !== uid || (item && latch.item !== item))) {
    setLatch({ documentId, uid: uid as string, item: item ?? latch?.item ?? null });
  }
  const latched = latch && latch.documentId === documentId && latch.uid === uid ? latch : null;

  if (isMember) return <MemberView documentId={documentId} listItem={item ?? latched?.item ?? null} />;
  if (latched) return <MemberView documentId={documentId} listItem={latched.item} />;
  const settled = liveCaughtUp && live.ready && !mine.isPending;
  if (spectator && (!signedIn || settled || mine.isError || !publicGone)) return <>{spectator}</>;
  if (uid === null) return <>{notFound}</>;
  if (unknown) return <SpectatorError onRetry={() => window.location.reload()} retrying={false} />;
  if (mine.isError && !mine.isFetching) return <SpectatorError onRetry={() => void mine.refetch()} retrying={false} />;
  return settled ? <>{notFound}</> : <SpectatorSkeleton />;
}
