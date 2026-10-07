import { describe, expect, it } from 'vitest';
import type { TransportRequest } from '@/core/transport';
import { createFakeTransport } from '@/tests/transport';
import {
  LAKES_PER_CHUNK,
  MAX_URLS,
  WATERS_PER_CHUNK,
  competitionViewHas,
  hasCompetitions,
  lakeUrls,
  publicWaterEntries,
  sitemapChunk,
  venueSubpageHas,
  sitemapEntries,
  sitemapIds,
  type LakeFacts,
  type VenueFacts,
} from './sitemap-entries';

/*
 * The sitemap builders over a fake transport (global.b.seo-sitemap): which subpages are listed for
 * which data, the split into sitemaps, and what a failed read leaves out.
 */

const S = 'http://localhost:3000';
const page = (data: unknown[], pageCount = 1, p = 1) => ({ data, meta: { pagination: { page: p, pageSize: 100, pageCount, total: data.length } } });
const EMPTY = page([], 0);

const lakeDetail = (over: Record<string, unknown> = {}) => ({
  id: 1,
  documentId: 'lk1',
  name: 'Balta Test',
  county: null,
  countyRef: null,
  cityRef: null,
  regime: null,
  reviewsMeta: { quality: 4, facilities: 3, atmosphere: 5, count: 2, overall: 4 },
  images: [{ url: 'https://x/a.jpg', mediumUrl: null, smallUrl: null }],
  facility: [],
  fishSpecies: [],
  description: null,
  address: null,
  directions: null,
  website: null,
  surface: null,
  depth: null,
  numberOfSeats: null,
  fishingType: null,
  fishingSpotTypes: null,
  price: [],
  contact: [],
  coordinates: { lat: '44.1', long: '26.1' },
  stands: [],
  bookingEnabled: false,
  incrementHours: null,
  minDurationHours: null,
  checkoutBufferMinutes: null,
  slotStartTimes: [],
  paymentMode: null,
  depositPercent: null,
  confirmationMode: null,
  cancellationPolicy: null,
  regulationUrl: null,
  ...over,
});

const stats = (partide: number) => ({
  period: 'month',
  totals: { partide, anglers: partide ? 2 : 0, catches: partide * 3, totalKg: partide * 4.5 },
  weeklySeries: [],
  topAnglers: partide ? [{ uid: 'u1', name: 'Ion', avatarUrl: null, partide: 2, catches: 3, totalKg: 9.5 }] : [],
  topVenues: [],
  record: null,
  species: [],
  stands: partide ? [{ standId: 's1', name: 'Standul 1', partide: 1, catches: 2, totalKg: 3, recordKg: 2 }] : [],
});

const catchRow = {
  clientId: 'c1',
  sessionDocumentId: 'p1',
  species: 'Crap',
  weightKg: 1.4,
  photoUrl: 'https://x/c.jpg',
  photoGridUrl: null,
  photoThumbUrl: null,
  photoWidth: null,
  photoHeight: null,
  occurredAt: '2026-07-30T17:35:22.828Z',
  angler: { uid: 'u1', name: 'Ion', avatarUrl: null },
};

/** The public water with community activity in the fake CMS. */
const WATER = 'R:RO11_01.018_R1';
const historyRow = (key: string) => ({
  documentId: `h-${key}`,
  startedAt: '2026-09-01T06:00:00Z',
  endedAt: '2026-09-01T18:00:00Z',
  members: [],
  venue: { key, venueType: key.startsWith('lake:') ? 'lake' : 'publicWater', lakeId: null, name: 'Apă', locality: null, imageUrl: null },
  catchCount: 0,
  maxKg: null,
  totalKg: null,
  photoUrl: null,
});

const listItem = (documentId: string, status: string, over: Record<string, unknown> = {}) => ({
  id: 1,
  documentId,
  name: `Concurs ${documentId}`,
  startDate: '2026-10-17T06:00:00.000Z',
  endDate: '2026-10-17T18:00:00.000Z',
  competitionStatus: status,
  competitionType: 'single',
  rankingType: 'quantity',
  bestOfFishCount: null,
  bestOfTierSizes: null,
  registerFee: null,
  participantsLimit: 10,
  teamParticipants: 1,
  registrationDeadline: null,
  banner: null,
  lake: { id: 1, documentId: 'lk1', name: 'Balta Test', coordinates: null, images: [] },
  viewers: 0,
  registrations: [{ registrationStatus: 'registered', participants: [] }],
  ...over,
});

const sponsor = (documentId: string) => ({ id: 1, documentId, name: `Sponsor ${documentId}`, url: null, description: null, image: null });

const competitionDetail = (documentId: string, regulation: unknown, sponsors: unknown[] = []) => ({
  id: 547,
  documentId,
  name: 'CN Test',
  startDate: '2026-05-09T09:24:49.000Z',
  endDate: '2026-05-12T09:24:49.000Z',
  competitionStatus: 'completed',
  competitionType: 'single',
  rankingType: 'quantity',
  bestOfFishCount: null,
  minFishWeight: null,
  excludeBiggestCatch: false,
  generalRankingWinnerMode: 'bySectorPosition',
  gridRule: null,
  bestOfTierSizes: null,
  numberOfWinners: 1,
  registerFee: null,
  participantsLimit: 18,
  teamParticipants: null,
  registrationDeadline: '2026-05-09T09:24:49.000Z',
  description: null,
  reward: null,
  regulation,
  banner: null,
  lake: null,
  author: null,
  referees: [],
  sponsors,
  fishType: [],
  sectors: [],
  followers: [],
  registrations: [],
  viewers: 3,
});

const weighing = (catchCount: number, i = 1) => ({
  weighingDocumentId: `w${i}`,
  startDate: '2026-05-10T10:00:00.000Z',
  endDate: null,
  weighingType: 'normal',
  sequenceIndex: i,
  totalWeightKg: catchCount * 2.5,
  catchCount,
  standName: '1',
});

/** A CMS with one lake (lk1: data everywhere, lk2: nothing), competitions of every status, a water. */
function cms(req: TransportRequest): unknown {
  const p = req.path;
  if (p === '/feed/lakes/index') {
    return {
      data: [
        { documentId: 'lk1', name: 'Balta Test', locality: null, lat: 44, lng: 26, thumb: null },
        { documentId: 'lk2', name: 'Balta Goală', locality: null, lat: 44, lng: 26, thumb: null },
      ],
    };
  }
  if (p === '/feed/lakes/lk1') return { data: lakeDetail() };
  if (p === '/feed/lakes/lk2') return { data: lakeDetail({ documentId: 'lk2', images: [], reviewsMeta: null, coordinates: null }) };
  if (p === '/feed/community/stats') return { data: stats(req.query?.venue === 'lake:lk1' || req.query?.venue === `water:${WATER}` ? 3 : 0) };
  if (p.startsWith('/feed/community/history')) {
    const venue = new URLSearchParams(p.split('?')[1]).get('venue');
    // One venue's count (pageSize 1): lk1 and the active water have partide on record, the claimed one too.
    if (venue) {
      const total = ['lake:lk1', `water:${WATER}`, 'water:L:CLAIMED'].includes(venue) ? 2 : 0;
      return { data: [], meta: { pagination: { page: 1, pageSize: 1, pageCount: total, total } } };
    }
    // The whole history (the walk): partide at a lake, at the active water and at the claimed one.
    return page([historyRow('lake:lk1'), historyRow(`water:${WATER}`), historyRow('water:L:CLAIMED')]);
  }
  if (p === `/feed/community/waters/${encodeURIComponent(WATER)}/catches`) return page([catchRow]);
  if (p === '/feed/community/lakes/lk1/catches') return page([catchRow]);
  if (p === '/feed/community/lakes/lk2/catches') return EMPTY;
  if (p === '/feed/competitions') {
    const s = req.query?.status;
    if (s === 'notStarted') return page([listItem('cv1', 'notStarted', { registrations: [] })]);
    if (s === 'started') return page([listItem('cl1', 'started')]);
    return page([listItem('cr1', 'completed', { lake: null })]);
  }
  if (p === '/feed/competitions/cr1') return { data: competitionDetail('cr1', [{ type: 'paragraph', children: [{ type: 'text', text: 'Art. 1' }] }], [sponsor('sp1'), sponsor('sp2')]) };
  if (p === '/feed/competitions/cl1') return { data: competitionDetail('cl1', null) };
  // Weighing statistics: cr1 weighed with catches; cl1 (live) not weighed yet.
  if (p === '/competitions/cr1/weighing-statistics') return { data: [weighing(3), weighing(0, 2)] };
  if (p === '/competitions/cl1/weighing-statistics') return { data: [] };
  if (p === '/feed/competitions/cv1') throw new Error('down');
  if (p === '/feed/announcements') return page([{ documentId: 'n1', title: 't', shortDescription: null, category: 'Noutati', createdAt: '2026-09-01T00:00:00Z', banner: null }]);
  if (p === '/feed/sponsors/dashboard') return { data: [{ documentId: 'sp1', name: 'Sponsor', url: null, image: null }] };
  if (p === '/feed/public-waters/claimed') return { data: [{ linkCode: 'L:CLAIMED', lakeDocumentId: 'lk1' }] };
  return EMPTY;
}

const urlsOf = async (keys?: () => (string | number)[]) => {
  const { transport, calls } = createFakeTransport(cms);
  return { urls: (await sitemapEntries(transport, keys)).map(e => e.url), calls };
};

describe('sitemapEntries', () => {
  it('lists the list pages, news (with lastModified) and sponsors', async () => {
    const { transport } = createFakeTransport(cms);
    const entries = await sitemapEntries(transport);
    const urls = entries.map(e => e.url);
    for (const path of ['/', '/balti', '/balti/harta', '/ape-publice', '/concursuri', '/concursuri/live', '/concursuri/viitoare', '/concursuri/rezultate', '/stiri']) {
      expect(urls).toContain(`${S}${path}`);
    }
    expect(urls).toContain(`${S}/sponsori/sp1`);
    // s2: a sponsor attached to a competition but not on the dashboard is listed too, once.
    expect(urls).toContain(`${S}/sponsori/sp2`);
    expect(urls.filter(u => u === `${S}/sponsori/sp1`)).toHaveLength(1);
    expect(entries.find(e => e.url === `${S}/stiri/n1`)?.lastModified).toBe('2026-09-01T00:00:00Z');
  });

  it('lists a lake with every subpage it has data for, and a lake without data alone', async () => {
    const { urls } = await urlsOf();
    for (const sub of ['', '/galerie', '/capturi', '/partide', '/statistici', '/clasament', '/standuri', '/concursuri', '/recenzii', '/harta']) {
      expect(urls).toContain(`${S}/balti/lk1${sub}`);
    }
    expect(urls.filter(u => u.startsWith(`${S}/balti/lk2`))).toEqual([`${S}/balti/lk2`]);
  });

  it('lists competitions with their tabs by what each has, never the noindex views', async () => {
    const { urls } = await urlsOf();
    // Upcoming, nobody registered, detail read failed: the page and Informații only.
    expect(urls.filter(u => u.includes('/concursuri/cv1'))).toEqual([`${S}/concursuri/cv1`, `${S}/concursuri/cv1/informatii`]);
    // Live, registered entrants, no regulation, nothing weighed yet: + Participanți — no empty
    // Cântare / Toți peștii (rule 4, the views' noindex predicate competitionViewHas).
    expect(urls.filter(u => u.includes('/concursuri/cl1')).sort()).toEqual(
      ['', '/informatii', '/participanti'].map(s => `${S}/concursuri/cl1${s}`).sort(),
    );
    // Completed with a regulation and weighings with catches: + Regulament, Cântare, Toți peștii.
    for (const sub of ['/regulament', '/cantare', '/capturi']) expect(urls).toContain(`${S}/concursuri/cr1${sub}`);
    expect(urls.some(u => /\/(statistici|clasament|extra-cantare)$|\/imagine|cronologie/.test(u) && u.includes('/concursuri/c'))).toBe(false);
  });

  const w = (k: string | number, sub = '') => `${S}/ape-publice/${encodeURIComponent(k)}${sub}`;

  it('lists public waters: community subpages only with content; claimed → no page; row id → the page alone; never the map', async () => {
    const { urls } = await urlsOf(() => [WATER, 'L:CLAIMED', 'L:QUIET', 42]);
    // Partide this month, ranked anglers, catches: every subpage.
    for (const sub of ['', '/partide', '/statistici', '/clasament', '/capturi']) expect(urls).toContain(w(WATER, sub));
    // Claimed, partide on record but none this month / year and no catches: its Partide (the history) alone.
    expect(urls.filter(u => u.startsWith(w('L:CLAIMED')))).toEqual([w('L:CLAIMED', '/partide')]);
    // No partida on record: the page alone, no empty community subpage.
    expect(urls.filter(u => u.startsWith(w('L:QUIET')))).toEqual([w('L:QUIET')]);
    expect(urls.filter(u => u.startsWith(w(42)))).toEqual([w(42)]);
    // The full map is noindex (the water page embeds it): never listed.
    expect(urls.filter(u => u.startsWith(`${S}/ape-publice/`) && u.endsWith('/harta'))).toEqual([]);
  });

  it('s4: a failed claimed read leaves out the page and map of every linkCode water (they may redirect)', async () => {
    const { transport } = createFakeTransport(req => {
      if (req.path === '/feed/public-waters/claimed') throw new Error('down');
      return cms(req);
    });
    const urls = (await sitemapChunk(transport, 'ape-publice-0', () => [WATER, 'L:CLAIMED', 42])).map(e => e.url);
    expect(urls).not.toContain(w(WATER));
    expect(urls).not.toContain(w('L:CLAIMED'));
    expect(urls).toContain(w(WATER, '/partide'));
    expect(urls).toContain(w(42));
  });

  it('s4: a failed history walk lists no water community subpage', async () => {
    const { transport } = createFakeTransport(req => {
      if (req.path.startsWith('/feed/community/history')) throw new Error('down');
      return cms(req);
    });
    const urls = (await sitemapChunk(transport, 'ape-publice-0', () => [WATER])).map(e => e.url);
    expect(urls).toEqual([w(WATER)]);
  });

  it('never lists a view param (period, sort, tab, photo)', async () => {
    const { urls } = await urlsOf(() => ['R:X']);
    expect(urls.every(u => !u.includes('?'))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('keeps the rest when one list fails', async () => {
    const { transport } = createFakeTransport(req => {
      if (req.path === '/feed/lakes/index') throw new Error('down');
      return EMPTY;
    });
    const urls = (await sitemapEntries(transport)).map(e => e.url);
    expect(urls).toContain(`${S}/balti`);
    expect(urls.filter(u => u.startsWith(`${S}/balti/`))).toEqual([`${S}/balti/harta`]);
  });

  it('reads one competitions page per status within the MAX_PAGES guard', async () => {
    const { calls } = await urlsOf();
    const statuses = calls.filter(c => c.path === '/feed/competitions').map(c => c.query?.status);
    expect(new Set(statuses)).toEqual(new Set(['notStarted', 'started', 'completed']));
  });
});

describe('the sitemap split', () => {
  it('names one sitemap per group, lakes and waters chunked', async () => {
    const { transport } = createFakeTransport(cms);
    const keys = Array.from({ length: WATERS_PER_CHUNK + 1 }, (_, i) => i + 1);
    expect(await sitemapIds(transport, () => keys)).toEqual(['pagini', 'balti-0', 'concursuri-viitoare', 'concursuri-live', 'concursuri-rezultate', 'ape-publice-0', 'ape-publice-1']);
    expect(await sitemapIds(transport)).not.toContain('ape-publice-0');
  });

  it('serves each chunk its own slice, under MAX_URLS', async () => {
    const { transport } = createFakeTransport(cms);
    const keys = Array.from({ length: WATERS_PER_CHUNK + 3 }, (_, i) => i + 1);
    const second = await sitemapChunk(transport, 'ape-publice-1', () => keys);
    expect(second.map(e => e.url)).toEqual(
      [WATERS_PER_CHUNK + 1, WATERS_PER_CHUNK + 2, WATERS_PER_CHUNK + 3].map(k => `${S}/ape-publice/${k}`),
    );
    expect((await sitemapChunk(transport, 'ape-publice-0', () => keys)).length).toBeLessThanOrEqual(MAX_URLS);
    expect(await sitemapChunk(transport, 'balti-1')).toEqual([]);
    expect(await sitemapChunk(transport, 'nimic')).toEqual([]);
    expect(LAKES_PER_CHUNK * 9).toBeLessThanOrEqual(MAX_URLS);
    expect(WATERS_PER_CHUNK * 5).toBeLessThanOrEqual(MAX_URLS);
  });
});

describe('lakeUrls', () => {
  const none: LakeFacts = { lake: null, stats: null, catches: null, history: null, hasCompetitions: false };
  it('a lake whose reads all failed is listed alone (nothing guessed in)', () => {
    expect(lakeUrls('x', none).map(e => e.url)).toEqual([`${S}/balti/x`]);
  });
  it('stats with partide but no stands: no /standuri', () => {
    const s = { ...stats(1), stands: [] } as unknown as LakeFacts['stats'];
    const urls = lakeUrls('x', { ...none, stats: s }).map(e => e.url);
    expect(urls).toContain(`${S}/balti/x/statistici`);
    expect(urls).not.toContain(`${S}/balti/x/standuri`);
  });
  it('/concursuri only when a competition is known to be at the lake (hasCompetitions)', () => {
    expect(lakeUrls('x', { ...none, hasCompetitions: true }).map(e => e.url)).toContain(`${S}/balti/x/concursuri`);
    expect(lakeUrls('x', { ...none, hasCompetitions: null }).map(e => e.url)).not.toContain(`${S}/balti/x/concursuri`);
  });
});

describe('hasCompetitions (shared with /balti/<id>/concursuri noindex)', () => {
  it('true when found, false only when every list was read, else unknown', () => {
    expect(hasCompetitions('lk1', { lakes: new Set(['lk1']), complete: false })).toBe(true);
    expect(hasCompetitions('lk2', { lakes: new Set(['lk1']), complete: true })).toBe(false);
    expect(hasCompetitions('lk2', { lakes: new Set(['lk1']), complete: false })).toBe(null);
  });
});

describe('competitionViewHas (shared with /cantare, /capturi noindex)', () => {
  it('Cântare needs a weighing, Toți peștii a catch; a failed read is unknown', () => {
    expect(competitionViewHas('cantare', { weighings: 0, catches: 0 })).toBe(false);
    expect(competitionViewHas('capturi', { weighings: 0, catches: 0 })).toBe(false);
    // A weighing without fish: Cântare shows it, Toți peștii has nothing.
    expect(competitionViewHas('cantare', { weighings: 1, catches: 0 })).toBe(true);
    expect(competitionViewHas('capturi', { weighings: 1, catches: 0 })).toBe(false);
    expect(competitionViewHas('capturi', { weighings: 2, catches: 3 })).toBe(true);
    expect(competitionViewHas('cantare', { weighings: null, catches: null })).toBe(null);
  });
  it('a started competition whose weighing read fails lists neither view (never guessed in)', async () => {
    const { transport } = createFakeTransport(req => {
      if (req.path.endsWith('/weighing-statistics')) throw new Error('down');
      return cms(req);
    });
    const urls = (await sitemapChunk(transport, 'concursuri-rezultate')).map(e => e.url);
    expect(urls).toContain(`${S}/concursuri/cr1`);
    expect(urls.filter(u => /\/(cantare|capturi)$/.test(u))).toEqual([]);
  });
});

describe('venueSubpageHas (shared with the subpages\' noindex)', () => {
  const s0 = stats(0) as unknown as VenueFacts['stats'];
  const s3 = stats(3) as unknown as VenueFacts['stats'];
  it('true with content, false when every read says empty, null when a deciding read failed', () => {
    expect(venueSubpageHas('statistici', { stats: s3, catches: 0, history: 0 })).toBe(true);
    expect(venueSubpageHas('statistici', { stats: s0, catches: 0, history: 0 })).toBe(false);
    expect(venueSubpageHas('statistici', { stats: null, catches: 5, history: 1 })).toBe(null);
    expect(venueSubpageHas('clasament', { stats: s0, catches: 3, history: 1 })).toBe(false);
    expect(venueSubpageHas('standuri', { stats: s3, catches: 0, history: 0 })).toBe(true);
    expect(venueSubpageHas('capturi', { stats: s3, catches: 0, history: 0 })).toBe(false);
    expect(venueSubpageHas('galerie', { stats: null, catches: null, history: null }, 2)).toBe(true);
    // Partide: the live partide, the catches or the history — any one is content.
    expect(venueSubpageHas('partide', { stats: s0, catches: 0, history: 4 })).toBe(true);
    expect(venueSubpageHas('partide', { stats: s0, catches: 0, history: 0 })).toBe(false);
    expect(venueSubpageHas('partide', { stats: s0, catches: 0, history: null })).toBe(null);
    // Galerie: the lake's photos or the catches; neither → empty.
    expect(venueSubpageHas('galerie', { stats: s0, catches: 0, history: 0 }, 0)).toBe(false);
  });

  it('a stats page is judged by the widest period: a quiet month with a year of partide is not empty', () => {
    // The month is quiet, the year is not: listed (and indexable) — it no longer flips every month.
    for (const page of ['statistici', 'clasament', 'standuri'] as const) {
      expect(venueSubpageHas(page, { stats: s0, year: s3, catches: 0, history: 4 }), page).toBe(true);
      expect(venueSubpageHas(page, { stats: s0, year: s0, catches: 0, history: 0 }), page).toBe(false);
      // The year read failed and the month is empty: unknown (never noindexed on a hiccup).
      expect(venueSubpageHas(page, { stats: s0, year: null, catches: 0, history: 0 }), page).toBe(null);
      // The month has content (the 30-day window can reach into last year while the year is empty).
      expect(venueSubpageHas(page, { stats: s3, year: s0, catches: 0, history: 0 }), page).toBe(true);
    }
    expect(venueSubpageHas('partide', { stats: s0, year: s3, catches: 0, history: 0 })).toBe(true);
  });
});

describe('publicWaterEntries', () => {
  it('encodes the linkCode', () => {
    expect(publicWaterEntries(['R:A.1'])[0].url).toBe(`${S}/ape-publice/R%3AA.1`);
  });
});
