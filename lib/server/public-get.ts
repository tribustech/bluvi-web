import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { parseCacheTags, parseCdnCacheControl } from '@/core/cache/headers';

export type PublicGetResult = { status: number; body: string; contentType: string | null };

/**
 * Upper bound for how long a stale entry may still be served while it revalidates in the
 * background. Freshness comes from the tag purge (the CMS POSTs every purged tag to
 * /api/revalidate), so this only matters if a purge is lost.
 */
const MAX_EXPIRE_SECONDS = 7 * 24 * 60 * 60;

/** Thrown for non-2xx so the answer is never stored (a thrown `use cache` call is not cached). */
export class PublicGetError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`CMS answered ${status}`);
  }
}

/**
 * A public CMS GET, cached by Next exactly as the CMS tells Cloudflare to cache it:
 * `CDN-Cache-Control: public, max-age=N` → revalidate after N seconds,
 * `X-Cache-Tag: a,b` → tags a and b (purged by /api/revalidate).
 * A response the CMS marks private is kept only momentarily.
 */
export async function cachedPublicGet(url: string, appHeaders: Record<string, string>): Promise<PublicGetResult> {
  'use cache';

  const res = await fetch(url, { headers: { accept: 'application/json', ...appHeaders } });
  const body = await res.text();
  if (!res.ok) throw new PublicGetError(res.status, body);

  const policy = parseCdnCacheControl(res.headers.get('cdn-cache-control'));
  if (policy.cacheable) {
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

  return { status: res.status, body, contentType: res.headers.get('content-type') };
}
