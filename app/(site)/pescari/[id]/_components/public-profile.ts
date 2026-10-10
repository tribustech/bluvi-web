import 'server-only';
import { cache } from 'react';
import { cacheLife, cacheTag } from 'next/cache';
import { anglerPublicProfileSchema, getAnglerPublicProfile, isAnglerNotFound, type AnglerPublicProfile } from '@/core/social';
import { isPlaceholderId } from '@/lib/server/public-get';
import { createServerTransport } from '@/lib/server/transport';
import { e2ePublicStub } from './e2e-faults';

/*
 * The angler's PUBLIC header (GET /feed/anglers/:id/public — auth: false, CDN 300s, X-Cache-Tag
 * angler-<id>; CMS PR #113), read on the server through cachedPublicGet (cached under the CMS's own
 * headers, purged by its tag — profile edits, follow / unfollow). It is what makes /pescari/[id]
 * indexable: the name for the title, the JSON-LD, the OG card, the sitemap and the header in the HTML.
 *
 *  - `ok`: the header — the page is `index, follow`;
 *  - `missing`: 404 ANGLER:NOT_FOUND (unknown or blocked) → notFound();
 *  - `unavailable`: a CMS from before PR #113 (a bare 404: no such route), a slow or failed read —
 *    the page keeps its pre-#113 behaviour (noindex, the sign-in hint signed out).
 *
 * Every outcome is one cached value (readAnglerPublic, `'use cache'`), so the page stays static /
 * ISR whatever the CMS answers: the header lives as the CMS's own headers say (the inner public
 * GET's cacheLife + tags), «not found» and «not available» for `minutes` (revalidated after a
 * minute, gone within the hour, the lifetime's explicit cacheLife overriding the inner error
 * answer's `seconds`), all under `angler-<id>`, so a purge of the angler clears them too. Never
 * `seconds`: an expire under 5 minutes is a dynamic hole, and the page rendered per request.
 */

const READ_MS = 4000;

export type AnglerPublicLoad = { kind: 'ok'; profile: AnglerPublicProfile } | { kind: 'missing' } | { kind: 'unavailable' };

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`public header: over ${ms}ms`)), ms)));
  return Promise.race([p, expired]).finally(() => clearTimeout(timer));
}

/** One read per request for the metadata and the page (React `cache`), cached across requests. */
export const loadAnglerPublic = cache(async (id: string): Promise<AnglerPublicLoad> => {
  const stub = e2ePublicStub(id);
  if (stub) {
    if (stub.kind !== 'ok') return { kind: stub.kind };
    return { kind: 'ok', profile: anglerPublicProfileSchema.parse(stub.profile) };
  }
  // generateStaticParams' `_`: nothing to read, nothing to cache.
  if (isPlaceholderId(id)) return { kind: 'unavailable' };
  return readAnglerPublic(id);
});

/** Never throws (an error thrown out of `'use cache'` is redacted in production): the outcome is the value. */
async function readAnglerPublic(id: string): Promise<AnglerPublicLoad> {
  'use cache';
  cacheTag(`angler-${id}`);
  try {
    // The header: no explicit cacheLife — the inner public GET's (the CMS's max-age) is the lifetime.
    return { kind: 'ok', profile: await within(getAnglerPublicProfile(createServerTransport(), id), READ_MS) };
  } catch (e) {
    cacheLife('minutes');
    return isAnglerNotFound(e) ? { kind: 'missing' } : { kind: 'unavailable' };
  }
}
