import { expect, test, type APIRequestContext } from '@playwright/test';

/*
 * SEO of the public M1 pages — parity docs/parity/areas/global.yml, behaviours
 * global.b.seo-sitemap (s), global.b.seo-json-ld (j) and global.b.seo-metadata (m). Each test names
 * the criteria it covers.
 *
 * Data-independent: the samples come from the sitemap itself (the first URL of each kind the local
 * CMS has), and the negative cases are looked up by shape in the CMS. Pages are read as HTML with
 * the API request context (what a crawler reads): metadata, canonical and JSON-LD are all in the
 * server's HTML. robots.txt with SITE_INDEXABLE=1 is unit-tested (tests/unit/seo-robots.test.ts):
 * the dev server runs without it.
 */

const CMS = (process.env.CMS_URL ?? 'http://localhost:1337/api').replace(/\/$/, '');

test.describe.configure({ timeout: 240_000 });

/** The URLs of every sitemap the index lists, as paths (the site URL may differ from the server's). */
async function sitemapPaths(request: APIRequestContext): Promise<{ sitemaps: string[]; paths: string[] }> {
  const index = await request.get('/sitemap.xml');
  expect(index.status()).toBe(200);
  expect(index.headers()['content-type']).toContain('xml');
  const xml = await index.text();
  expect(xml).toContain('<sitemapindex');
  const sitemaps = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
  const paths: string[] = [];
  for (const s of sitemaps) {
    const res = await request.get(s, { timeout: 120_000 });
    expect(res.status(), s).toBe(200);
    const body = await res.text();
    expect(body, s).toContain('<urlset');
    const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    expect(locs.length, `${s}: at most 50 000 URLs`).toBeLessThanOrEqual(50_000);
    paths.push(...locs.map(l => decodeURIComponentSafe(new URL(l.replace(/&amp;/g, '&')).pathname)));
  }
  return { sitemaps, paths };
}

const decodeURIComponentSafe = (p: string) => p.split('/').map(s => encodeURIComponent(decodeURIComponent(s))).join('/');

type Seo = {
  status: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  twitterCard: string | null;
  og: Record<string, string>;
  jsonLd: Record<string, unknown>[];
  html: string;
};

const attr = (html: string, re: RegExp) => html.match(re)?.[1]?.replace(/&amp;/g, '&') ?? null;

async function readSeo(request: APIRequestContext, path: string): Promise<Seo> {
  const res = await request.get(path, { timeout: 120_000 });
  const html = await res.text();
  const og: Record<string, string> = {};
  for (const m of html.matchAll(/<meta property="og:([a-z_:]+)" content="([^"]*)"/g)) og[m[1]] ??= m[2].replace(/&amp;/g, '&');
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].flatMap(m => {
    const data: unknown = JSON.parse(m[1]); // throws — and fails the test — on invalid JSON-LD
    return (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
  });
  return {
    status: res.status(),
    title: attr(html, /<title>([^<]*)<\/title>/),
    description: attr(html, /<meta name="description" content="([^"]*)"/),
    canonical: attr(html, /<link rel="canonical" href="([^"]*)"/),
    robots: attr(html, /<meta name="robots" content="([^"]*)"/),
    twitterCard: attr(html, /<meta name="twitter:card" content="([^"]*)"/),
    og,
    jsonLd,
    html,
  };
}

/** The JSON-LD's string values except CMS-typed names / captions / texts. */
function generatedStrings(v: unknown, key = ''): string[] {
  if (typeof v === 'string') return ['name', 'caption', 'reviewBody', 'description', 'headline'].includes(key) ? [] : [v];
  if (Array.isArray(v)) return v.flatMap(x => generatedStrings(x, key));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => generatedStrings(x, k));
  return [];
}

const pathOf = (url: string | null) => (url ? new URL(url).pathname : null);
const types = (s: Seo) => s.jsonLd.map(d => d['@type']);

/** The kinds of page the sitemap lists, and the JSON-LD type each must carry besides its BreadcrumbList. */
const KINDS: { kind: string; re: RegExp; type?: string; breadcrumb?: boolean }[] = [
  { kind: 'lake', re: /^\/balti\/(?!harta$)[^/]+$/, type: 'TouristAttraction', breadcrumb: true },
  { kind: 'lake gallery', re: /^\/balti\/[^/]+\/galerie$/, type: 'ImageGallery', breadcrumb: true },
  { kind: 'lake catches', re: /^\/balti\/[^/]+\/capturi$/, type: 'ImageGallery', breadcrumb: true },
  { kind: 'lake partide', re: /^\/balti\/[^/]+\/partide$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'lake stats', re: /^\/balti\/[^/]+\/statistici$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'lake ranking', re: /^\/balti\/[^/]+\/clasament$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'lake stands', re: /^\/balti\/[^/]+\/standuri$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'lake competitions', re: /^\/balti\/[^/]+\/concursuri$/, type: 'ItemList', breadcrumb: true },
  { kind: 'lake reviews', re: /^\/balti\/[^/]+\/recenzii$/, type: 'TouristAttraction', breadcrumb: true },
  { kind: 'lake map', re: /^\/balti\/[^/]+\/harta$/, type: 'Map', breadcrumb: true },
  { kind: 'competition', re: /^\/concursuri\/(?!live$|viitoare$|rezultate$)[^/]+$/, type: 'SportsEvent', breadcrumb: true },
  { kind: 'competition info', re: /^\/concursuri\/[^/]+\/informatii$/, type: 'SportsEvent', breadcrumb: true },
  { kind: 'competition participants', re: /^\/concursuri\/[^/]+\/participanti$/, type: 'SportsEvent', breadcrumb: true },
  { kind: 'competition rules', re: /^\/concursuri\/[^/]+\/regulament$/, type: 'SportsEvent', breadcrumb: true },
  // The views with their own content: a CollectionPage about the event (not the whole event again).
  { kind: 'competition weighings', re: /^\/concursuri\/[^/]+\/cantare$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'competition catches', re: /^\/concursuri\/[^/]+\/capturi$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'water', re: /^\/ape-publice\/[^/]+$/, breadcrumb: true },
  { kind: 'water partide', re: /^\/ape-publice\/[^/]+\/partide$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'water stats', re: /^\/ape-publice\/[^/]+\/statistici$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'water ranking', re: /^\/ape-publice\/[^/]+\/clasament$/, type: 'CollectionPage', breadcrumb: true },
  { kind: 'water catches', re: /^\/ape-publice\/[^/]+\/capturi$/, type: 'ImageGallery', breadcrumb: true },
  { kind: 'news', re: /^\/stiri\/[^/]+$/, breadcrumb: true },
  { kind: 'sponsor', re: /^\/sponsori\/[^/]+$/, breadcrumb: true },
  { kind: 'lakes list', re: /^\/balti$/ },
  { kind: 'competitions list', re: /^\/concursuri\/rezultate$/ },
];

let cache: { sitemaps: string[]; paths: string[] } | null = null;
const listed = async (request: APIRequestContext) => (cache ??= await sitemapPaths(request));

test('s1–s4: /sitemap.xml is an index of sitemaps that list unique, parameter-free, self-canonical URLs', async ({ request }) => {
  const { sitemaps, paths } = await listed(request);
  expect(sitemaps).toEqual(expect.arrayContaining(['/sitemaps/sitemap/pagini.xml', '/sitemaps/sitemap/balti-0.xml', '/sitemaps/sitemap/concursuri-rezultate.xml']));
  expect(new Set(paths).size).toBe(paths.length);
  expect(paths.filter(p => p.includes('?'))).toEqual([]);
  for (const p of ['/', '/balti', '/balti/harta', '/ape-publice', '/concursuri', '/concursuri/live', '/concursuri/viitoare', '/concursuri/rezultate', '/stiri']) {
    expect(paths).toContain(p);
  }
  // s3: views that are not their own page, or not indexed, are never listed.
  expect(paths.filter(p => /^\/concursuri\/[^/]+\/(clasament|statistici|extra-cantare)(\/|$)/.test(p))).toEqual([]);
  // s2: the lake / competition / public-water subpages are there (the local CMS has some of each).
  for (const k of ['lake gallery', 'lake map', 'competition info', 'competition weighings', 'water partide']) {
    const re = KINDS.find(x => x.kind === k)!.re;
    expect(paths.some(p => re.test(p)), k).toBe(true);
  }
});

test('s2, m1–m4, j1–j3: a sample page of every kind the sitemap lists — 200, indexable, self-canonical, Romanian metadata, valid JSON-LD', async ({ request }) => {
  const { paths } = await listed(request);
  const checked: string[] = [];
  for (const k of KINDS) {
    const path = paths.find(p => k.re.test(p));
    if (!path) continue; // the local CMS has none of this kind
    checked.push(k.kind);
    const s = await readSeo(request, path);
    const at = `${k.kind} ${path}`;
    expect(s.status, at).toBe(200);
    // s2 / m3: what the sitemap lists is indexable and its own canonical.
    expect(s.robots ?? '', at).not.toContain('noindex');
    expect(pathOf(s.canonical), at).toBe(path);
    // m1: a title and a description, Romanian (the site's own words carry diacritics somewhere).
    expect(s.title, at).toBeTruthy();
    expect(s.title!.endsWith('· Bluvi') || s.title === 'Bluvi' || /Bluvi/.test(s.title!), at).toBe(true);
    expect(s.description?.trim(), at).toBeTruthy();
    // m2: Open Graph url / site name / locale, and a large Twitter card.
    expect(pathOf(s.og.url ?? null), at).toBe(path);
    expect(s.og.site_name, at).toBe('Bluvi');
    expect(s.og.locale, at).toBe('ro_RO');
    expect(s.twitterCard, at).toBe('summary_large_image');
    // j1: every JSON-LD block parses (readSeo) and has a schema.org context.
    expect(s.jsonLd.length, at).toBeGreaterThan(0);
    for (const d of s.jsonLd) expect(d['@context'], at).toBe('https://schema.org');
    if (k.breadcrumb) {
      // j2: a BreadcrumbList whose last step is the page itself (its item is the page's path).
      const crumbs = s.jsonLd.find(d => d['@type'] === 'BreadcrumbList') as { itemListElement: { item?: string }[] } | undefined;
      expect(crumbs, at).toBeTruthy();
      const last = crumbs!.itemListElement.at(-1)?.item;
      expect(last, `${at}: the last crumb names the page`).toBeTruthy();
      expect([path, pathOf(s.canonical)], at).toContain(pathOf(last!));
    }
    if (k.type) expect(types(s), at).toContain(k.type);
    // j3: never «capot» (UI: «fără captură») in what we generate — names typed in the CMS are theirs.
    expect(generatedStrings(s.jsonLd).filter(v => /\bcapot\b/i.test(v)), at).toEqual([]);
  }
  expect(checked.length).toBeGreaterThanOrEqual(15);
});

test('j4: rankings carry an ItemList of the rows the page shows; reviews an AggregateRating only with ratings', async ({ request }) => {
  const { paths } = await listed(request);
  // A listed ranking whose bare URL (the month, fish's default period) has rows: a ranking listed for
  // its year alone shows the empty month there — no ItemList (rule 4: only the rows on screen).
  type RankingPage = { mainEntity?: { '@type': string; itemListElement: { position: number; name: string }[] } };
  let ranked: { s: Seo; page: RankingPage } | null = null;
  for (const p of paths.filter(x => /^\/balti\/[^/]+\/clasament$/.test(x)).slice(0, 15)) {
    const s = await readSeo(request, p);
    const page = s.jsonLd.find(d => d['@type'] === 'CollectionPage') as RankingPage;
    if (page.mainEntity) {
      ranked = { s, page };
      break;
    }
  }
  if (ranked) {
    const { s, page } = ranked;
    expect(page.mainEntity?.['@type']).toBe('ItemList');
    // Every ranked name is on the page.
    for (const row of page.mainEntity!.itemListElement) expect(s.html).toContain(row.name.replace(/&/g, '&amp;'));
    expect(page.mainEntity!.itemListElement.map(r => r.position)).toEqual(page.mainEntity!.itemListElement.map((_, i) => i + 1));
  }
  const reviews = paths.find(p => /^\/balti\/[^/]+\/recenzii$/.test(p));
  if (reviews) {
    const s = await readSeo(request, reviews);
    const lake = s.jsonLd.find(d => d['@type'] === 'TouristAttraction') as { aggregateRating: { ratingValue: number; ratingCount: number }; review: unknown[] };
    expect(lake.aggregateRating.ratingCount).toBeGreaterThan(0);
    expect(lake.aggregateRating.ratingValue).toBeGreaterThanOrEqual(1);
    expect(lake.aggregateRating.ratingValue).toBeLessThanOrEqual(5);
  }
  // A lake without reviews: its Recenzii page is not in the sitemap and carries no AggregateRating.
  const index = (await (await request.get(`${CMS}/feed/lakes/index`)).json()) as { data: { documentId: string }[] };
  const listedReviews = new Set(paths.filter(p => p.endsWith('/recenzii')).map(p => p.split('/')[2]));
  const bare = index.data.find(l => !listedReviews.has(l.documentId));
  if (bare) {
    const lake = (await (await request.get(`${CMS}/feed/lakes/${bare.documentId}`)).json()) as { data: { reviewsMeta: { count: number } | null } };
    if (!lake.data.reviewsMeta?.count) {
      const s = await readSeo(request, `/balti/${bare.documentId}/recenzii`);
      expect(s.jsonLd.some(d => 'aggregateRating' in d)).toBe(false);
    }
  }
});

test('m3: view parameters never change the canonical (period, sort, tab, photo)', async ({ request }) => {
  const { paths } = await listed(request);
  const cases: [RegExp, string][] = [
    [/^\/balti\/[^/]+\/clasament$/, '?perioada=year'],
    [/^\/balti\/[^/]+\/standuri$/, '?perioada=week&sortare=catches'],
    [/^\/balti\/[^/]+\/concursuri$/, '?tab=trecute'],
    [/^\/balti\/[^/]+\/capturi$/, '?foto=x'],
    [/^\/ape-publice\/[^/]+\/statistici$/, '?perioada=year'],
  ];
  for (const [re, q] of cases) {
    const path = paths.find(p => re.test(p));
    if (!path) continue;
    expect(pathOf((await readSeo(request, path + q)).canonical), path + q).toBe(path);
  }
});

test('j2: the competition views\' breadcrumb ends on the view (Cântare, Toți peștii), as the visible band', async ({ request }) => {
  const { paths } = await listed(request);
  for (const [re, label] of [[/^\/concursuri\/[^/]+\/cantare$/, 'Cântare'], [/^\/concursuri\/[^/]+\/capturi$/, 'Toți peștii']] as const) {
    const path = paths.find(p => re.test(p));
    expect(path, label).toBeTruthy();
    const s = await readSeo(request, path!);
    const crumbs = s.jsonLd.find(d => d['@type'] === 'BreadcrumbList') as { itemListElement: { name: string; item?: string }[] };
    expect(crumbs.itemListElement.map(c => c.name)).toEqual([expect.any(String), expect.any(String), label]);
    expect(pathOf(crumbs.itemListElement[1].item ?? null)).toBe(path!.replace(/\/[^/]+$/, ''));
    expect(pathOf(crumbs.itemListElement[2].item ?? null)).toBe(path);
    expect(s.html).toMatch(new RegExp(`aria-current="page"[^>]*>${label}<`));
  }
});

test('j2: a lake subpage\'s BreadcrumbList uses the band\'s label and the title the same noun', async ({ request }) => {
  const { paths } = await listed(request);
  for (const [re, label] of [[/^\/balti\/[^/]+\/clasament$/, 'Clasament'], [/^\/balti\/[^/]+\/standuri$/, 'Clasament standuri']] as const) {
    const path = paths.find(p => re.test(p));
    if (!path) continue;
    const s = await readSeo(request, path);
    const crumbs = s.jsonLd.find(d => d['@type'] === 'BreadcrumbList') as { itemListElement: { name: string }[] };
    expect(crumbs.itemListElement.at(-1)?.name, path).toBe(label);
    expect(s.title!.startsWith(`${label} · `), `${path} ${s.title}`).toBe(true);
  }
});

test('m5, s3: pages without content of their own are noindex and left out of the sitemap', async ({ request }) => {
  const { paths } = await listed(request);
  // The competition's Statistici: signed-in only → noindex, follow (any listed competition).
  const competition = paths.find(p => /^\/concursuri\/[^/]+\/cantare$/.test(p))?.replace(/\/cantare$/, '');
  expect(competition).toBeTruthy();
  const stats = await readSeo(request, `${competition}/statistici`);
  expect(stats.robots).toContain('noindex');
  // Extra Cântare: a utility list read in the browser — noindex, follow at every stage, never listed.
  expect((await readSeo(request, `${competition}/extra-cantare`)).robots).toMatch(/noindex.*follow|follow.*noindex/);
  // A lake subpage the sitemap leaves out (nothing to show) is noindex, follow; one it lists is not.
  const index = (await (await request.get(`${CMS}/feed/lakes/index`)).json()) as { data: { documentId: string }[] };
  const lakeSubs = ['statistici', 'clasament', 'standuri', 'recenzii', 'harta', 'partide', 'galerie', 'capturi', 'concursuri'];
  const sampled = new Set<string>();
  for (const lake of index.data.slice(0, 40)) {
    for (const sub of lakeSubs) {
      if (sampled.has(sub)) continue;
      const path = `/balti/${lake.documentId}/${sub}`;
      if (paths.includes(path)) continue;
      sampled.add(sub);
      const s = await readSeo(request, path);
      expect(s.status, path).toBe(200);
      expect(s.robots ?? '', `${path}: not in the sitemap → noindex`).toContain('noindex');
      expect(s.robots ?? '', path).not.toContain('nofollow');
    }
    if (sampled.size === lakeSubs.length) break;
  }
  expect(sampled.size, 'the local CMS has lakes without some subpage content').toBeGreaterThan(0);
  // A public water's community subpage the sitemap leaves out is noindex too.
  const waterPartide = new Set(paths.filter(p => /^\/ape-publice\/[^/]+\/partide$/.test(p)));
  const quiet = paths.find(p => /^\/ape-publice\/[^/]*%3A[^/]*$/i.test(p) && !waterPartide.has(`${p}/partide`));
  if (quiet) expect((await readSeo(request, `${quiet}/statistici`)).robots ?? '', quiet).toContain('noindex');
  // A public water's full map: noindex, follow (the water page embeds it) and never listed.
  expect(paths.filter(p => /^\/ape-publice\/[^/]+\/harta$/.test(p))).toEqual([]);
  const water = paths.find(p => /^\/ape-publice\/[^/]+$/.test(p));
  if (water) {
    const map = await readSeo(request, `${water}/harta`);
    expect(map.robots ?? '', water).toMatch(/noindex.*follow|follow.*noindex/);
    expect(map.robots ?? '', water).not.toContain('nofollow');
    expect(map.title ?? '', water).toMatch(/^Hartă · /);
  }
  // Regulament without a regulation: noindex and not listed.
  const upcoming = (await (await request.get(`${CMS}/feed/competitions?status=notStarted&page=1&pageSize=50`)).json()) as { data: { documentId: string }[] };
  for (const c of upcoming.data.slice(0, 10)) {
    const detail = (await (await request.get(`${CMS}/feed/competitions/${c.documentId}`)).json()) as { data?: { regulation: unknown[] | null } };
    if (!detail.data || (detail.data.regulation?.length ?? 0) > 0) continue;
    expect(paths).not.toContain(`/concursuri/${c.documentId}/regulament`);
    expect((await readSeo(request, `/concursuri/${c.documentId}/regulament`)).robots).toContain('noindex');
    // Before the start the Clasament's views show the preview: they canonicalise to the page.
    expect(pathOf((await readSeo(request, `/concursuri/${c.documentId}/cantare`)).canonical)).toBe(`/concursuri/${c.documentId}`);
    expect(paths).not.toContain(`/concursuri/${c.documentId}/cantare`);
    break;
  }
});

type CmsCompetition = { documentId: string; lake?: { documentId: string } | null; registrations?: { registrationStatus: string }[] };

/** Started and completed competitions of the local CMS (first page of each). */
async function startedCompetitions(request: APIRequestContext): Promise<CmsCompetition[]> {
  const out: CmsCompetition[] = [];
  for (const status of ['started', 'completed']) {
    const res = (await (await request.get(`${CMS}/feed/competitions?status=${status}&page=1&pageSize=50`)).json()) as { data: CmsCompetition[] };
    out.push(...res.data);
  }
  return out;
}

test('m5, s3: a started competition with nothing weighed — Cântare / Toți peștii noindex, unlisted, no promised rows', async ({ request }) => {
  const { paths } = await listed(request);
  let checked = 0;
  for (const c of await startedCompetitions(request)) {
    const stats = (await (await request.get(`${CMS}/competitions/${c.documentId}/weighing-statistics`)).json()) as { data: { catchCount: number }[] };
    const weighings = stats.data.length;
    const catches = stats.data.reduce((n, w) => n + w.catchCount, 0);
    for (const [view, has] of [['cantare', weighings > 0], ['capturi', catches > 0]] as const) {
      const path = `/concursuri/${c.documentId}/${view}`;
      if (has) {
        expect(paths, path).toContain(path);
        continue;
      }
      checked++;
      expect(paths, path).not.toContain(path);
      const s = await readSeo(request, path);
      expect(s.robots ?? '', path).toMatch(/noindex.*follow|follow.*noindex/);
      expect(s.robots ?? '', path).not.toContain('nofollow');
      expect(s.description ?? '', path).not.toMatch(/stand cu stand|specia, greutatea/);
    }
    if (checked >= 2) break;
  }
  expect(checked, 'the local CMS has a started competition without weighings or catches').toBeGreaterThan(0);
});

test('m5, s2: a stats page is judged by its widest period — a quiet month with a year of partide stays listed and indexable', async ({ request }) => {
  const { paths } = await listed(request);
  const index = (await (await request.get(`${CMS}/feed/lakes/index`)).json()) as { data: { documentId: string }[] };
  const stats = async (period: string, id: string) =>
    ((await (await request.get(`${CMS}/feed/community/stats?period=${period}&venue=lake:${id}`)).json()) as { data: { totals: { partide: number } } }).data;
  let found: string | null = null;
  for (const lake of index.data.slice(0, 60)) {
    const [month, year] = await Promise.all([stats('month', lake.documentId), stats('year', lake.documentId)]);
    if (month.totals.partide === 0 && year.totals.partide > 0) {
      found = lake.documentId;
      break;
    }
  }
  test.skip(!found, 'no lake with a quiet month and partide this year in the local CMS');
  const path = `/balti/${found}/statistici`;
  expect(paths).toContain(path);
  const s = await readSeo(request, path);
  expect(s.robots ?? '', path).not.toContain('noindex');
  for (const sub of ['clasament']) {
    const p = `/balti/${found}/${sub}`;
    if (paths.includes(p)) expect((await readSeo(request, p)).robots ?? '', p).not.toContain('noindex');
  }
});

test('j1: the SportsEvent — clamped dates, the lake\'s address when known, an Organization organiser', async ({ request }) => {
  const { paths } = await listed(request);
  const pages = paths.filter(p => /^\/concursuri\/(?!live$|viitoare$|rezultate$)[^/]+$/.test(p)).slice(0, 12);
  let withAddress = 0;
  for (const path of pages) {
    const s = await readSeo(request, path);
    const ev = s.jsonLd.find(d => d['@type'] === 'SportsEvent') as
      | { startDate: string; endDate: string; location?: { address?: { '@type': string; addressCountry: string } }; organizer?: { '@type': string } }
      | undefined;
    expect(ev, path).toBeTruthy();
    expect(Date.parse(ev!.endDate), path).toBeGreaterThanOrEqual(Date.parse(ev!.startDate));
    if (ev!.organizer) expect(ev!.organizer['@type'], path).toBe('Organization');
    if (ev!.location?.address) {
      withAddress++;
      expect(ev!.location.address['@type']).toBe('PostalAddress');
      expect(ev!.location.address.addressCountry).toBe('RO');
    }
    // m1: the summary promises only what the stage has — never «statistici» (signed-in, noindex).
    expect(s.description ?? '', path).not.toMatch(/statistici/i);
  }
  expect(withAddress, 'a competition at a lake with a county').toBeGreaterThan(0);
});

test('m1: Participanți with nobody registered never says «0 participanți»', async ({ request }) => {
  const upcoming = (await (await request.get(`${CMS}/feed/competitions?status=notStarted&page=1&pageSize=50`)).json()) as { data: CmsCompetition[] };
  const empty = upcoming.data.find(c => !(c.registrations ?? []).some(r => r.registrationStatus === 'registered'));
  test.skip(!empty, 'no upcoming competition without entrants in the local CMS');
  const s = await readSeo(request, `/concursuri/${empty!.documentId}/participanti`);
  for (const text of [s.description ?? '', s.og.description ?? '']) {
    expect(text).not.toMatch(/^0 /);
    expect(text).toMatch(/^Lista participanților/);
  }
});

test('m1: public-water subpages are titled with the qualified name the breadcrumb uses', async ({ request }) => {
  const { paths } = await listed(request);
  const path = paths.find(p => /^\/ape-publice\/[^/]+\/partide$/.test(p));
  test.skip(!path, 'no public water with partide in the local CMS');
  const s = await readSeo(request, path!);
  const crumbs = s.jsonLd.find(d => d['@type'] === 'BreadcrumbList') as { itemListElement: { name: string }[] };
  const water = crumbs.itemListElement.at(-2)!.name;
  expect(s.title).toBe(`Partide · ${water} · Bluvi`);
  const page = s.jsonLd.find(d => d['@type'] === 'CollectionPage') as { name: string };
  expect(page.name).toBe(`Partide · ${water}`);
});

test('s5: robots.txt blocks everything while SITE_INDEXABLE is unset (this dev server)', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toMatch(/User-Agent: \*/i);
  expect(body).toMatch(/Disallow: \/\s*$/m);
  expect(body).not.toContain('Sitemap:');
});
