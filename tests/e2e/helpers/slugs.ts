import { CMS } from './session';

/*
 * Readable URLs (proxy.ts, lib/lake-slug-route.ts, lib/competition-slug-route.ts): a lake lives at
 * /balti/<slug>, a competition at /concursuri/<slug>; their documentId URLs (and a competition's
 * earlier slugs) 308 to it. Specs keep navigating by documentId and assert the URL the page lands
 * on / links to through these helpers.
 *
 * The maps come from the CMS (/feed/lakes/slugs, /feed/competitions/slugs), once per worker:
 * call `test.beforeAll(loadSlugs)` in the spec, then use the sync helpers. A lake or competition
 * without a slug keeps its documentId URL.
 */

type Base = 'balti' | 'concursuri';
type SlugMap = { data: { documentId: string; slug: string }[] };

let maps: Record<Base, Record<string, string>> | null = null;
let loading: Promise<void> | null = null;

/** Loads both documentId → slug maps (once per worker). */
export function loadSlugs(): Promise<void> {
  loading ??= (async () => {
    const out: Record<Base, Record<string, string>> = { balti: {}, concursuri: {} };
    for (const [base, path] of [['balti', '/feed/lakes/slugs'], ['concursuri', '/feed/competitions/slugs']] as const) {
      const res = await fetch(`${CMS}${path}`);
      if (!res.ok) throw new Error(`${CMS}${path} → ${res.status}`);
      out[base] = Object.fromEntries(((await res.json()) as SlugMap).data.map((e) => [e.documentId, e.slug]));
    }
    maps = out;
  })().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

/** Reads the maps again — after a spec seeds a competition or lake of its own (the CMS gives it a slug at once). */
export function reloadSlugs(): Promise<void> {
  loading = null;
  return loadSlugs();
}

function segment(base: Base, documentId: string): string {
  if (!maps) throw new Error('slug maps not loaded: add test.beforeAll(loadSlugs) to the spec');
  return maps[base][documentId] ?? documentId;
}

const tail = (rest: string) => (!rest || /^[/?#]/.test(rest) ? rest : `/${rest}`);

/** `/balti/<slug><rest>` — e.g. lakePath(id, '/recenzii'); rest may also start with ? or #. */
export const lakePath = (documentId: string, rest = '') => `/balti/${segment('balti', documentId)}${tail(rest)}`;

/** `/concursuri/<slug><rest>` — e.g. competitionPath(id, '/cantare'). */
export const competitionPath = (documentId: string, rest = '') => `/concursuri/${segment('concursuri', documentId)}${tail(rest)}`;

/**
 * A RegExp source for a competition's URL segment, documentId OR slug — for a competition a spec
 * seeded itself (call reloadSlugs after seeding): the dev server's own map refreshes every 5
 * minutes, so a documentId URL may not redirect to the slug yet.
 */
export const freshCompetitionSegment = (documentId: string) => {
  const slug = segment('concursuri', documentId);
  return slug === documentId ? documentId : `(?:${documentId}|${slug})`;
};

/** Is `href` a lake's own page — `/balti/<slug>`, or `/balti/<documentId>` for a lake without one? */
export const isLakePath = (href: string) => {
  const seg = /^\/balti\/([^/?#]+)$/.exec(href)?.[1];
  if (!seg) return false;
  if (!maps) throw new Error('slug maps not loaded: add test.beforeAll(loadSlugs) to the spec');
  // A known slug, or a documentId (24 lowercase alphanumerics) the map has no slug for.
  return Object.values(maps.balti).includes(seg) || (/^[a-z0-9]{24}$/.test(seg) && !(seg in maps.balti));
};

/** Any `/balti/<documentId>…` or `/concursuri/<documentId>…` path (or path + query) as its slug path; unchanged without a slug. */
export const slugPath = (href: string) =>
  href.replace(/^\/(balti|concursuri)\/([^/?#]+)/, (m, base: Base, id: string) => {
    const s = segment(base, id);
    return s === id ? m : `/${base}/${s}`;
  });
