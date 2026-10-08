'use client';

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  dtoToLocalEvent,
  listItemToSummaryLocalSession,
  partidaDetailQuery,
  partideHistoryQuery,
  type LocalEvent,
  type LocalSession,
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { venueScope, venueSiblings } from './model';

export type VenueScopeState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void; retrying: boolean; attempt: number }
  | { status: 'ready'; patterns: ReturnType<typeof venueScope>; readCount: number };

/*
 * fish domain/hooks.ts usePatterns (c7) — the «Toate partidele» scope, computed on the client.
 * fish reads the sessions and events its live store holds; the web reads the viewer's own partide
 * (partideHistoryQuery = /feed/sessions/mine, the list fish's history uses), keeps the ones at
 * the same venue (scopeEvents' rule, 40 m anchor radius) and pulls the events of the most recent
 * VENUE_DETAIL_CAP of them with partidaDetailQuery, in parallel (/feed/sessions/:id — the detail
 * fish opens from its history; existing endpoints, no CMS change). This partidă's own events are
 * the ones the tab already holds (live when it is live).
 *
 * Nothing is read until the scope is chosen (`enabled`), and nothing is shown until every read has
 * landed (rule 4: a half-read venue would show wrong patterns, not partial ones). A failed read is
 * the error state with a retry of what failed.
 */
export function useVenueScope({
  enabled,
  documentId,
  session,
  events,
  now,
}: {
  enabled: boolean;
  documentId: string;
  session: LocalSession;
  events: LocalEvent[];
  now: number;
}): VenueScopeState {
  const t = useMemo(() => createBrowserTransport(), []);
  const list = useQuery({ ...partideHistoryQuery(t, { enabled }) });

  const siblings = useMemo(() => {
    if (!list.data) return null;
    return venueSiblings(list.data.data.map(listItemToSummaryLocalSession), session, documentId);
  }, [list.data, session, documentId]);

  const details = useQueries({
    queries: (siblings?.toRead ?? []).map(s => partidaDetailQuery(t, s.serverId!, { enabled })),
  });

  // `details` is a new array every render: its fetch stamps say when a result changed.
  const stamp = details.map(d => d.dataUpdatedAt).join(',');
  const detailEvents = useMemo(() => {
    if (!siblings || details.some(d => !d.data)) return null;
    return details.flatMap((d, i) => {
      const dto = d.data!;
      const roster = dto.members.map(m => m.uid);
      return dto.events.map(e => dtoToLocalEvent(e, siblings.toRead[i].clientId, roster));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stamp` stands for `details`
  }, [siblings, stamp]);

  const patterns = useMemo(
    () => (siblings && detailEvents ? venueScope(session, events, siblings.all, detailEvents, now) : null),
    [siblings, detailEvents, session, events, now],
  );

  const failed = [list, ...details].filter(q => q.isError && !q.data);
  if (failed.length) {
    return {
      status: 'error',
      retry: () => failed.forEach(q => void q.refetch()),
      retrying: failed.some(q => q.isFetching),
      attempt: Math.max(...failed.map(q => q.errorUpdateCount)),
    };
  }
  if (!patterns || !siblings) return { status: 'loading' };
  return { status: 'ready', patterns, readCount: siblings.toRead.length + 1 };
}
