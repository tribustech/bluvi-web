'use client';

import { useMemo } from 'react';
import { useInfiniteQuery, useQueries } from '@tanstack/react-query';
import { competitionCardsInfiniteQuery, competitionRegistrationsListQuery, rankingsQuery, selectCompetitionCards, type CompetitionCard } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import type { DesktopViewer } from '../desktop/data';
import { miniRanking, viewerRow, type MiniRanking } from '../desktop/model';
import { REGISTERED_PARAMS } from '../place';
import type { RawRanking } from './model';

/*
 * A finished competition's ranking, read only once its row is OPENED (never one ranking per row
 * of the page: the collapsed row stands on the card). A ranking already in the cache (the row was
 * opened before, or the competition page read it) shows without a request. `results: null` (the
 * card's snapshot is missing) is NOT «no catches»: its ranking is read like any other.
 *
 * Signed in, which rows are the viewer's comes from the per-user «Ale mele» list the page already
 * holds (GET /feed/my-competition-cards?scope=registered — same query, same cache, no request of
 * its own): those rows say «Înscris» closed. The viewer's place comes from the ranking once read —
 * by user id first; only when that finds nothing (a team or guest seat) and the viewer was
 * registered (or the list is not complete enough to say) are the competition's registrations read,
 * to find the row by the viewer's own registration.
 */

export type ResultRead =
  | { state: 'idle' }
  | { state: 'pending' }
  /** No catches, or the ranking failed: the panel stands on the card. */
  | { state: 'none' }
  | { state: 'ready'; raw: RawRanking; ranking: MiniRanking; mine: { position: number; value: number | null } | null };

export type ResultReads = {
  reads: Record<string, ResultRead>;
  /** Competitions the viewer was registered in (registered or pending) — «Înscris» on the row. */
  entered: ReadonlySet<string>;
};

const stamp = (qs: Array<{ dataUpdatedAt: number; status: string }>) => qs.map((q) => `${q.status}:${q.dataUpdatedAt}`).join('|');
/** The ranking is worth reading: catches, or a card that cannot say (results null). */
const rankable = (c: CompetitionCard) => c.results?.hasCatches !== false;

export function useResultReads(t: Transport, cards: CompetitionCard[], viewer: DesktopViewer, isAuthenticated: boolean, opened: ReadonlySet<string>): ResultReads {
  const signedIn = isAuthenticated && !!viewer;
  const registered = useInfiniteQuery({ ...competitionCardsInfiniteQuery(t, REGISTERED_PARAMS, { isAuthenticated: signedIn }), enabled: signedIn });
  const regList = selectCompetitionCards(registered.data, REGISTERED_PARAMS, { isAuthenticated: signedIn }).competitions;
  const enteredKey = regList.map((c) => c.documentId).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `enteredKey` stands for the list.
  const entered = useMemo(() => new Set(regList.map((c) => c.documentId)), [enteredKey]);
  // The list answers «not registered» only when every page is in.
  const complete = registered.isSuccess && !registered.hasNextPage;

  const rankings = useQueries({
    queries: cards.map((c) => ({ ...rankingsQuery(t, c.documentId, 'completed'), enabled: rankable(c) && opened.has(c.documentId) })),
  });
  const minis = rankings.map((q) => (q.data ? miniRanking(q.data) : null));
  const regs = useQueries({
    queries: cards.map((c, i) => {
      const mini = minis[i];
      const maybeMine = entered.has(c.documentId) || !complete;
      return {
        ...competitionRegistrationsListQuery(t, c.documentId),
        enabled: signedIn && opened.has(c.documentId) && !!mini && maybeMine && !viewerRow(mini.rows, viewer?.id),
      };
    }),
  });
  const key = `${cards.map((c) => `${c.documentId}:${opened.has(c.documentId) ? 1 : 0}`).join(',')}#${stamp(rankings)}#${stamp(regs)}#${viewer?.id ?? ''}`;
  const reads = useMemo(() => {
    const out: Record<string, ResultRead> = {};
    cards.forEach((c, i) => {
      const q = rankings[i];
      const ranking = minis[i];
      if (!rankable(c) || !q || (q.isError && !q.data)) {
        out[c.documentId] = { state: 'none' };
        return;
      }
      if (!q.data || !ranking) {
        out[c.documentId] = { state: opened.has(c.documentId) ? 'pending' : 'idle' };
        return;
      }
      const raw = q.data as RawRanking;
      const own = viewer ? regs[i]?.data?.find((r) => r.participants?.some((p) => p.id === viewer.id)) : undefined;
      const me = viewer ? viewerRow(ranking.rows, viewer.id, own?.documentId) : null;
      out[c.documentId] = { state: 'ready', raw, ranking, mine: me ? { position: me.position, value: me.catches > 0 ? me.value : null } : null };
    });
    return out;
    // `key` stands for every read's answer (the query results are new objects on each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { reads, entered };
}
