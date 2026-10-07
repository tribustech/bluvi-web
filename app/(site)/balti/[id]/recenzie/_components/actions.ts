'use server';

import { updateTag } from 'next/cache';
import { getSessionToken } from '@/lib/server/session';

/*
 * Read-your-own-writes after a review add / edit / delete (parity lakes.b.review-invalidation,
 * lakes.review-form.c9; fish features/reviews/mutations.ts invalidates lakes.byId so the lake's
 * rating updates at once). The lake page (rating, «N recenzii», the latest reviews) is static,
 * built from the cached public reads tagged `lake-<id>` (lib/server/public-get.ts). The CMS purge
 * of that tag reaches /api/revalidate batched and stale-while-revalidate, so without this the
 * author would still see the old rating. updateTag expires the tag now: the next request renders
 * the lake from fresh reads. Signed-in callers only (the form is), so the action cannot be used to
 * churn the cache anonymously; an id that is not a CMS documentId is ignored.
 */

const DOCUMENT_ID = /^[a-z0-9]{1,64}$/i;

/**
 * The CMS's own purge of the edge copy (Cloudflare) lands ~0.65s after the write (a 250ms coalescing
 * window, then ~0.4s for the tag purge — fir-intins-cms cache-purge-queue.ts). The fresh read that
 * updateTag forces (this action re-renders the current page at once) must come after it, or it
 * would cache the edge's stale copy again — and, on /recenzii, hydrate it over the list the client
 * has just corrected.
 */
const EDGE_PURGE_SETTLE_MS = 1000;

export async function refreshLakeAfterReview(lakeId: string): Promise<void> {
  if (typeof lakeId !== 'string' || !DOCUMENT_ID.test(lakeId)) return;
  if (!(await getSessionToken())) return;
  await new Promise(resolve => setTimeout(resolve, EDGE_PURGE_SETTLE_MS));
  updateTag(`lake-${lakeId}`);
}
