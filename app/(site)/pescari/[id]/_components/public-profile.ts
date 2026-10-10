import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
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
 *    the page keeps its pre-#113 behaviour (noindex, the sign-in hint signed out), and a failure
 *    is never baked into static output (`await connection()`), so it is read again per request.
 */

const READ_MS = 4000;

export type AnglerPublicLoad = { kind: 'ok'; profile: AnglerPublicProfile } | { kind: 'missing' } | { kind: 'unavailable' };

function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`public header: over ${ms}ms`)), ms)));
  return Promise.race([p, expired]).finally(() => clearTimeout(timer));
}

/** One read per request for the metadata and the page (React `cache`). */
export const loadAnglerPublic = cache(async (id: string): Promise<AnglerPublicLoad> => {
  const stub = e2ePublicStub(id);
  if (stub) {
    if (stub.kind !== 'ok') return { kind: stub.kind };
    return { kind: 'ok', profile: anglerPublicProfileSchema.parse(stub.profile) };
  }
  // generateStaticParams' `_`: nothing to read, nothing to make dynamic.
  if (isPlaceholderId(id)) return { kind: 'unavailable' };
  try {
    return { kind: 'ok', profile: await within(getAnglerPublicProfile(createServerTransport(), id), READ_MS) };
  } catch (e) {
    if (isAnglerNotFound(e)) return { kind: 'missing' };
    await connection();
    return { kind: 'unavailable' };
  }
});
