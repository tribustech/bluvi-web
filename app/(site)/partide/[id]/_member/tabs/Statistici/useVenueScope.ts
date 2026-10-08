'use client';

import { useEffect, useMemo } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dtoToLocalEvent,
  listItemToSummaryLocalSession,
  partidaDetailQuery,
  partideHistoryQuery,
  partideKeys,
  type LocalEvent,
  type LocalSession,
} from '@/core/partide';
import { isApiError } from '@/core/transport';
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
 * the error state; its retry repeats what failed and reads the list again (a stale list may be
 * the cause). A sibling whose detail answers 404 is gone (deleted, or a co-op its host deleted
 * while the list was still fresh): it leaves the scope instead of failing it, and the list is read
 * again so the next most recent partidă takes its place.
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

  // `details` is a new array every render: its fetch and error stamps say when a result changed.
  const stamp = details.map(d => `${d.dataUpdatedAt}:${d.errorUpdatedAt}`).join(',');
  // The siblings whose detail is gone (404 — not retried, see lib/client/query-client.ts).
  const gone = useMemo(() => {
    const ids = new Set<string>();
    details.forEach((d, i) => {
      if (!d.data && d.isError && isApiError(d.error) && d.error.status === 404) ids.add(siblings!.toRead[i].serverId!);
    });
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stamp` stands for `details`
  }, [siblings, stamp]);
  const goneKey = [...gone].sort().join(',');

  const qc = useQueryClient();
  useEffect(() => {
    if (goneKey) void qc.invalidateQueries({ queryKey: partideKeys.mine, exact: true });
  }, [goneKey, qc]);

  const scope = useMemo(() => {
    if (!siblings) return null;
    const keep = (s: LocalSession) => !gone.has(s.serverId!);
    const read = details.filter((_, i) => keep(siblings.toRead[i]));
    if (read.some(d => !d.data)) return null;
    const toRead = siblings.toRead.filter(keep);
    const events = read.flatMap((d, i) => {
      const dto = d.data!;
      const roster = dto.members.map(m => m.uid);
      return dto.events.map(e => dtoToLocalEvent(e, toRead[i].clientId, roster));
    });
    return { all: siblings.all.filter(keep), toRead, events };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stamp` stands for `details`
  }, [siblings, gone, stamp]);

  const patterns = useMemo(
    () => (scope ? venueScope(session, events, scope.all, scope.events, now) : null),
    [scope, session, events, now],
  );

  const failed = [list, ...details.filter((_, i) => !gone.has(siblings!.toRead[i].serverId!))].filter(q => q.isError && !q.data);
  if (failed.length) {
    return {
      status: 'error',
      // The list too: a stale list may name what can no longer be read.
      retry: () => [list, ...failed.filter(q => q !== list)].forEach(q => void q.refetch()),
      retrying: failed.some(q => q.isFetching) || list.isFetching,
      attempt: Math.max(...failed.map(q => q.errorUpdateCount)),
    };
  }
  if (!patterns || !scope) return { status: 'loading' };
  return { status: 'ready', patterns, readCount: scope.toRead.length + 1 };
}
