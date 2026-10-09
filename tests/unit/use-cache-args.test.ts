import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * m8.cache-warming — «Unexpected cache miss after cache warming phase» in the production build.
 *
 * Root cause: a 'use cache' entry whose expire is under 5 minutes (cacheLife('seconds')), read back
 * from the shared cache handler because a sibling page filled it first, is not saved to the page's
 * resume cache; the final prerender pass misses that key and warns (next use-cache-wrapper.js,
 * MIN_PRERENDERABLE_EXPIRE). So:
 * - no OG model may ever be kept under 'minutes' — above all for the placeholder ids ('_', '')
 *   that many prerendered pages share, and for a water the bundled dataset does not have;
 * - a public GET whose path names the placeholder id never becomes a cache entry nor a CMS request;
 * - the keys themselves are canonical (same input → identical JSON).
 */

const cacheLife = vi.fn();
vi.mock('next/cache', () => ({ cacheLife: (...a: unknown[]) => cacheLife(...a), cacheTag: () => {} }));

const loaders = {
  getLake: vi.fn(),
  loadCompetition: vi.fn(),
  loadPublicWater: vi.fn(),
  loadNews: vi.fn(),
  loadSponsor: vi.fn(),
};
vi.mock('@/core/lakes', () => ({ getLake: (_t: unknown, id: string) => loaders.getLake(id) }));
vi.mock('@/core/competitions', () => ({ getRankings: vi.fn() }));
vi.mock('@/lib/server/transport', () => ({ createServerTransport: () => ({}) }));
vi.mock('@/app/(site)/concursuri/_list/desktop/model', () => ({ miniRanking: vi.fn() }));
vi.mock('@/app/(site)/concursuri/[id]/_components/load', () => ({ loadCompetition: (id: string) => loaders.loadCompetition(id) }));
vi.mock('@/app/(site)/balti/[id]/_components/priceFrom', () => ({ lakePriceFrom: vi.fn() }));
vi.mock('@/app/(site)/ape-publice/_server/load', () => ({ loadPublicWater: (id: string) => loaders.loadPublicWater(id) }));
vi.mock('@/app/(site)/ape-publice/_components/map/outline', () => ({ waterOutline: vi.fn() }));
vi.mock('@/app/(site)/stiri/_content/load', () => ({
  loadNews: (id: string) => loaders.loadNews(id),
  loadSponsor: (id: string) => loaders.loadSponsor(id),
}));
vi.mock('@/app/(site)/stiri/_content/content', () => ({ sponsorImage: vi.fn() }));
vi.mock('@/lib/server/og/render', () => ({ ogTokens: async () => ({}), readPicture: vi.fn(), renderCard: vi.fn() }));
vi.mock('@/lib/server/og/layout', () => ({ mediaWidth: vi.fn() }));
vi.mock('@/lib/server/og/model', () => ({
  entityAlt: (_k: unknown, card: unknown) => (card ? 'card' : 'brand'),
  FALLBACK: {},
  brandCard: vi.fn(),
  competitionCard: vi.fn(),
  competitionPhoto: vi.fn(),
  lakeCard: vi.fn(),
  lakePhoto: vi.fn(),
  newsCard: () => ({ kind: 'news' }),
  podiumNames: vi.fn(),
  sponsorCard: vi.fn(),
  waterCard: vi.fn(),
}));

const { cachedPublicGet, isPlaceholderId, PLACEHOLDER_IDS, placeholderAnswer, publicGetArgs } = await import('@/lib/server/public-get');
const og = await import('@/lib/server/og/images');
const { ogAlt, ogModelArgs, unreadLife } = og;

type Kind = 'lake' | 'competition' | 'water' | 'news' | 'sponsor';
const KINDS: Kind[] = ['lake', 'competition', 'water', 'news', 'sponsor'];
const REAL_ID = 'vtsek21vacfaks9suvzdmd2t';

/** A network failure (not an ApiError): `within` reads it as transient. */
const offline = () => Promise.reject(new TypeError('fetch failed'));

/** The lifetimes the model under test asked for. */
const lives = () => cacheLife.mock.calls.map(c => c[0]);

beforeEach(() => {
  cacheLife.mockClear();
  for (const f of Object.values(loaders)) f.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('unreadLife (how long a brand card answered for an unread entity holds)', () => {
  it('a placeholder id or a non-id is kept max, for every kind and every miss', () => {
    for (const kind of KINDS) {
      for (const id of [...PLACEHOLDER_IDS, 'not an id!', 'x'.repeat(200)]) {
        expect(unreadLife(kind, id, 'absent'), `${kind} ${JSON.stringify(id)}`).toBe('max');
        expect(unreadLife(kind, id, 'transient'), `${kind} ${JSON.stringify(id)}`).toBe('max');
      }
    }
  });

  it('a water the bundled dataset does not have is kept max', () => {
    expect(unreadLife('water', 'ro-123', 'absent')).toBe('max');
  });

  it('only a real id that is missing in the CMS or read transiently is short — and still prerenderable', () => {
    for (const kind of KINDS) {
      expect(unreadLife(kind, REAL_ID, 'transient')).toBe('minutes');
      if (kind !== 'water') expect(unreadLife(kind, REAL_ID, 'absent')).toBe('minutes');
    }
  });
});

describe('the OG models (cacheLife each one asks for)', () => {
  it('a placeholder id: the alt is the brand alt with no cache entry; the image (model + drawing) is kept max', async () => {
    const images: Record<Kind, (id: string) => Promise<unknown>> = {
      lake: id => og.lakeImage(id, 'Partide'),
      competition: id => og.competitionImage(id, null),
      water: id => og.waterImage(id, 'Capturi'),
      news: id => og.newsImage(id),
      sponsor: id => og.sponsorImageCard(id),
    };
    for (const kind of KINDS) {
      for (const id of PLACEHOLDER_IDS) {
        cacheLife.mockClear();
        expect(await ogAlt(kind, id, 'Recenzii')).toBe('brand');
        expect(lives(), `alt ${kind} ${JSON.stringify(id)}`).toEqual([]);
        await images[kind](id);
        expect(lives(), `image ${kind} ${JSON.stringify(id)}`).toEqual(['max', 'max']);
      }
    }
    for (const f of Object.values(loaders)) expect(f).not.toHaveBeenCalled();
  });

  it('a water the dataset does not have is the brand card kept max', async () => {
    loaders.loadPublicWater.mockResolvedValue({ kind: 'missing' });
    expect(await ogAlt('water', 'ro-123')).toBe('brand');
    expect(lives()).toEqual(['max']);
  });

  it('a missing CMS entity is kept minutes (its tag refreshes it), never seconds', async () => {
    loaders.loadCompetition.mockResolvedValue({ kind: 'missing' });
    loaders.loadNews.mockResolvedValue({ kind: 'missing' });
    loaders.loadSponsor.mockResolvedValue({ kind: 'missing' });
    for (const kind of ['competition', 'news', 'sponsor'] as const) {
      cacheLife.mockClear();
      expect(await ogAlt(kind, REAL_ID)).toBe('brand');
      expect(lives(), kind).toEqual(['minutes']);
    }
  });

  it('a transient failure is kept minutes, never seconds', async () => {
    for (const f of Object.values(loaders)) f.mockImplementation(offline);
    for (const kind of KINDS) {
      cacheLife.mockClear();
      expect(await ogAlt(kind, REAL_ID)).toBe('brand');
      expect(lives(), kind).toEqual(['minutes']);
    }
  });

  it('in the production build a transiently failed read is tried once more', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    loaders.loadNews.mockImplementationOnce(offline).mockResolvedValueOnce({ kind: 'ok', data: { banner: [] } });
    expect(await ogAlt('news', REAL_ID)).toBe('card');
    expect(loaders.loadNews).toHaveBeenCalledTimes(2);
    expect(lives()).toEqual(['hours']);
  });

  it('a visitor request does not retry', async () => {
    loaders.loadNews.mockImplementation(offline);
    await ogAlt('news', REAL_ID);
    expect(loaders.loadNews).toHaveBeenCalledTimes(1);
  });
});

describe('placeholder public GETs (cachedPublicGet)', () => {
  it('a path naming the placeholder id is the CMS 404, answered without a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const url of [
      'http://localhost:1337/api/feed/community/sessions/_',
      'http://localhost:1337/api/feed/competitions/_/rankings?x=1',
      'http://localhost:1337/api/feed/anglers/_/profile',
    ]) {
      const res = await cachedPublicGet(url, { 'x-app-platform': 'web' });
      expect(res.ok).toBe(false);
      expect(res.status).toBe(404);
      expect(JSON.parse(res.body).error.name).toBe('NotFoundError');
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('real ids and query values containing «_» are left to the CMS', () => {
    expect(placeholderAnswer('http://cms/api/feed/competitions/vtsek21_vacf')).toBeNull();
    expect(placeholderAnswer('http://cms/api/feed/lakes/index?sort=_')).toBeNull();
    expect(placeholderAnswer('http://cms/api/feed/community/history?venue=lake%3A_')).toBeNull();
    expect(placeholderAnswer('not a url')).toBeNull();
  });

  it('knows the placeholder ids', () => {
    expect(isPlaceholderId('_')).toBe(true);
    expect(isPlaceholderId('')).toBe(true);
    expect(isPlaceholderId(REAL_ID)).toBe(false);
  });
});

describe('publicGetArgs (cachedPublicGet key)', () => {
  it('is identical across calls and across header key order', () => {
    const a = publicGetArgs('http://cms/api/feed/lakes/index', { 'x-app-version': '2.0.0', 'x-app-platform': 'web' });
    const b = publicGetArgs('http://cms/api/feed/lakes/index', { 'x-app-platform': 'web', 'x-app-version': '2.0.0' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(publicGetArgs('http://cms/api/feed/lakes/index', { 'x-app-version': '2.0.0', 'x-app-platform': 'web' })));
  });

  it('never reorders the URL (the query order is the request the CMS and Cloudflare see)', () => {
    const url = 'http://cms/api/feed/community/history?page=1&pageSize=10&venue=lake%3Aabc';
    expect(publicGetArgs(url, {})[0]).toBe(url);
  });

  it('carries only plain strings (serialisable, no transport objects)', () => {
    const [url, headers] = publicGetArgs('http://cms/x', { b: '2', a: '1' });
    expect(typeof url).toBe('string');
    expect(Object.getPrototypeOf(headers)).toBe(Object.prototype);
    expect(Object.keys(headers)).toEqual(['a', 'b']);
  });
});

describe('ogModelArgs (OG model / image key)', () => {
  it('is identical across calls', () => {
    expect(JSON.stringify(ogModelArgs('3506', 'Capturi'))).toBe(JSON.stringify(ogModelArgs('3506', 'Capturi')));
  });

  it('an absent label is an explicit null, never undefined', () => {
    expect(ogModelArgs('3506', undefined)).toEqual(['3506', null]);
    expect(JSON.stringify(ogModelArgs('3506', undefined))).toBe(JSON.stringify(ogModelArgs('3506', null)));
  });

  it('an absent id (an image route without params) is the empty string', () => {
    expect(ogModelArgs(undefined, 'Hartă')).toEqual(['', 'Hartă']);
  });
});
