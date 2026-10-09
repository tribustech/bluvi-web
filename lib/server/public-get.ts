import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { parseCacheTags, parseCdnCacheControl } from '@/core/cache/headers';

export type PublicGetResult = { ok: boolean; status: number; body: string; contentType: string | null };

/**
 * Upper bound for how long a stale entry may still be served while it revalidates in the
 * background. Freshness comes from the tag purge (the CMS POSTs every purged tag to
 * /api/revalidate), so this only matters if a purge is lost.
 */
const MAX_EXPIRE_SECONDS = 7 * 24 * 60 * 60;

/**
 * A public CMS GET, cached by Next exactly as the CMS tells Cloudflare to cache it:
 * `CDN-Cache-Control: public, max-age=N` → revalidate after N seconds,
 * `X-Cache-Tag: a,b` → tags a and b (purged by /api/revalidate).
 *
 * Errors are RETURNED, never thrown: an error thrown inside `'use cache'` reaches the caller
 * redacted in production builds ("An error occurred in the Server Components render…", only a
 * digest), so a CMS 404 could not be told apart from an outage and an unknown competition
 * answered 500 (2026-10-04). Error answers and private responses live only seconds.
 */
export function cachedPublicGet(url: string, appHeaders: Record<string, string>): Promise<PublicGetResult> {
  const placeholder = placeholderAnswer(url);
  if (placeholder) return Promise.resolve(placeholder);
  return readPublic(...publicGetArgs(url, appHeaders));
}

/**
 * The ids a route hands when it has nothing real to prerender: generateStaticParams' `_` (an empty
 * or failed CMS list; partide / pescari / ape-publice always) and the `''` Next passes an image's
 * metadata while it collects routes. Never a Strapi documentId.
 */
export const PLACEHOLDER_IDS: readonly string[] = ['_', ''];

export const isPlaceholderId = (id: string): boolean => PLACEHOLDER_IDS.includes(id);

/** What the CMS answers for an id it does not have (Strapi's NotFoundError body). */
const NOT_FOUND: PublicGetResult = {
  ok: false,
  status: 404,
  body: JSON.stringify({ data: null, error: { status: 404, name: 'NotFoundError', message: 'Not Found', details: {} } }),
  contentType: 'application/json',
};

/**
 * A GET whose path names the placeholder id (`…/sessions/_`, `…/competitions/_/rankings`) is the
 * CMS's 404, answered here, before any cache entry or request. As a cached error answer it would
 * live seconds and be shared by every placeholder page of the build; such a short-lived entry read
 * back from the shared cache handler is left out of the warming pass and the final pass misses it
 * («Unexpected cache miss after cache warming phase», m8.cache-warming). Real ids are untouched:
 * their 404s still reach the CMS and are never baked for long.
 */
export function placeholderAnswer(url: string): PublicGetResult | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  return path.split('/').some(seg => seg === '_') ? { ...NOT_FOUND } : null;
}

/**
 * The cache key of a public GET, canonical: the URL as built (its query order is the request the
 * CMS and Cloudflare see, so it is never reordered) and the headers as a plain object with sorted
 * keys. The prerender's cache-warming pass and its final pass must ask for the same key, or the
 * final pass misses («Unexpected cache miss after cache warming phase»); same input → same JSON.
 */
export function publicGetArgs(url: string, appHeaders: Record<string, string>): [string, Record<string, string>] {
  const headers: Record<string, string> = {};
  for (const k of Object.keys(appHeaders).sort()) headers[k] = appHeaders[k];
  return [url, headers];
}

async function readPublic(url: string, appHeaders: Record<string, string>): Promise<PublicGetResult> {
  'use cache';

  const res = await fetch(url, { headers: { accept: 'application/json', ...appHeaders } });
  const body = await res.text();
  const result = { ok: res.ok, status: res.status, body, contentType: res.headers.get('content-type') };

  const policy = parseCdnCacheControl(res.headers.get('cdn-cache-control'));
  if (res.ok && policy.cacheable) {
    const tags = parseCacheTags(res.headers.get('x-cache-tag'));
    if (tags.length) cacheTag(...tags);
    cacheLife({
      stale: Math.min(policy.maxAge, 300),
      revalidate: policy.maxAge,
      expire: Math.max(policy.maxAge * 2, MAX_EXPIRE_SECONDS),
    });
  } else {
    cacheLife('seconds');
  }
  return result;
}
