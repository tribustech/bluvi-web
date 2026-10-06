'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { recentWeighingsQuery, type RecentWeighing } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { latestByCompetition } from './model';

/*
 * GET /feed/recent-weighings for the Live tab (core recentWeighingsQuery: public, polled on the
 * endpoint's 30s edge TTL; TanStack pauses the interval while the page is hidden and the observers
 * unmount with the tab). What changed since the previous answer is derived here: the weighings that
 * just arrived (they slide into the strip) and the competitions with a newer weighing (their card
 * flashes in place). The first answer marks nothing.
 */

export type RecentWeighings = {
  /** pending: the first read; error: hide (a CMS without the endpoint answers 404); ready: the items. */
  state: 'pending' | 'error' | 'ready';
  items: RecentWeighing[];
  /** Weighing ids new in the latest answer. */
  fresh: ReadonlySet<string>;
  /** competition id → its newest weighing id, only for competitions that got one in the latest answer. */
  flash: Readonly<Record<string, string>>;
};

const NONE: ReadonlySet<string> = new Set();

export function useRecentWeighings(t: Transport, enabled: boolean): RecentWeighings {
  const q = useQuery(recentWeighingsQuery(t, { enabled }));
  const items = q.data ?? [];
  const [seen, setSeen] = useState<{ at: number; ids: ReadonlySet<string>; latest: Record<string, string>; fresh: ReadonlySet<string>; flash: Record<string, string> }>({
    at: 0,
    ids: NONE,
    latest: {},
    fresh: NONE,
    flash: {},
  });
  // A new answer: compare it with the previous one (state from the previous render, React's
  // «storing information from previous renders» pattern — no effect, no extra paint).
  if (q.data && q.dataUpdatedAt !== seen.at) {
    const ids = new Set(items.map((w) => w.weighingDocumentId));
    const latest = latestByCompetition(items);
    const first = seen.at === 0;
    const fresh = first ? NONE : new Set([...ids].filter((id) => !seen.ids.has(id)));
    const flash = first ? {} : Object.fromEntries(Object.entries(latest).filter(([comp, id]) => seen.latest[comp] !== id));
    setSeen({ at: q.dataUpdatedAt, ids, latest, fresh, flash });
  }
  return {
    state: q.data ? 'ready' : q.isError ? 'error' : 'pending',
    items,
    fresh: seen.fresh,
    flash: seen.flash,
  };
}
