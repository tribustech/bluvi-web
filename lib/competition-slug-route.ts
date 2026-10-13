import { slugMap, slugRouteAction, type SlugMap, type SlugRouteAction } from './slug-route';

/*
 * Readable competition URLs (owner 2026-10-13): `/concursuri/<slug>` instead of
 * `/concursuri/<documentId>`, as for lakes (lib/lake-slug-route.ts). The pages stay at
 * `app/(site)/concursuri/[id]/…`; proxy.ts maps the URL (lib/slug-route.ts): a slug is rewritten, a
 * documentId 308s to its slug, an earlier slug (renamed before the start) 308s to the current one,
 * the site's own /concursuri pages and unknown segments pass. The map comes from the CMS
 * (`GET /feed/competitions/slugs`, lib/server/competition-slug-map.ts).
 */

/**
 * `/concursuri/<word>` pages of the site itself — never a competition. Kept equal to the folders
 * under app/(site)/concursuri by competition-slug-route.test.ts; the CMS reserves these words (and a
 * few more: nou, noua, cauta, harta) for competition slugs, so a slug never shadows a site page.
 */
export const CONCURSURI_STATIC_SEGMENTS: ReadonlySet<string> = new Set(['live', 'viitoare', 'rezultate', 'opengraph-image', 'twitter-image']);

export type CompetitionSlugMap = SlugMap;

export function competitionSlugMap(
  entries: ReadonlyArray<{ documentId: string; slug: string }>,
  aliases: ReadonlyArray<{ documentId: string; slug: string }> = []
): CompetitionSlugMap {
  return slugMap(entries, aliases);
}

export type CompetitionRouteAction = SlugRouteAction;

/** What proxy.ts does with `pathname` (no query; the caller keeps the request's own). */
export function competitionRouteAction(pathname: string, map: CompetitionSlugMap): CompetitionRouteAction {
  return slugRouteAction(pathname, 'concursuri', CONCURSURI_STATIC_SEGMENTS, map);
}
