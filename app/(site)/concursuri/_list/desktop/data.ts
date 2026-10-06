'use client';

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  competitionKeys,
  competitionMyStatusQuery,
  competitionRegistrationsListQuery,
  competitionWeighingStatisticsQuery,
  getCompetitionCatches,
  rankingsQuery,
  type CompetitionCard,
  type CompetitionMyStatus,
  type Registration,
} from '@/core/competitions';
import { getAnglerFollowing } from '@/core/social';
import type { Transport } from '@/core/transport';
import { buildLive, cardFaces, facesOf, liveExtra, miniRanking, viewerRow, type Face, type LiveData, type MiniRanking } from './model';

/*
 * The desktop tab views' extra reads, per tab, through core/ (the competition page's own factories
 * and keys, so opening a competition after the list reuses them). Each read waits for `enabled`
 * (≥1024 and the tab on screen) and fails soft to «no data»: the slot hides (ROADMAP §4b.4).
 *  - Live: ranking + weighing log of every live competition, the heaviest catches of the hero only,
 *    re-read every 60s with the list (fish LIVE_POLL_MS; TanStack pauses it while the page is hidden).
 *  - Viitoare: the registrations (names + faces; the route is auth: required, so signed in only)
 *    and the anglers the viewer follows (ringed first, and the social-proof line).
 *  - Rezultate: a finished competition's ranking once its row is hovered, focused or opened
 *    (the winner's value, podium, places 4–8, my place).
 *  - Ale mele: the viewer's own status (/my-status), stand and final place (/registrations).
 */

/** fish LIVE_POLL_MS — the Live tab's list and its extras re-read together. */
export const LIVE_POLL_MS = 60_000;

/** Who is looking (the server's session read), for «tu», the followed faces and my stand. */
export type DesktopViewer = { id: number; documentId: string; username: string } | null;

/** A string that changes when any of the reads answered anew (memo key for the derived models). */
const stamp = (qs: Array<{ dataUpdatedAt: number; status: string }>) => qs.map((q) => `${q.status}:${q.dataUpdatedAt}`).join('|');

/* ---------------------------------------------------------------- live */

/** Where a read stands: still answering, failed (nothing to show), or answered. */
export type ReadState = 'pending' | 'error' | 'ready';
const stateOf = (q: { data: unknown; isError: boolean }): ReadState => (q.data ? 'ready' : q.isError ? 'error' : 'pending');

/**
 * The hub's reads. Every live competition: its ranking (top three, the hero's tower) and its
 * weighing log (the cross-competition ticker, the sparklines). The hero only: the heaviest catches
 * (the others' heaviest fish is their ranking's biggestCatch) — one ranking-engine read per
 * competition per minute, not three reads. Each ranking's state is kept so a slot can tell
 * «still reading» (bones) from «failed» (hidden) from «answered, nothing weighed».
 */
export function useLiveData(
  t: Transport,
  cards: CompetitionCard[],
  heroId: string | null,
  enabled: boolean,
): { live: LiveData; updatedAt: number | null; rankingState: Record<string, ReadState> } {
  const poll = { refetchInterval: LIVE_POLL_MS } as const;
  const rankings = useQueries({ queries: cards.map((c) => ({ ...rankingsQuery(t, c.documentId, 'started'), ...poll, enabled })) });
  const weighings = useQueries({
    queries: cards.map((c) => ({ ...competitionWeighingStatisticsQuery(t, c.documentId, 'started'), ...poll, enabled })),
  });
  const catches = useQueries({
    queries: cards.map((c) => ({
      queryKey: [...competitionKeys.byId(c.documentId), 'list-top-catches'] as const,
      queryFn: () => getCompetitionCatches(t, c.documentId, 'weight_desc', 1, 5),
      ...poll,
      enabled: enabled && c.documentId === heroId,
    })),
  });
  const key = `${cards.map((c) => c.documentId).join(',')}#${stamp(rankings)}#${stamp(weighings)}#${stamp(catches)}`;
  const { live, rankingState } = useMemo(() => {
    const extras: LiveData['extras'] = {};
    const states: Record<string, ReadState> = {};
    cards.forEach((c, i) => {
      const reads = { ranking: rankings[i]?.data ?? null, weighings: weighings[i]?.data ?? null, catches: catches[i]?.data ?? null };
      states[c.documentId] = rankings[i] ? stateOf(rankings[i]) : 'pending';
      if (reads.ranking || reads.weighings || reads.catches) extras[c.documentId] = liveExtra(c, reads);
    });
    return { live: buildLive(cards, extras), rankingState: states };
    // `key` stands for every read's answer (the query results are new objects on each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const updatedAt = Math.max(0, ...rankings.map((q) => q.dataUpdatedAt), ...weighings.map((q) => q.dataUpdatedAt));
  return { live, updatedAt: updatedAt || null, rankingState };
}

/* ---------------------------------------------------------------- upcoming */

export type PeopleOf = { faces: Face[]; followed: string[] };

export function useUpcomingPeople(t: Transport, cards: CompetitionCard[], viewer: DesktopViewer, enabled: boolean): Record<string, PeopleOf> {
  const signedIn = enabled && !!viewer;
  const following = useQuery({
    queryKey: ['anglers', viewer?.documentId ?? 'none', 'following', 'ids'] as const,
    queryFn: () => getAnglerFollowing(t, viewer!.documentId, { page: 1, pageSize: 100 }),
    enabled: signedIn,
    staleTime: 5 * 60_000,
  });
  const regs = useQueries({
    queries: cards.map((c) => ({ ...competitionRegistrationsListQuery(t, c.documentId), enabled: signedIn && c.joinedCount > 0 })),
  });
  const key = `${cards.map((c) => `${c.documentId}:${c.joinedCount}`).join(',')}#${following.dataUpdatedAt}#${stamp(regs)}`;
  return useMemo(() => {
    const followed = new Set((following.data?.data ?? []).map((a) => a.documentId));
    const out: Record<string, PeopleOf> = {};
    cards.forEach((c, i) => {
      const data = regs[i]?.data;
      const faces = c.joinedCount === 0 ? [] : data ? facesOf(data, followed) : cardFaces(c);
      out[c.documentId] = { faces, followed: faces.filter((f) => f.followed).map((f) => f.name) };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/* ---------------------------------------------------------------- results */

export type ResultDetail =
  | { state: 'idle' }
  | { state: 'pending' }
  | { state: 'none' }
  | { state: 'ready'; ranking: MiniRanking; mine: { position: number; value: number | null } | null };

/**
 * Each finished competition's ranking, read on intent only (the row hovered, focused or opened —
 * `wanted`), never one ranking per row of the page: the collapsed row stands on the card. A ranking
 * already in the cache (the competition page read it) shows without a request. Signed in, an
 * opened row also reads the registrations, to find the viewer's own row by registration.
 */
export function useResultDetails(
  t: Transport,
  cards: CompetitionCard[],
  viewer: DesktopViewer,
  enabled: boolean,
  wanted: ReadonlySet<string>,
): Record<string, ResultDetail> {
  const qs = useQueries({
    queries: cards.map((c) => ({ ...rankingsQuery(t, c.documentId, 'completed'), enabled: enabled && !!c.results?.hasCatches && wanted.has(c.documentId) })),
  });
  const regs = useQueries({
    queries: cards.map((c) => ({
      ...competitionRegistrationsListQuery(t, c.documentId),
      enabled: enabled && !!viewer && !!c.results?.hasCatches && wanted.has(c.documentId),
    })),
  });
  const key = `${cards.map((c) => `${c.documentId}:${wanted.has(c.documentId) ? 1 : 0}`).join(',')}#${stamp(qs)}#${stamp(regs)}#${viewer?.id ?? ''}`;
  return useMemo(() => {
    const out: Record<string, ResultDetail> = {};
    cards.forEach((c, i) => {
      const q = qs[i];
      if (!c.results?.hasCatches || !q || (q.isError && !q.data)) {
        out[c.documentId] = { state: 'none' };
        return;
      }
      if (!q.data) {
        out[c.documentId] = { state: wanted.has(c.documentId) ? 'pending' : 'idle' };
        return;
      }
      const avatars = new Map<string, string>();
      for (const p of c.results.podium) if (p.avatarUrls[0]) avatars.set(p.displayName, p.avatarUrls[0]);
      const ranking = miniRanking(q.data, avatars);
      const own = viewer ? regs[i]?.data?.find((r) => r.participants?.some((p) => p.id === viewer.id)) : undefined;
      const me = viewer ? viewerRow(ranking.rows, viewer.id, own?.documentId) : null;
      out[c.documentId] = {
        state: 'ready',
        ranking: { ...ranking, rows: ranking.rows.slice(0, 8) },
        mine: me ? { position: me.position, value: me.catches > 0 ? me.value : null } : null,
      };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/* ---------------------------------------------------------------- mine */

export type MineState = {
  status: CompetitionMyStatus['userRegistrationStatus'] | undefined;
  stand: string | null;
  known: boolean;
  /** Finished: my final place, from MY registration (never matched by name); undefined while it reads. */
  place?: number | null;
};

export function useMineStates(t: Transport, cards: CompetitionCard[], viewer: DesktopViewer, enabled: boolean): Record<string, MineState> {
  const statuses = useQueries({ queries: cards.map((c) => ({ ...competitionMyStatusQuery(t, c.documentId, { isAuthenticated: true }), enabled })) });
  const regs = useQueries({
    queries: cards.map((c) => ({ ...competitionRegistrationsListQuery(t, c.documentId), enabled: enabled && !!viewer })),
  });
  // Finished: my place in the ranking, found by my registration (the list of my own competitions is short).
  const rankings = useQueries({
    queries: cards.map((c) => ({ ...rankingsQuery(t, c.documentId, 'completed'), enabled: enabled && !!viewer && c.status === 'completed' && !!c.results?.hasCatches })),
  });
  const key = `${cards.map((c) => c.documentId).join(',')}#${stamp(statuses)}#${stamp(regs)}#${stamp(rankings)}#${viewer?.id ?? ''}`;
  return useMemo(() => {
    const out: Record<string, MineState> = {};
    cards.forEach((c, i) => {
      const s = statuses[i];
      const own = viewer ? regs[i]?.data?.find((r) => r.participants?.some((p) => p.id === viewer.id)) : undefined;
      const r = regs[i];
      out[c.documentId] = {
        status: s?.data ? s.data.userRegistrationStatus : undefined,
        stand: own?.stand?.name ?? null,
        known: !!s && !s.isPending,
        place: finishedPlace(c, viewer, own, r, rankings[i]),
      };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

type Read<T> = { data?: T; isError: boolean } | undefined;

/** My final place: my registration's finalPlacement, else my row in the ranking (by identity). */
function finishedPlace(
  c: CompetitionCard,
  viewer: DesktopViewer,
  own: Registration | undefined,
  regs: Read<Registration[]>,
  ranking: Read<{ rankings: unknown[]; metadata: unknown }>,
): number | null | undefined {
  if (c.status !== 'completed' || !viewer) return null;
  if (!regs || (regs.isError && !regs.data)) return null;
  if (!regs.data) return undefined;
  if (own?.finalPlacement) return own.finalPlacement;
  if (!c.results?.hasCatches || !ranking || (ranking.isError && !ranking.data)) return null;
  if (!ranking.data) return undefined;
  return viewerRow(miniRanking(ranking.data).rows, viewer.id, own?.documentId)?.position ?? null;
}
