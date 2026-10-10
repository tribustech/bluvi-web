import { expect, test, type APIRequestContext } from '@playwright/test';
import { BASE_URL } from './helpers/base-url';
import { CMS } from './helpers/session';

/*
 * Generated Open Graph / Twitter images — parity global.b.seo-og-images (docs/parity/areas/global.yml).
 * The file convention (app/(site)/**\/opengraph-image.tsx + twitter-image.tsx, drawn by
 * lib/server/og) gives every public page a 1200×630 PNG:
 *  - a1 the pages' <meta og:image / twitter:image> point at the route's own image (size, type, alt);
 *    on an entity page both are the generated card even when the entity has a photo or banner (the
 *    card carries it — WhatsApp / Facebook read og:image, never twitter:image), and the alt names
 *    the entity (generateImageMetadata: `…/opengraph-image/card`);
 *  - a2 each image answers 200 image/png, 1200×630, ≤ 300 KB;
 *  - a3 warm (drawn once, then cached under the CMS tag) it answers in under ~1.5 s;
 *  - a4 an id the CMS does not know answers the brand card, never an error.
 * One sample per kind, found in the local CMS by shape (the spec survives new content); the public
 * waters come from the bundled dataset (stable ids). No browser: the HTML is read as a crawler does.
 */

const MAX_BYTES = 300 * 1024;
const WARM_MS = 1500;
const COLD_TIMEOUT = 60_000;

type Meta = Record<string, string>;

const decode = (v: string) => v.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The page's og:/twitter: meta, as a crawler reads them. */
async function metaOf(request: APIRequestContext, path: string): Promise<Meta> {
  const res = await request.get(path, { timeout: COLD_TIMEOUT });
  expect(res.status(), `${path} answers`).toBe(200);
  const html = await res.text();
  const out: Meta = {};
  for (const m of html.matchAll(/<meta\s+(?:property|name)="((?:og|twitter):[^"]+)"\s+content="([^"]*)"/g)) out[m[1]] ??= decode(m[2]);
  return out;
}

/** The image URL's path + query, on the dev server under test (metadataBase may name another host). */
const local = (url: string) => {
  const u = new URL(url, BASE_URL);
  return `${u.pathname}${u.search}`;
};

/** a2 + a3: 200 image/png, 1200×630 (the PNG header), ≤ 300 KB; a second fetch is warm and fast. */
async function expectCard(request: APIRequestContext, url: string) {
  const path = local(url);
  const cold = await request.get(path, { timeout: COLD_TIMEOUT });
  expect(cold.status(), path).toBe(200);
  expect(cold.headers()['content-type']).toBe('image/png');
  const body = await cold.body();
  expect(body.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect(body.readUInt32BE(16), 'width').toBe(1200);
  expect(body.readUInt32BE(20), 'height').toBe(630);
  expect(body.length, `${path} ≤ 300 KB`).toBeLessThanOrEqual(MAX_BYTES);
  const t0 = Date.now();
  const warm = await request.get(path);
  const ms = Date.now() - t0;
  expect(warm.status()).toBe(200);
  expect(ms, `${path} warm in ${ms} ms`).toBeLessThan(WARM_MS);
  return body;
}

/** a1: the meta names this route's image (`<route>/<kind>-image…`) with its size, type and alt. */
function expectOwnImage(meta: Meta, route: string, kind: 'og' | 'twitter') {
  const url = kind === 'og' ? meta['og:image'] : meta['twitter:image'];
  expect(url, `${route} ${kind}:image`).toBeTruthy();
  const file = kind === 'og' ? 'opengraph-image' : 'twitter-image';
  expect(new URL(url, BASE_URL).pathname).toMatch(new RegExp(`^${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/${file}(-[a-z0-9]+)?(/card)?$`));
  expect(meta[`${kind}:image:width`]).toBe('1200');
  expect(meta[`${kind}:image:height`]).toBe('630');
  expect(meta[`${kind}:image:type`]).toBe('image/png');
  expect(meta[`${kind}:image:alt`]?.length ?? 0).toBeGreaterThan(10);
  return url;
}

/**
 * a1 for an entity page: og:image AND twitter:image are the card (never the raw CMS photo, which has
 * no size or alt), and the alt names the entity.
 */
async function expectEntityPage(request: APIRequestContext, route: string, name: string) {
  const meta = await metaOf(request, route);
  const og = expectOwnImage(meta, route, 'og');
  expectOwnImage(meta, route, 'twitter');
  expect(meta['og:image:alt'], `${route} alt names the entity`).toContain(name.replace(/\s+/g, ' ').trim().slice(0, 40));
  expect(meta['og:image:alt'].toLowerCase()).not.toContain('capot');
  return og;
}

/* ---------------------------------------------------------------- fixtures (by shape) */

type CardRow = { documentId: string; competitionStatus?: string };

async function cmsJson<T>(request: APIRequestContext, path: string): Promise<T> {
  const res = await request.get(`${CMS}${path}`);
  expect(res.ok(), `${CMS}${path}`).toBe(true);
  return (await res.json()) as T;
}

async function firstCompetition(request: APIRequestContext, status: 'completed' | 'started' | 'notStarted'): Promise<string | null> {
  const page = await cmsJson<{ data: CardRow[] }>(request, `/feed/competition-cards?status=${status}&page=1&pageSize=5&sort=date`);
  return page.data[0]?.documentId ?? null;
}

/** The entity's name, as the CMS gives it (the alt must name it). */
const lakeName = async (request: APIRequestContext, id: string) => (await cmsJson<{ data: { name: string } }>(request, `/feed/lakes/${id}`)).data.name;
const competitionName = async (request: APIRequestContext, id: string) => (await cmsJson<{ data: { name: string } }>(request, `/feed/competitions/${id}`)).data.name;

/** A real public partidă of the local CMS (community history), or null. */
async function firstPartida(request: APIRequestContext): Promise<string | null> {
  const page = await cmsJson<{ data: { documentId: string }[] }>(request, '/feed/community/history?page=1&pageSize=1');
  return page.data[0]?.documentId ?? null;
}

/**
 * The host crawlers must be sent to: metadataBase (NEXT_PUBLIC_SITE_URL) in a build; `next dev`
 * names its own origin for the file-convention images instead.
 */
const SITE_ORIGINS = [new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').origin, new URL(BASE_URL).origin];

test.describe.configure({ timeout: 180_000 });

test.describe('global.b.seo-og-images', () => {
  test('a1 a2 a3 — list pages: og:image and twitter:image are the brand card of the route', async ({ request }) => {
    for (const route of ['/balti', '/balti/harta', '/concursuri', '/concursuri/viitoare', '/concursuri/live', '/concursuri/rezultate', '/ape-publice', '/stiri']) {
      const meta = await metaOf(request, route);
      const og = expectOwnImage(meta, route, 'og');
      expectOwnImage(meta, route, 'twitter');
      await expectCard(request, og);
    }
  });

  test('a1 a2 — Acasă: the brand card (og-home.jpg as the card); pages without their own image inherit it', async ({ request }) => {
    const home = await metaOf(request, '/');
    // The home page's metadata may name og-home.jpg itself (global.seo owns it); else the route's card.
    expect(home['og:image']).toMatch(/\/opengraph-image(-[a-z0-9]+)?\?|og-home/);
    // A page with no image of its own (Intră în cont) carries the root card: the same artwork, as PNG.
    const meta = await metaOf(request, '/intra');
    const og = expectOwnImage(meta, '', 'og');
    await expectCard(request, og);
  });

  test('a1 a2 a3 — lake and a lake subpage: the lake card (photo or brand panel), subpages labelled', async ({ request }) => {
    const index = await cmsJson<{ data: { documentId: string }[] } | { documentId: string }[]>(request, '/feed/lakes/index');
    const lakes = Array.isArray(index) ? index : index.data;
    const id = lakes[0].documentId;
    const name = await lakeName(request, id);
    const card = await expectEntityPage(request, `/balti/${id}`, name);
    await expectCard(request, card);
    const sub = await expectEntityPage(request, `/balti/${id}/statistici`, name);
    await expectCard(request, sub);
  });

  test('a1 a2 a3 — competitions: completed (podium), live and upcoming, and a subpage', async ({ request }) => {
    const ids = (await Promise.all((['completed', 'started', 'notStarted'] as const).map(s => firstCompetition(request, s)))).filter((x): x is string => !!x);
    expect(ids.length, 'the local CMS has competitions').toBeGreaterThan(0);
    for (const id of ids) await expectCard(request, await expectEntityPage(request, `/concursuri/${id}`, await competitionName(request, id)));
    await expectCard(request, await expectEntityPage(request, `/concursuri/${ids[0]}/clasament`, await competitionName(request, ids[0])));
  });

  test('a1 a2 — Imagine clasament: one source, the segment\'s card (never the ranking PNG or the raw banner), summary_large_image', async ({ request }) => {
    const id = await firstCompetition(request, 'completed');
    test.skip(!id, 'no completed competition in the local CMS');
    const route = `/concursuri/${id}/clasament/imagine`;
    const og = await expectEntityPage(request, route, await competitionName(request, id!));
    const meta = await metaOf(request, route);
    expect(meta['og:image'], 'og:image is the file-convention card, not the ranking PNG').not.toMatch(/\/png(\?|$)/);
    expect(meta['twitter:card']).toBe('summary_large_image');
    await expectCard(request, og);
  });

  test('a1 a2 a3 — public water (dataset id) and its subpage: the outline card', async ({ request }) => {
    for (const route of ['/ape-publice/2245', '/ape-publice/2245/harta']) {
      const meta = await metaOf(request, route);
      await expectCard(request, expectOwnImage(meta, route, 'og'));
      expectOwnImage(meta, route, 'twitter');
    }
  });

  test('a1 a2 a3 — news article and sponsor', async ({ request }) => {
    const news = await cmsJson<{ data: { documentId: string; title: string }[] }>(request, '/feed/announcements?pagination%5Bpage%5D=1&pagination%5BpageSize%5D=1');
    if (news.data[0]) {
      const n = news.data[0];
      await expectCard(request, await expectEntityPage(request, `/stiri/${n.documentId}`, n.title));
    }
    const sponsors = await cmsJson<{ data: { documentId: string }[] }>(request, '/feed/sponsors/dashboard');
    if (sponsors.data[0]) {
      const route = `/sponsori/${sponsors.data[0].documentId}`;
      const meta = await metaOf(request, route);
      await expectCard(request, expectOwnImage(meta, route, 'og'));
      expectOwnImage(meta, route, 'twitter');
    }
  });

  test('a4 — an unknown or malformed id answers the brand card (200 PNG), never an error', async ({ request }) => {
    const meta = await metaOf(request, '/balti');
    const lakeIndex = await cmsJson<{ data: { documentId: string }[] } | { documentId: string }[]>(request, '/feed/lakes/index');
    const lakeId = (Array.isArray(lakeIndex) ? lakeIndex : lakeIndex.data)[0].documentId;
    const lakeCard = new URL((await metaOf(request, `/balti/${lakeId}`))['twitter:image'], BASE_URL).pathname;
    const waterCard = new URL((await metaOf(request, '/ape-publice/2245'))['og:image'], BASE_URL).pathname;
    expect(meta['og:image']).toBeTruthy();
    for (const path of [
      lakeCard.replace(lakeId, 'nuexistaaceastabalta0000'),
      lakeCard.replace(lakeId, 'id%20cu%20spa%C8%9Bii%3Cscript%3E'),
      waterCard.replace('/2245/', '/99999999/'),
    ]) {
      const body = await expectCard(request, path);
      expect(body.length).toBeGreaterThan(5_000);
    }
    const competitionId = await firstCompetition(request, 'completed');
    if (competitionId) {
      const card = new URL((await metaOf(request, `/concursuri/${competitionId}`))['twitter:image'], BASE_URL).pathname;
      await expectCard(request, card.replace(competitionId, 'nuexistaacestconcurs0000'));
    }
  });
  test('a1 — every key public route has an absolute og:image AND twitter:image (route groups and subpages included)', async ({ request }) => {
    // 2026-10-10: /partide (page in (hub)), /pescari/[id] (page in (profil)), /partide/exploreaza and
    // /cookie-uri set `openGraph`, which replaced the parent segment's file-based images: no og:image.
    const index = await cmsJson<{ data: { documentId: string }[] } | { documentId: string }[]>(request, '/feed/lakes/index');
    const lake = (Array.isArray(index) ? index : index.data)[0]?.documentId;
    const competition = await firstCompetition(request, 'completed');
    const partida = await firstPartida(request);
    const news = (await cmsJson<{ data: { documentId: string }[] }>(request, '/feed/announcements?pagination%5Bpage%5D=1&pagination%5BpageSize%5D=1')).data[0]?.documentId;
    const routes = [
      '/',
      '/concursuri',
      competition && `/concursuri/${competition}`,
      '/balti',
      lake && `/balti/${lake}`,
      '/ape-publice/2245',
      '/partide',
      '/partide/exploreaza',
      partida && `/partide/${partida}`,
      // A known local angler: the page renders with or without the CMS's public header (PR #113).
      '/pescari/vsfh2zhq9fkie6njt0ciok5u',
      news && `/stiri/${news}`,
      '/cookie-uri',
    ].filter((r): r is string => !!r);
    expect(routes.length, 'the local CMS has a lake, a competition, a partidă and a news item').toBe(12);
    for (const route of routes) {
      const meta = await metaOf(request, route);
      for (const key of ['og:image', 'twitter:image'] as const) {
        const url = meta[key];
        expect(url, `${route} ${key}`).toBeTruthy();
        expect(url, `${route} ${key} is absolute`).toMatch(/^https?:\/\//);
        expect(SITE_ORIGINS, `${route} ${key} on the site's host (${url})`).toContain(new URL(url).origin);
      }
      if (route === '/') continue; // Acasă names og-home.jpg itself (the a1 Acasă test above)
      // A page under a route group carries ITS route's card, not the root one.
      expect(new URL(meta['og:image']).pathname.startsWith(`${route}/opengraph-image`), `${route} own card: ${meta['og:image']}`).toBe(true);
      await expectCard(request, meta['og:image']);
    }
  });
});
