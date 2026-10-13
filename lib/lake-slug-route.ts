import { slugMap, slugRouteAction, type SlugMap, type SlugRouteAction } from './slug-route';

/*
 * Readable lake URLs (owner 2026-10-12): `/balti/<slug>` instead of `/balti/<documentId>`. The pages
 * stay where they are (`app/(site)/balti/[id]/…`, prerendered by documentId); proxy.ts maps the URL
 * (lib/slug-route.ts: a slug is rewritten, a documentId 308s to its slug, the site's own /balti
 * pages and unknown segments pass). The map comes from the CMS (`GET /feed/lakes/slugs`,
 * lib/server/lake-slug-map.ts).
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

export type LakeSlugMap = SlugMap;

export function lakeSlugMap(entries: ReadonlyArray<{ documentId: string; slug: string }>): LakeSlugMap {
  return slugMap(entries);
}

export type LakeRouteAction = SlugRouteAction;

/** What proxy.ts does with `pathname` (no query; the caller keeps the request's own). */
export function lakeRouteAction(pathname: string, map: LakeSlugMap): LakeRouteAction {
  return slugRouteAction(pathname, 'balti', BALTI_STATIC_SEGMENTS, map);
}
