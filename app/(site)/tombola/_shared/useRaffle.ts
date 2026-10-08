'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deriveRaffleState, raffleActiveQuery, raffleParticipationQuery, type RaffleState } from '@/core/organizer';
import { createBrowserTransport } from '@/lib/client/transport';

/**
 * The CMS's media origin for relative upload URLs (fish resolveMediaUrl reads EXPO_PUBLIC_API_URL;
 * core takes it as `mediaOrigin`). S3 URLs are absolute and pass through.
 */
export const RAFFLE_MEDIA_ORIGIN: string | undefined = (() => {
  const url = process.env.NEXT_PUBLIC_CMS_URL;
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
})();

/**
 * fish hooks/useRaffle.ts for the web (participant.b.raffle-data): the active session (GET
 * /raffle-sessions/active, public, 404 → none) and the viewer's participation (GET
 * /raffle-sessions/participation, only signed in with a session; 401 → none), both stale after
 * 2 minutes (core), derived by core deriveRaffleState with the locally picked type.
 *
 * Both reads go through the same-origin /api/cms proxy (`direct: false`): the participation is per
 * user anyway, and one origin for the pair means one place to stub them in e2e
 * (tests/e2e/helpers/fake-raffle.ts).
 *
 * `status`: 'pending' until everything the page decides on is known (the session, and when there is
 * one and the viewer is signed in, the participation); 'error' when either read failed — the caller
 * shows no join form then (owner rule 4: never «not joined» for «we could not check»).
 */
export function useRaffle({ signedIn = true }: { signedIn?: boolean } = {}) {
  const t = useMemo(() => createBrowserTransport({ direct: false }), []);
  const active = useQuery(raffleActiveQuery(t, { mediaOrigin: RAFFLE_MEDIA_ORIGIN }));
  const hasActiveSession = Boolean(active.data?.session);
  const participation = useQuery(
    raffleParticipationQuery(t, { isAuthenticated: signedIn, hasActiveSession, mediaOrigin: RAFFLE_MEDIA_ORIGIN }),
  );
  const [localSelectedTypeKey, setSelectedTypeKey] = useState<string | null>(null);

  const state: RaffleState = useMemo(
    () => deriveRaffleState(active.data, participation.data, localSelectedTypeKey),
    [active.data, participation.data, localSelectedTypeKey],
  );

  const needsParticipation = signedIn && hasActiveSession;
  const status: 'pending' | 'error' | 'ready' =
    active.isError || (needsParticipation && participation.isError)
      ? 'error'
      : active.isPending || (needsParticipation && participation.isPending)
        ? 'pending'
        : 'ready';
  /**
   * Everything the page decides on has loaded at least once. With it, an 'error' status is a failed
   * background refetch over data already known (TanStack v5 keeps `data` and sets status 'error'):
   * keep showing it and say the refresh failed, instead of trading it for the retry gate.
   */
  const hasData = active.data !== undefined && (!needsParticipation || participation.data !== undefined);

  const retry = () => {
    if (active.isError) void active.refetch();
    if (participation.isError) void participation.refetch();
  };

  return {
    transport: t,
    state,
    status,
    hasData,
    error: active.error ?? participation.error,
    retrying: active.isFetching || participation.isFetching,
    retry,
    setSelectedTypeKey,
  };
}

/** fish raffle/index.tsx:116-125 — where the intro sends the viewer instead of showing itself. */
export type RaffleIntroRedirect = 'home' | 'winners' | null;

export function introRedirect(state: Pick<RaffleState, 'joined' | 'sessionDocumentId' | 'isEnded' | 'hasWinners'>): RaffleIntroRedirect {
  if (state.joined) return 'home';
  if (!state.sessionDocumentId || state.isEnded) return state.isEnded && state.hasWinners ? 'winners' : 'home';
  return null;
}
