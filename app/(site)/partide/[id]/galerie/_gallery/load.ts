import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import type { DehydratedState } from '@tanstack/react-query';
import { communityKeys, sessionCatchesInfiniteQuery, type SessionCatchesPage } from '@/core/partide';
import { prefetchState } from '@/lib/client/hydration';
import { createServerTransport } from '@/lib/server/transport';
import { loadCommunitySession, type SessionLoad } from '../../_spectator/load';
import { GALLERY_QUERY } from './view';

/*
 * The gallery's server reads — both cached public CMS GETs (lib/server/public-get.ts) under the
 * partidă's tag `session-<documentId>`:
 *  - the partidă (the spectator page's own read, ../../_spectator/load.ts — so a private / unknown
 *    partidă is `missing` here too, and an `e2e-` id is never read on the server in development);
 *  - the first page of photos (core sessionCatchesInfiniteQuery, 30 photos, `photos=1`), only when
 *    the partidă was read: a private partidă's photos are never asked for.
 * Both go to the browser's queries (HydrationBoundary), so the static HTML holds the header and the
 * first 30 tiles; a read that failed here is read again in the browser.
 */

export type GalleryLoad = { session: SessionLoad; state: DehydratedState; firstPage: SessionCatchesPage | null };

export const loadGallery = cache(async (id: string): Promise<GalleryLoad> => {
  const session = await loadCommunitySession(id);
  if (session.kind !== 'ok') return { session, state: { mutations: [], queries: [] }, firstPage: null };
  const photos = sessionCatchesInfiniteQuery(createServerTransport(), id, GALLERY_QUERY);
  const state = await prefetchState(
    [{ queryKey: communityKeys.session(id), queryFn: async () => session.detail }, photos],
    [`session-${id}`],
  );
  const cached = state.queries.find(q => JSON.stringify(q.queryKey) === JSON.stringify(photos.queryKey));
  const firstPage = (cached?.state.data as { pages?: SessionCatchesPage[] } | undefined)?.pages?.[0] ?? null;
  // A failed photos read is never baked into the static output: the browser reads it again.
  if (!firstPage) await connection();
  return { session, state, firstPage };
});
