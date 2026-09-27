/**
 * Parsers for the cache headers the CMS stamps on every cacheable response
 * (`fir-intins-cms/src/middlewares/cache-control.ts`):
 *
 *   CDN-Cache-Control: public, max-age=3600
 *   X-Cache-Tag: lake-abc,lakes-list
 *
 * The web server caches public reads for exactly as long, and under exactly the tags,
 * that Cloudflare does — so the CMS's single purge list keeps both fresh.
 */

export type CdnCachePolicy = { cacheable: true; maxAge: number } | { cacheable: false };

export function parseCdnCacheControl(value: string | null | undefined): CdnCachePolicy {
  if (!value) return { cacheable: false };
  const directives = value
    .toLowerCase()
    .split(',')
    .map(d => d.trim());
  if (!directives.includes('public')) return { cacheable: false };
  if (directives.some(d => d === 'no-store' || d === 'private' || d === 'no-cache')) return { cacheable: false };
  const maxAge = directives.find(d => d.startsWith('max-age='));
  const seconds = maxAge ? Number.parseInt(maxAge.slice('max-age='.length), 10) : Number.NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return { cacheable: false };
  return { cacheable: true, maxAge: seconds };
}

/** Next's limit: a tag longer than 256 chars is never assigned, so it could never be revalidated. */
export const MAX_TAG_LENGTH = 256;

export function parseCacheTags(value: string | null | undefined): string[] {
  if (!value) return [];
  const tags = value
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0 && t.length <= MAX_TAG_LENGTH);
  return [...new Set(tags)];
}
