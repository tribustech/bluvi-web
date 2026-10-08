'use client';

import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { competitionCardsInfiniteQuery, PULSE_CARD_PARAMS, selectCompetitionCards } from '@/core/competitions';
import { createPulseTracker } from '../analytics';
import { PosterGridSkeleton } from '../cards/PosterCard';
import { REGISTERED_PARAMS } from '../place';
import { LiveBand } from '../upcoming/LiveBand';
import { Spotlight } from '../upcoming/Spotlight';
import { UPCOMING_TOP } from '../upcoming/SpotlightSkeleton';
import { UpcomingGroups } from '../upcoming/UpcomingGroups';
import type { TabModule, TabViewProps } from './types';

/*
 * Viitoare (/concursuri/viitoare) — the tab's content (contract: ./types.ts), the prototype's
 * Viitoare (app/dev/hub Upcoming.tsx; owner, 2026-10-07):
 *  - Top: «N concursuri live acum» (only when something is live → /concursuri/live), then
 *    «În lumina reflectoarelor» (/feed/pulse-person?limit=6). They replace fish's pulse bento
 *    (hero stack, person, count tile, invite): the band is the count, the spotlight the person;
 *    no «Momente cheie» (owner). Shown on «Urmărite» too: neither is about what the viewer follows;
 *  - Body: the poster cards grouped on the time axis (../upcoming/UpcomingGroups).
 * Analytics keep fish's names: the band is the count tile's press, a spotlight tile the moment's.
 */

function Top({ t, isAuthenticated }: TabViewProps) {
  const session = { isAuthenticated };
  // The Live tab's own first page (the same cache entry the page prefetches and the tabs read).
  const live = useInfiniteQuery(competitionCardsInfiniteQuery(t, PULSE_CARD_PARAMS.live, session));
  const liveSel = selectCompetitionCards(live.data, PULSE_CARD_PARAMS.live, session);
  const liveCount = liveSel.counts?.started ?? liveSel.competitions.length;
  // One tracker per visit (fish createPulseTracker).
  const [tracker] = useState(() => createPulseTracker());
  return (
    <div className={UPCOMING_TOP}>
      {live.isSuccess ? <LiveBand count={liveCount} cards={liveSel.competitions} onPress={() => tracker.countTilePress({ live: liveCount })} /> : null}
      <Spotlight
        t={t}
        isAuthenticated={isAuthenticated}
        onPress={(p) => tracker.momentPress({ competitionId: p.destination.documentId, kicker: p.kicker })}
      />
    </div>
  );
}

/** How long the list waits for an unanswered registrations read before it shows start order. */
const MINE_WAIT_MS = 2500;
const NO_MINE: ReadonlySet<string> = new Set();

function Body({ cards, priorityCount, t, isAuthenticated }: TabViewProps) {
  const session = { isAuthenticated };
  /*
   * The viewer's registrations lead their group (stable order: mine first, then start time). The
   * read is the page's «Ale mele» one — per-user, disabled signed out, prefetched with the session
   * (../CompetitionsRoute), so it has normally answered before the first paint. When it has not
   * (no session in time, a refresh), the groups wait for it rather than paint in start order and
   * then move the viewer's card to the front: bones until it settles, at most MINE_WAIT_MS — past
   * that the start order stays for the visit (a late answer never re-sorts under the reader).
   * Only the first page of registrations (REGISTERED_PARAMS, every status) is considered: a viewer
   * with more registrations than a page holds sees the rest in plain start order.
   */
  const registered = useInfiniteQuery(competitionCardsInfiniteQuery(t, REGISTERED_PARAMS, session));
  const waiting = isAuthenticated && registered.isLoading;
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => setGaveUp(true), MINE_WAIT_MS);
    return () => clearTimeout(id);
  }, [waiting]);
  const mine = useMemo(
    () =>
      gaveUp
        ? NO_MINE
        : new Set(selectCompetitionCards(registered.data, REGISTERED_PARAMS, { isAuthenticated }).competitions.map((c) => c.documentId)),
    [registered.data, isAuthenticated, gaveUp],
  );
  if (waiting && !gaveUp) return <PosterGridSkeleton />;
  return <UpcomingGroups cards={cards} mine={mine} priorityCount={priorityCount} />;
}

export const upcomingTab: TabModule = { Top, Body, Skeleton: () => <PosterGridSkeleton /> };
