import 'server-only';
import type { DehydratedState } from '@tanstack/react-query';
import { communityKeys, sessionCatchesInfiniteQuery, type CommunitySessionDetailDTO, type SessionCatchesPage } from '@/core/partide';
import type { Transport, TransportRequest } from '@/core/transport';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';
import type { SessionLoad } from '../../_spectator/load';

/*
 * The server half of /partide/[id]/capturi (parity partide.spectator-capturi): the partidă itself
 * (../../_spectator/load.ts, the SAME cached read as the partidă page) and the FIRST page of its
 * catches — GET /feed/community/sessions/:documentId/catches (auth: false), a cached public read
 * (lib/server/public-get.ts) under the CMS's own TTL (60 s live / 24 h ended) and its tag
 * `session-<documentId>`. Both are handed to the browser's queries (HydrationBoundary): the first
 * 20 rows are in the HTML, the next pages load on scroll.
 *
 * The catches read is bounded (READ_BUDGET_MS) and runs beside the partidă's (same budget), so a
 * slow CMS holds the page for one budget, never two: the browser then reads it itself and shows its
 * own skeleton / error. A failed read is never baked into the static output (page.tsx `connection()`).
 */

const READ_BUDGET_MS = 4000;

function bounded(t: Transport): Transport {
  return {
    request<T>(req: TransportRequest) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${req.path}: CMS read over ${READ_BUDGET_MS}ms`)), READ_BUDGET_MS);
      });
      return Promise.race([t.request<T>(req), timeout]).finally(() => clearTimeout(timer));
    },
  };
}

export type CatchesPrefetch = { state: DehydratedState; firstPage: SessionCatchesPage | null; read: boolean };

/**
 * The first catches page, read AT THE SAME TIME as the partidă (the catches never wait for it: one
 * read budget, not two in a row), dehydrated with the partidă once it is known. `session` is the
 * partidă's own pending read (../../_spectator/load.ts); a partidă that did not load is not seeded.
 * `read` false = the catches read failed: the page must then not be baked static (`connection()`,
 * which the page calls only when it renders the list).
 */
export async function prefetchCatches(id: string, session: Promise<SessionLoad>): Promise<CatchesPrefetch> {
  const query = sessionCatchesInfiniteQuery(bounded(createServerTransport()), id);
  const read = query.queryFn as (ctx: unknown) => Promise<SessionCatchesPage>;
  // Settles with the catches, or as soon as the partidă turns out missing / unread (the page then
  // shows no list): the page never waits on a catches read it will drop.
  const catches = {
    ...query,
    queryFn: (ctx: unknown) =>
      new Promise<SessionCatchesPage>((resolve, reject) => {
        read(ctx).then(resolve, reject);
        void session.then(l => {
          if (l.kind !== 'ok') reject(new Error('partidă not loaded'));
        });
      }),
  };
  const detail = {
    queryKey: communityKeys.session(id),
    queryFn: async (): Promise<CommunitySessionDetailDTO> => {
      const load = await session;
      if (load.kind !== 'ok') throw new Error('partidă not loaded');
      return load.detail;
    },
  };
  const state = await prefetchState([detail, catches], [`session-${id}`]);
  const found = state.queries.find(q => JSON.stringify(q.queryKey) === JSON.stringify(catches.queryKey));
  const firstPage = (found?.state.data as { pages?: SessionCatchesPage[] } | undefined)?.pages?.[0] ?? null;
  return { state, firstPage, read: !!found };
}
