import 'server-only';
import { connection } from 'next/server';
import type { DehydratedState } from '@tanstack/react-query';
import { anglerCatchesInfiniteQuery, anglerCompetitionsInfiniteQuery, anglerSessionsInfiniteQuery } from '@/core/social';
import type { Transport, TransportRequest } from '@/core/transport';
import type { ProfileTab } from '@/components/account/angler/tabs';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';

/*
 * The selected tab's first page, read on the server for the HTML (parity account.angler-profile
 * c16–c18, c22, c27). The three tab lists are PUBLIC CMS reads (auth: false, CDN 60s, X-Cache-Tag
 * angler-<id>): the server transport serves them through cachedPublicGet (lib/server/public-get.ts),
 * cached under the CMS's own headers and purged by its tag. The client screen takes over the SAME
 * core query (HydrationBoundary), so the selected tab never fetches again on load; the other tabs
 * load in the browser when picked. The read is bounded: a hung CMS never holds the page — the
 * browser's query then shows its own loading / error state, and a failed read is never baked into
 * static output (`await connection()`).
 */

const READ_BUDGET_MS = 4000;

function bounded(t: Transport): Transport {
  return {
    async request<T>(req: TransportRequest) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${req.path}: CMS read over ${READ_BUDGET_MS}ms`)), READ_BUDGET_MS);
      });
      try {
        return await Promise.race([t.request<T>(req), timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export async function prefetchProfileTab(documentId: string, tab: ProfileTab): Promise<DehydratedState> {
  const t = bounded(createServerTransport());
  const query =
    tab === 'capturi'
      ? anglerCatchesInfiniteQuery(t, documentId)
      : tab === 'sesiuni'
        ? anglerSessionsInfiniteQuery(t, documentId)
        : anglerCompetitionsInfiniteQuery(t, documentId);
  const state = await prefetchState([query], [`angler-${documentId}`]);
  if (state.queries.length === 0) await connection();
  return state;
}
