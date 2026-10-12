/*
 * Readable lake URLs (owner 2026-10-12): `/balti/<slug>` instead of `/balti/<documentId>`. The pages
 * stay where they are (`app/(site)/balti/[id]/…`, prerendered by documentId); proxy.ts maps the URL:
 *  - `/balti/<slug>/…`        → served from `/balti/<documentId>/…` (a rewrite: the URL stays);
 *  - `/balti/<documentId>/…`  → 308 to `/balti/<slug>/…` once the lake has a slug (old links,
 *    the app's shared links via /lakes/:id, the sitemap's old URLs);
 *  - anything else (the site's own /balti pages, an unknown segment) → untouched.
 * The map comes from the CMS (`GET /feed/lakes/slugs`, lib/server/lake-slug-map.ts). Pure here, so
 * the decision is unit-tested (lake-slug-route.test.ts).
 */

/**
 * `/balti/<word>` pages of the site itself — never a lake. Kept equal to the folders under
 * app/(site)/balti by lake-slug-route.test.ts; the CMS reserves the same words for slugs
 * (fir-intins-cms src/api/lake/utils/slug.ts RESERVED).
 */
export const BALTI_STATIC_SEGMENTS: ReadonlySet<string> = new Set([
  'harta',
  'judet',
  'judete',
  'specie',
  'specii',
  'catch-and-release',
  'cu-cazare',
  'cu-iluminat-nocturn',
  'cu-retinere',
  'cu-rezervare-online',
  'pentru-familii',
  'opengraph-image',
  'twitter-image',
]);

/** Next's generated Open Graph / Twitter image routes under a page. */
const SHARE_IMAGE = /\/(?:opengraph|twitter)-image/;

export type LakeSlugMap = { bySlug: ReadonlyMap<string, string>; byId: ReadonlyMap<string, string> };

export function lakeSlugMap(entries: ReadonlyArray<{ documentId: string; slug: string }>): LakeSlugMap {
  return {
    bySlug: new Map(entries.map((e) => [e.slug, e.documentId])),
    byId: new Map(entries.map((e) => [e.documentId, e.slug])),
  };
}

export type LakeRouteAction = { kind: 'rewrite'; path: string } | { kind: 'redirect'; path: string } | { kind: 'pass' };

/** What proxy.ts does with `pathname` (no query; the caller keeps the request's own). */
export function lakeRouteAction(pathname: string, map: LakeSlugMap): LakeRouteAction {
  const m = /^\/balti\/([^/]+)(\/.*)?$/.exec(pathname);
  if (!m) return { kind: 'pass' };
  const segment = decodeURIComponent(m[1]);
  const rest = m[2] ?? '';
  if (BALTI_STATIC_SEGMENTS.has(segment)) return { kind: 'pass' };
  const id = map.bySlug.get(segment);
  if (id) return { kind: 'rewrite', path: `/balti/${encodeURIComponent(id)}${rest}` };
  const slug = map.byId.get(segment);
  // The share images keep the documentId URL Next generates for them (the page renders under the
  // rewritten path): no redirect hop for a crawler fetching og:image.
  if (slug && !SHARE_IMAGE.test(rest)) return { kind: 'redirect', path: `/balti/${encodeURIComponent(slug)}${rest}` };
  return { kind: 'pass' };
}
