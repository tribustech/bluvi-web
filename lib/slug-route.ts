/*
 * Readable URLs for the site's entity pages (owner 2026-10-12: lakes, `/balti/<slug>`; 2026-10-13:
 * competitions, `/concursuri/<slug>`). The pages stay where they are (`app/(site)/<base>/[id]/…`,
 * keyed by documentId); proxy.ts maps the URL with slugRouteAction:
 *  - `/<base>/<slug>/…`        → served from `/<base>/<documentId>/…` (a rewrite: the URL stays);
 *  - `/<base>/<documentId>/…`  → 308 to `/<base>/<slug>/…` once the entity has a slug (old links,
 *    the app's shared links, the sitemap's old URLs);
 *  - `/<base>/<old slug>/…`    → 308 to the current slug URL (an alias: a competition renamed
 *    before its start keeps its earlier slugs);
 *  - anything else (the site's own pages under <base>, an unknown segment) → untouched.
 * The maps come from the CMS (lib/server/slug-map.ts). Pure here, so the decision is unit-tested
 * (lake-slug-route.test.ts, competition-slug-route.test.ts).
 */

/** Next's generated Open Graph / Twitter image routes under a page. */
const SHARE_IMAGE = /\/(?:opengraph|twitter)-image/;

export type SlugMap = {
  bySlug: ReadonlyMap<string, string>;
  byId: ReadonlyMap<string, string>;
  /** Earlier slugs → documentId. */
  aliases: ReadonlyMap<string, string>;
};

export function slugMap(
  entries: ReadonlyArray<{ documentId: string; slug: string }>,
  aliases: ReadonlyArray<{ documentId: string; slug: string }> = []
): SlugMap {
  return {
    bySlug: new Map(entries.map((e) => [e.slug, e.documentId])),
    byId: new Map(entries.map((e) => [e.documentId, e.slug])),
    aliases: new Map(aliases.map((e) => [e.slug, e.documentId])),
  };
}

export type SlugRouteAction = { kind: 'rewrite'; path: string } | { kind: 'redirect'; path: string } | { kind: 'pass' };

/**
 * What proxy.ts does with `pathname` (no query; the caller keeps the request's own) under
 * `/<base>/`, whose own pages are `staticSegments`.
 */
export function slugRouteAction(pathname: string, base: string, staticSegments: ReadonlySet<string>, map: SlugMap): SlugRouteAction {
  const prefix = `/${base}/`;
  if (!pathname.startsWith(prefix)) return { kind: 'pass' };
  const m = /^([^/]+)(\/.*)?$/.exec(pathname.slice(prefix.length));
  if (!m) return { kind: 'pass' };
  const segment = decodeURIComponent(m[1]);
  const rest = m[2] ?? '';
  if (staticSegments.has(segment)) return { kind: 'pass' };
  const id = map.bySlug.get(segment);
  if (id) return { kind: 'rewrite', path: `${prefix}${encodeURIComponent(id)}${rest}` };
  const slug = map.byId.get(segment);
  // The share images keep the documentId URL Next generates for them (the page renders under the
  // rewritten path): no redirect hop for a crawler fetching og:image.
  if (slug && !SHARE_IMAGE.test(rest)) return { kind: 'redirect', path: `${prefix}${encodeURIComponent(slug)}${rest}` };
  const aliasOf = map.aliases.get(segment);
  if (aliasOf) return { kind: 'redirect', path: `${prefix}${encodeURIComponent(map.byId.get(aliasOf) ?? aliasOf)}${rest}` };
  return { kind: 'pass' };
}
