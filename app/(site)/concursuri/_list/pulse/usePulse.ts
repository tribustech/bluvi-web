'use client';

import { useCallback, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  competitionCardsInfiniteQuery,
  competitionCardsKeys,
  featuredCompetitionQuery,
  pickPulse,
  PULSE_CARD_PARAMS,
  pulseCountTile,
  pulseLists,
  pulseLiveKey,
  pulsePersonQuery,
  resolvePulseSlots,
  selectCompetitionCards,
  wantsFeaturedHero,
  type HeroPick,
  type Moment,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';

/*
 * fish features/competitions/helpers/useCompetitionsPulse.ts — the bento. The hero and the count
 * tile come from the SAME cached card lists the tabs use (PULSE_CARD_PARAMS.live is the Live tab's
 * own cache entry, which only the tab polls); the person reads /feed/pulse-person, and the hero
 * reads /feed/featured-competition only when it would otherwise be a discovery pick. The decisions
 * are core's (domain/pulse.ts); this hook holds the observers and the per-visit freeze.
 */

type Frozen = { hero: HeroPick | null; moment: Moment | null; liveKey: string };

export type Pulse = {
  hero: HeroPick | null;
  moment: Moment | null;
  liveCount: number;
  startingSoonCount: number;
  faces: string[];
  followedLiveCount: number;
  /**
   * The followed-live count is a real answer: signed out (nothing to follow), or the read settled.
   * Until then (or if it failed) the invite stays out — it would claim «you follow nothing live».
   */
  followedLiveKnown: boolean;
  /** Per block: the hero reveals on its own; person + count reveal together (fish PulseBento). */
  loading: { hero: boolean; person: boolean; count: boolean };
  /** Pull-to-refresh's bento leg: re-draw the person, the featured hero, re-pick from fresh lists. */
  refresh: () => Promise<void>;
};

export function usePulse(t: Transport, enabled: boolean, isAuthenticated: boolean): Pulse {
  const session = { isAuthenticated };
  const qc = useQueryClient();
  const live = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.live, session));
  const upcoming = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.upcoming, session));
  const completed = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.completed, session));
  // Per-user lists: disabled (and never requested) signed out.
  const mine = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.mine, session));
  const followedLive = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.followedLive, session));

  const liveSel = selectCompetitionCards(live.data, PULSE_CARD_PARAMS.live, session);
  const upcomingCards = selectCompetitionCards(upcoming.data, PULSE_CARD_PARAMS.upcoming, session).competitions;
  const completedCards = selectCompetitionCards(completed.data, PULSE_CARD_PARAMS.completed, session).competitions;
  const mineCards = selectCompetitionCards(mine.data, PULSE_CARD_PARAMS.mine, session).competitions;
  const followedLiveTotal = selectCompetitionCards(followedLive.data, PULSE_CARD_PARAMS.followedLive, session).total;

  // A list that failed counts as answered (empty): an outage must not hold the bento on skeletons.
  const ready = !live.isLoading && !upcoming.isLoading && !completed.isLoading && !mine.isLoading;

  // The visit's clock: re-read only when the pick is redone (fish `new Date()` inside the freeze).
  const [now, setNow] = useState(() => Date.now());
  const lists = useMemo(
    () => pulseLists({ live: liveSel.competitions, upcoming: upcomingCards, completed: completedCards, mine: mineCards }, now),
    [liveSel.competitions, upcomingCards, completedCards, mineCards, now],
  );

  /*
   * The local pick is frozen for the visit: picked once, re-picked only when the live set changes
   * (a competition going live or ending is not unrelated) or on refresh — never on unrelated
   * re-renders (parity pulse.c5). State, set during render (React's «adjust state on a prop
   * change» pattern), so the freeze is part of the render that needs it.
   */
  const liveKey = pulseLiveKey(lists.live);
  const [frozen, setFrozen] = useState<Frozen | null>(null);
  if (enabled && ready && (!frozen || frozen.liveKey !== liveKey)) {
    setFrozen({ ...pickPulse(lists, mineCards, new Date(now)), liveKey });
  }

  const wantsFeatured = wantsFeaturedHero({ enabled, ready, liveCount: lists.live.length, localHero: frozen?.hero ?? null });
  const featured = useQuery(featuredCompetitionQuery(t, wantsFeatured));
  const person = useQuery(pulsePersonQuery(t, enabled));

  const slots = resolvePulseSlots({ wantsFeatured, featured: featured.data, person: person.data, frozen });
  const tile = pulseCountTile(lists, now);

  const refetchPerson = person.refetch;
  const refetchFeatured = featured.refetch;
  const refresh = useCallback(async () => {
    // A pull re-draws the person (bypassing its 5 min freshness) and the featured hero — only when
    // featured is wanted: refetch() fetches a disabled query all the same (fish refreshFeatured).
    const draws = [refetchPerson(), ...(wantsFeatured ? [refetchFeatured()] : [])];
    // Every card list behind the bento, then the pick again from the fresh pages.
    await Promise.all([qc.invalidateQueries({ queryKey: competitionCardsKeys.root }), ...draws]);
    setNow(Date.now());
    setFrozen(null);
  }, [qc, refetchFeatured, refetchPerson, wantsFeatured]);

  const serverMoment = Boolean(person.data);
  // The hero is decided once: while a wanted featured draw is in flight the local pick is held back
  // (the bento shows the hero skeleton), so it is never painted and then swapped for the featured one.
  const heroPending = !ready || (wantsFeatured && featured.isLoading);
  return {
    hero: enabled && !heroPending ? slots.hero : null,
    moment: enabled ? slots.moment : null,
    liveCount: liveSel.counts?.started ?? lists.live.length,
    startingSoonCount: ready ? tile.startingSoonCount : 0,
    faces: ready ? tile.faces : [],
    followedLiveCount: followedLiveTotal,
    followedLiveKnown: !isAuthenticated || followedLive.isSuccess,
    loading: {
      // The hero is decided once: a wanted featured draw is waited for, so the local pick is never
      // painted and then swapped (a featured answer replaces it in fish; on the web it lands first).
      hero: heroPending,
      person: person.isLoading || (!serverMoment && !ready),
      // The invite sits with the tiles: its count reveals with them, never after (no late shift).
      count: live.isLoading || (isAuthenticated && followedLive.isLoading),
    },
    refresh,
  };
}
