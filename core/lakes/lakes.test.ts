import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { buildPath } from '../transport';
import * as api from './api';
import { EMPTY_LAKE_FILTERS, DEFAULT_LAKES_COMMITTED_SEARCH, type LakeFilterValues } from './domain/filters';
import {
  applyEditToLakePages,
  createAnglerReviewMutation,
  editReviewMutation,
  invalidateReviewQueries,
  postReviewMutation,
} from './mutations';
import * as q from './queries';
import type { GetReviewsForLakeResponse, Review } from './schemas';

/* ---------------------------------------------------------------- fixtures (trimmed real payloads) */

const meta = { count: 1, overall: 4.33, quality: 5, atmosphere: 3, facilities: 5 };
const card = {
  id: 212,
  documentId: 's84u55lo4n9z0emngozttt6e',
  name: 'Chita Lake',
  county: 'Test',
  countyRef: { id: 19, documentId: 'njf0', name: 'Giurgiu' },
  cityRef: null,
  regime: 'C&R',
  reviewsMeta: meta,
  images: [{ url: 'https://x/a.jpg', mediumUrl: 'https://x/m.jpg', smallUrl: null, thumbnailUrl: null, blurhash: 'Lx' }],
  facility: [{ id: 1, name: 'Pontoane' }],
  fishSpecies: [{ id: 1232, fish: { documentId: 'ohvf', Name: 'Babusca' } }],
};
const pagination = { page: 1, pageSize: 3, total: 1, pageCount: 1 };
const cardList = { data: [card], meta: { pagination } };
const detail = {
  ...card,
  images: [{ url: 'https://x/a.jpg', mediumUrl: null, smallUrl: null, blurhash: null }],
  reviewsMeta: null,
  description: [{ type: 'paragraph', children: [{ type: 'text', text: 'Descriere' }] }],
  address: 'Str. Mare',
  directions: null,
  website: null,
  surface: 10,
  depth: null,
  numberOfSeats: 21,
  fishingType: 'Sportiv',
  fishingSpotTypes: 'Pontoane',
  acceptsReservations: false,
  isVerified: true,
  price: [{ id: 1, header: '24h', description: null, price: 120 }],
  contact: [{ id: 1, header: 'Admin', name: 'Ion', phone: '07' }],
  coordinates: { lat: '44.08', long: '25.66' },
  stands: [{ id: 1, documentId: 'st1', name: '1', performanceScore: 15.5, competitionsCount: 1, coordinates: null }],
  bookingEnabled: true,
  incrementHours: 12,
  minDurationHours: 12,
  checkoutBufferMinutes: 30,
  slotStartTimes: ['07:00'],
  paymentMode: 'offline',
  depositPercent: null,
  confirmationMode: 'manual',
  cancellationPolicy: { type: 'flexible', refundWindowHours: 24, notes: null },
  regulationUrl: null,
  hasOwner: true,
  ownerName: 'Andrew',
  ownerDocumentId: 'pnn9',
};
const legacyLake = {
  id: 229,
  documentId: 'mvjl',
  name: 'Iaz Suharau',
  county: 'Test',
  regime: 'C&R',
  reviewsMeta: null,
  coordinates: { id: 3, lat: '48.1', long: '26.4' },
  images: [{ id: 49, url: 'https://x/a.jpg', formats: { small: { url: 'https://x/s.jpg' } } }],
  facility: [],
  fishSpecies: [{ id: 1, quality: null, fish: { id: 29, documentId: 'pjwh', Name: 'Buffalo', Image: null } }],
  countyRef: { id: 7, documentId: 'y7hh', name: 'Botosani' },
  cityRef: null,
};
const lakeNode = {
  type: 'lake',
  documentId: 'en9s',
  name: 'Cenusaru',
  county: 'Test',
  regime: 'C&R',
  countyRef: { documentId: 'sis5', name: 'Teleorman' },
  cityRef: null,
  images: [{ documentId: 'd2p8', url: 'https://x/a.jpg', formats: { medium: { url: 'https://x/m.jpg' } } }],
  reviewsMeta: null,
  coordinate: { latitude: 44.17, longitude: 25.56 },
  priceMin: null,
  priceMax: null,
};
const clusterNode = {
  type: 'cluster',
  clusterId: '168',
  count: 45,
  coordinate: { latitude: 44.5, longitude: 26.3 },
  bbox: { north: 44.6, south: 44.2, east: 26.6, west: 25.9 },
};
const review: Review = {
  id: 114,
  documentId: 'h4wv',
  comment: 'Loc excelent',
  quality: 5,
  facilities: 5,
  atmosphere: 3,
  recommendToOthers: true,
  createdAt: '2026-06-13T16:00:47.948Z',
  author: { id: 146, documentId: 'pnn9', username: 'Andrew', avatar: { url: 'https://x/av.png', thumbnailUrl: null } },
  verified: false,
};
const anglerReview = {
  stars: 5,
  comment: null,
  authorName: 'Op',
  lakeName: 'Chita Lake',
  createdAt: '2026-09-01T00:00:00.000Z',
  rulesScore: null,
  cleanlinessScore: null,
  behaviorScore: null,
  tags: ['punctual'],
};
const occupancyDay = { date: '2026-09-27', booked: 0, total: 21 };
const operatorStats = {
  occupancyByDay: [occupancyDay],
  occupancyNow: { booked: 0, total: 21 },
  pending: 0,
  today: [
    {
      standName: '3',
      anglerName: 'Ion',
      anglerAvatar: null,
      startDate: '2026-09-27T06:00:00.000Z',
      endDate: '2026-09-28T06:00:00.000Z',
      bookingStatus: 'confirmed',
      priceTotal: 120,
      noShow: false,
      code: 'AB12',
      documentId: 'bk1',
      balanceDue: 120,
      contactPhone: null,
      anglerDocumentId: null,
      reviewedByOperator: false,
      extraLabels: [],
    },
  ],
  cancelledLast24h: 0,
  deIncasatAzi: 0,
  deIncasat7z: 0,
  oldestPending: null,
  days: [{ date: '2026-09-27', booked: 0, total: 21, cash: 0, bookings: 0 }],
  windowTotals: { cash: 0, bookings: 0, occupancyAvgPct: 0 },
  pendingFeedback: 2,
  todayCompetition: null,
};
const ownedStats = {
  pending: 0,
  active: 0,
  cashToCollect: 0,
  reservationsByDay: [{ date: '2026-09-27', count: 0 }],
  reservationsThisWeek: 0,
  reservationsPrevWeek: 0,
  occupancy: { booked: 0, total: 21 },
  oldestPending: null,
  cancelledLast24h: 0,
  coverImageUrl: null,
  pendingFeedback: 2,
};

const filters: LakeFilterValues = {
  selectedFish: [{ id: 'f1', name: 'Crap', documentId: 'f1' }],
  selectedRegimes: [{ id: '1', name: 'C&R', documentId: '1' }],
  selectedFacilities: [
    { id: 'a', name: 'Parcare', documentId: 'a' },
    { id: 'b', name: 'Wi-Fi', documentId: 'b' },
  ],
  ratingTier: 'excellent',
  bookableOnly: true,
};
const BBOX = { north: 46, south: 45, east: 26, west: 25 };

/* ---------------------------------------------------------------- api */

describe('lakes api — /feed/lakes', () => {
  it('getLake unwraps the detail', async () => {
    const { transport, calls } = createFakeTransport([{ data: detail }]);
    await expect(api.getLake(transport, 's84u')).resolves.toMatchObject({ documentId: card.documentId, ownerName: 'Andrew' });
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/lakes/s84u', auth: 'none' });
  });

  it('getLakes searches with q only when there is a term', async () => {
    const { transport, calls } = createFakeTransport([cardList, cardList]);
    await expect(api.getLakes(transport, { page: 2, pageSize: 5, search: 'chita' })).resolves.toEqual(cardList);
    await api.getLakes(transport);
    expect(buildPath(calls[0].path, calls[0].query)).toBe('/feed/lakes/search?q=chita&page=2&pageSize=5');
    expect(buildPath(calls[1].path, calls[1].query)).toBe('/feed/lakes/search?page=1&pageSize=20');
    expect(calls[0].auth).toBe('none');
  });

  it('getFilteredLakes sends facility/fish/regime csv (no tier, no bookable — like fish)', async () => {
    const { transport, calls } = createFakeTransport([cardList]);
    await api.getFilteredLakes(transport, { page: 1, pageSize: 20, filters });
    expect(buildPath(calls[0].path, calls[0].query)).toBe(
      '/feed/lakes/filtered?facilityIds=a%2Cb&fishIds=f1&regimes=C%26R&page=1&pageSize=20'
    );
  });

  it('getLakesIndex and getLakesByDocumentIds', async () => {
    const row = { documentId: 'a', name: 'A', locality: null, lat: 44, lng: 26, thumb: null };
    const { transport, calls } = createFakeTransport([{ data: [row] }, { data: [card] }]);
    await expect(api.getLakesIndex(transport)).resolves.toEqual([row]);
    // Server returns the caller-supplied order; the client passes it through untouched.
    await expect(api.getLakesByDocumentIds(transport, ['lake-1', 'lake-2'])).resolves.toEqual([card]);
    expect(calls[0].path).toBe('/feed/lakes/index');
    expect(buildPath(calls[1].path, calls[1].query)).toBe('/feed/lakes/by-ids?ids=lake-1%2Clake-2');
  });

  it('getLakesByDocumentIds short-circuits an empty list', async () => {
    const { transport, calls } = createFakeTransport();
    await expect(api.getLakesByDocumentIds(transport, [])).resolves.toEqual([]);
    expect(calls).toHaveLength(0);
  });
});

describe('lakes api — map viewport (fish lakesMapFilters.test)', () => {
  it('sends ratingTier on /lakes/map-clusters', async () => {
    const res = { data: [clusterNode, lakeNode], meta: { totalLakes: 46, totalNodes: 2, zoom: 10 } };
    const { transport, calls } = createFakeTransport([res]);
    await expect(api.getLakeMapClusters(transport, { ...BBOX, zoom: 10, filters: { ...EMPTY_LAKE_FILTERS, ratingTier: 'excellent' } })).resolves.toEqual(res);
    expect(buildPath(calls[0].path, calls[0].query)).toContain('ratingTier=excellent');
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/lakes/map-clusters', auth: 'none' });
  });

  it('sends ratingTier on cluster leaves', async () => {
    const leaf = Object.fromEntries(Object.entries(lakeNode).filter(([k]) => k !== 'type'));
    const { transport, calls } = createFakeTransport([{ data: [leaf] }]);
    await api.getLakeMapClusterLeaves(transport, { ...BBOX, zoom: 10, clusterId: '42', filters: { ...EMPTY_LAKE_FILTERS, ratingTier: 'good' } });
    expect(calls[0].path).toBe('/lakes/map-clusters/42/leaves');
    expect(buildPath(calls[0].path, calls[0].query)).toContain('ratingTier=good');
  });

  it('sends ratingTier on /lakes/in-bbox', async () => {
    const res = { data: [legacyLake], meta: { total: 130, page: 1, pageSize: 7, hasMore: true } };
    const { transport, calls } = createFakeTransport([res]);
    await api.getLakesInBbox(transport, { ...BBOX, page: 1, pageSize: 7, filters: { ...EMPTY_LAKE_FILTERS, ratingTier: 'very_good' } });
    expect(buildPath(calls[0].path, calls[0].query)).toBe('/lakes/in-bbox?north=46&south=45&east=26&west=25&page=1&pageSize=7&ratingTier=very_good');
  });

  it('omits ratingTier when no tier is selected, and sends every filter when set', async () => {
    const res = { data: [], meta: { totalLakes: 0, totalNodes: 0, zoom: 10 } };
    const { transport, calls } = createFakeTransport([res, res]);
    await api.getLakeMapClusters(transport, { ...BBOX, zoom: 10, filters: EMPTY_LAKE_FILTERS });
    await api.getLakeMapClusters(transport, { ...BBOX, zoom: 10, filters });
    expect(buildPath(calls[0].path, calls[0].query)).not.toContain('ratingTier');
    expect(buildPath(calls[1].path, calls[1].query)).toBe(
      '/lakes/map-clusters?north=46&south=45&east=26&west=25&zoom=10&facilityIds=a%2Cb&fishIds=f1&regimes=C%26R&ratingTier=excellent&bookable=true'
    );
  });

  it('getLakesFocusBbox drops the missing id', async () => {
    const res = { bbox: { north: 44.3, south: 44.08, east: 26.3, west: 25.6 }, count: 6 };
    const { transport, calls } = createFakeTransport([res]);
    await expect(api.getLakesFocusBbox(transport, { countyId: 'c1', cityId: null })).resolves.toEqual(res);
    expect(buildPath(calls[0].path, calls[0].query)).toBe('/lakes/focus-bbox?countyId=c1');
  });
});

describe('lakes api — explore + home (fish useLakesExploreApi / useLakesHomeApi tests)', () => {
  const suggestionsRes = {
    data: {
      suggestions: [
        { id: 'city-1', type: 'city', title: 'Sinaia', subtitle: 'Prahova · 8 bălți', icon: 'city', color: '#E0F2FE', cityId: 'city-1', countyId: 'county-1' },
        { id: 'nearby-50km', type: 'nearby', title: 'În jurul meu', subtitle: 'Arie de 50km', icon: 'location', color: '#DBEAFE' },
      ],
    },
    meta: {
      query: '',
      normalizedTokens: [],
      countsByType: { nearby: 1, county: 42, city: 13907, lake: 130 },
      pagination: { page: 1, pageSize: 20, pageCount: 3, total: 50 },
    },
  };

  it('maps suggestions and forwards params', async () => {
    const { transport, calls } = createFakeTransport([suggestionsRes]);
    const page = await api.getLakesExploreSuggestions(transport, { q: ' sin ', page: 1, pageSize: 20, latitude: 45, longitude: null, nearbyLakeIds: [], filters });
    expect(page.suggestions[0]).toMatchObject({ type: 'city', cityId: 'city-1', countyId: 'county-1' });
    expect(page.suggestions[1]).toMatchObject({ type: 'nearby', icon: 'location' });
    expect(page.meta.pagination.pageCount).toBe(3);
    expect(buildPath(calls[0].path, calls[0].query)).toBe(
      '/lakes/explore/suggestions?q=sin&page=1&pageSize=20&latitude=45&facilityIds=a%2Cb&fishIds=f1&regimes=C%26R&ratingTier=excellent&bookable=true'
    );
  });

  it('counts with the committed search + filters, defaulting to 0', async () => {
    const { transport, calls } = createFakeTransport([{ data: { total: 130 } }, { data: {} }]);
    await expect(
      api.getLakesExploreCount(transport, { search: { ...DEFAULT_LAKES_COMMITTED_SEARCH, mode: 'county', query: 'Cluj', countyId: 'c-12' } })
    ).resolves.toBe(130);
    await expect(api.getFilteredLakesCount(transport, {})).resolves.toBe(0);
    expect(buildPath(calls[0].path, calls[0].query)).toBe('/lakes/explore/count?mode=county&q=Cluj&countyId=c-12&radiusKm=50');
    expect(buildPath(calls[1].path, calls[1].query)).toBe('/lakes/explore/count?radiusKm=50');
  });

  it('maps home payload without location filters', async () => {
    const res = { data: { sections: [{ key: 'top_rated', title: 'Cu review-uri foarte bune', lakes: [{ documentId: 'lake-1', name: 'Lake 1' }] }] } };
    const { transport, calls } = createFakeTransport([res]);
    const sections = await api.getLakesHome(transport);
    expect(buildPath(calls[0].path, calls[0].query)).toBe('/lakes/home');
    expect(sections[0].key).toBe('top_rated');
  });

  it('requests home with optional coordinates and tolerates a payload without sections', async () => {
    const { transport, calls } = createFakeTransport([{ data: { key: 'nearby', title: 'x', lakes: [] } }]);
    await expect(api.getLakesHome(transport, { latitude: 45.661, longitude: 25.61, radiusKm: 50, limit: 10 })).resolves.toEqual([]);
    const url = buildPath(calls[0].path, calls[0].query);
    expect(url).toContain('/lakes/home?');
    expect(url).toContain('lat=45.661');
    expect(url).toContain('lng=25.61');
  });
});

describe('lakes api — catalogs, claims, interest, suggestions', () => {
  it('facilities, fishes (pageSize 100) and claimed public waters', async () => {
    const facility = { id: 1, documentId: 'jrxc', name: 'Pontoane', createdAt: 'x', updatedAt: 'x', publishedAt: 'x' };
    const fish = { id: 13, documentId: 'ghph', Name: 'Pastrav', competitionPriority: null, partidaDefaultRank: null };
    const claimed = { linkCode: 'R:1', lakeDocumentId: 'abc' };
    const { transport, calls } = createFakeTransport([{ data: [facility] }, { data: [fish], meta: {} }, { data: [claimed] }]);
    await expect(api.getFacilities(transport)).resolves.toEqual([facility]);
    await expect(api.getFishes(transport)).resolves.toEqual([fish]);
    await expect(api.getClaimedPublicWaters(transport)).resolves.toEqual([claimed]);
    expect(calls[0]).toMatchObject({ path: '/facilities', auth: 'none' });
    expect(buildPath(calls[1].path, calls[1].query)).toBe('/fishes?pagination[pageSize]=100');
    expect(calls[2]).toMatchObject({ path: '/feed/public-waters/claimed', auth: 'none' });
  });

  it('createLakeClaim posts the lake + contact', async () => {
    const { transport, calls } = createFakeTransport([{ data: { documentId: 'cl1', claimStatus: 'pending' } }]);
    await expect(api.createLakeClaim(transport, { lakeId: 'L', name: 'Ion', phone: '07' })).resolves.toEqual({ documentId: 'cl1', claimStatus: 'pending' });
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/feed/lake-claims',
      body: { data: { lake: 'L', name: 'Ion', phone: '07', message: undefined } },
      auth: 'required',
    });
  });

  it('createLakeBookingInterest returns the already-registered flag', async () => {
    const { transport, calls } = createFakeTransport([{ data: { alreadyRegistered: true } }]);
    await expect(api.createLakeBookingInterest(transport, { lakeId: 'L', source: 'hero_cta' })).resolves.toEqual({ alreadyRegistered: true });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feed/lake-booking-interests', body: { data: { lake: 'L', source: 'hero_cta' } }, auth: 'required' });
  });

  it('sendLakeSuggestion wraps the body in data', async () => {
    const body = { lakeName: 'Balta X', isAdmin: false, matchedLake: null };
    const res = { data: { id: 1, documentId: 'ls1', lakeName: 'Balta X' }, meta: {} };
    const { transport, calls } = createFakeTransport([res]);
    await expect(api.sendLakeSuggestion(transport, body)).resolves.toMatchObject({ data: { documentId: 'ls1' } });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/lake-suggestions', body: { data: body }, auth: 'required' });
  });
});

describe('lakes api — reviews + reputation', () => {
  const body = { quality: 5, facilities: 4, atmosphere: 3, recommendToOthers: true, comment: 'ok' };

  it('lists a lake’s reviews', async () => {
    const res = { data: [review], meta: { pagination } };
    const { transport, calls } = createFakeTransport([res]);
    await expect(api.getReviewsForLake(transport, 'L', { page: 1, pageSize: 10 })).resolves.toEqual(res);
    expect(buildPath(calls[0].path, calls[0].query)).toBe('/feed/lakes/L/reviews?page=1&pageSize=10');
    expect(calls[0].auth).toBe('none');
  });

  it('posts, edits and deletes through the legacy /lakes/:id/review routes', async () => {
    const { transport, calls } = createFakeTransport([{ id: 1, documentId: 'r' }, { id: 1, documentId: 'r' }, { data: { message: 'ok' } }]);
    await api.postReview(transport, body, 'L');
    await api.editReview(transport, body, 'L');
    await api.deleteReview(transport, 'r', 'L');
    expect(calls.map(c => [c.method, c.path, c.auth])).toEqual([
      ['POST', '/lakes/L/review', 'required'],
      ['PUT', '/lakes/L/review', 'required'],
      ['DELETE', '/lakes/L/review/r', 'required'],
    ]);
    expect(calls[0].body).toEqual({ data: body });
  });

  it('reads my review, null when none', async () => {
    const { transport, calls } = createFakeTransport([{ data: review }, { data: null }]);
    await expect(api.getReviewForLakeByAuthorId(transport, { lakeId: 'L' })).resolves.toEqual(review);
    await expect(api.getReviewForLakeByAuthorId(transport, { lakeId: 'L' })).resolves.toBeNull();
    expect(calls[0]).toMatchObject({ path: '/feed/reviews/mine', query: { lakeId: 'L' }, auth: 'required' });
  });

  it('creates an angler review and reads a reputation', async () => {
    const reputation = { avgStars: 5, ratingCount: 1, noShowCount: 0, areas: { rules: null, cleanliness: null, behavior: null }, reviews: [anglerReview] };
    const { transport, calls } = createFakeTransport([{ data: anglerReview }, { data: reputation }]);
    await expect(api.createAnglerReview(transport, { booking: 'bk1', stars: 5, tags: ['punctual'] })).resolves.toEqual(anglerReview);
    await expect(api.getUserReputation(transport, 'pnn9')).resolves.toEqual(reputation);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/feed/angler-reviews', body: { data: { booking: 'bk1', stars: 5 } }, auth: 'required' });
    expect(calls[1]).toMatchObject({ method: 'GET', path: '/feed/users/pnn9/reputation', auth: 'none' });
  });
});

describe('lakes api — operator stats + stand stats', () => {
  it('owned-lakes stats and per-lake stats (window only when given)', async () => {
    const { transport, calls } = createFakeTransport([{ data: ownedStats }, { data: operatorStats }, { data: operatorStats }]);
    await expect(api.getOwnedLakesStats(transport)).resolves.toEqual(ownedStats);
    await expect(api.getLakeOperatorStats(transport, 'L', 'week')).resolves.toEqual(operatorStats);
    await api.getLakeOperatorStats(transport, 'L');
    expect(calls[0]).toMatchObject({ path: '/feed/owned-lakes/stats', auth: 'required' });
    expect(buildPath(calls[1].path, calls[1].query)).toBe('/feed/lakes/L/operator-stats?window=week');
    expect(buildPath(calls[2].path, calls[2].query)).toBe('/feed/lakes/L/operator-stats');
    expect(calls[1].auth).toBe('required');
  });

  it('stand stats are a bare array', async () => {
    const rows = [{ standId: 's', name: '1', coordinates: { latitude: null, longitude: null }, biggestFish: 12, totalCatchesCount: 2, quality: null }];
    const { transport, calls } = createFakeTransport([rows]);
    await expect(api.getStandStatsByLakeId(transport, 'L')).resolves.toEqual(rows);
    expect(calls[0]).toMatchObject({ path: '/lakes/L/statistics', auth: 'none' });
  });
});

/* ---------------------------------------------------------------- queries */

describe('lakes queries', () => {
  const { transport } = createFakeTransport();

  it('keeps the fish key shapes', () => {
    expect(q.lakeQuery(transport, 'a').queryKey).toEqual(['lakes', 'a']);
    expect(q.lakesInfiniteQuery(transport).queryKey).toEqual(['lakes']);
    expect(q.lakesInfiniteQuery(transport, { search: 'x' }).queryKey).toEqual(['lakes', 'search', 'x']);
    expect(q.filteredLakesInfiniteQuery(transport, EMPTY_LAKE_FILTERS).queryKey).toEqual(['lakes', JSON.stringify(EMPTY_LAKE_FILTERS), 20]);
    expect(q.lakesIndexQuery(transport).queryKey).toEqual(['lakes', 'index']);
    expect(q.lakesHomeQuery(transport, {}).queryKey).toEqual([
      'lakes',
      'home',
      JSON.stringify({ limit: 10, latitude: null, longitude: null, radiusKm: 50 }),
    ]);
    expect(q.lakesFocusBboxQuery(transport, { countyId: 'c' }).queryKey).toEqual(['lakes', 'focus-bbox', 'c', '']);
    expect(q.facilitiesQuery(transport).queryKey).toEqual(['facilities']);
    expect(q.fishesQuery(transport).queryKey).toEqual(['fishes']);
    expect(q.claimedPublicWatersQuery(transport).queryKey).toEqual(['public-waters', 'claimed']);
    expect(q.lakeReviewsInfiniteQuery(transport, 'L').queryKey).toEqual(['reviews', 'lakeId=', 'L', 'pageSize', 10]);
    expect(q.myLakeReviewQuery(transport, 'L', 'u').queryKey).toEqual(['reviews', 'lakeId=', 'L', 'my']);
    expect(q.userReputationQuery(transport, 'u').queryKey).toEqual(['reputation', 'u']);
    expect(q.ownedLakesStatsQuery(transport).queryKey).toEqual(['operator-stats', 'owned']);
    expect(q.lakeOperatorStatsQuery(transport, 'L').queryKey).toEqual(['operator-stats', 'lake', 'L', '']);
    expect(q.lakeOperatorStatsQuery(transport, 'L', 'month').queryKey).toEqual(['operator-stats', 'lake', 'L', 'month']);
    expect(q.lakeStandStatsQuery(transport, 'L').queryKey).toEqual(['stands', 'L', 'stats']);
    expect(q.venueSearchLakesQuery(transport, 'ab').queryKey).toEqual(['partide', 'venue-search', 'ab']);
    expect(
      q.lakeMapClustersQuery(transport, { bbox: BBOX, zoom: 10, filters: EMPTY_LAKE_FILTERS, committedSearch: DEFAULT_LAKES_COMMITTED_SEARCH, enabled: true })
        .queryKey
    ).toEqual(['lakes', 'map-clusters', '10|46|45|26|25', EMPTY_LAKE_FILTERS, DEFAULT_LAKES_COMMITTED_SEARCH]);
  });

  it('carries over the enabled gates', () => {
    expect(q.lakeQuery(transport, '').enabled).toBe(false);
    expect(q.lakeQuery(transport, 'a', { enabled: false }).enabled).toBe(false);
    expect(q.lakesFocusBboxQuery(transport, {}).enabled).toBe(false);
    expect(q.myLakeReviewQuery(transport, 'L', undefined).enabled).toBe(false);
    expect(q.userReputationQuery(transport).enabled).toBe(false);
    expect(q.venueSearchLakesQuery(transport, ' a ').enabled).toBe(false);
    expect(q.lakesInBboxInfiniteQuery(transport, { bbox: null, filters: EMPTY_LAKE_FILTERS, committedSearch: { mode: null }, enabled: true }).enabled).toBe(false);
    expect(q.lakeStandStatsQuery(transport, 'L').initialData).toEqual([]);
  });

  it('pages in-bbox by hasMore and lists by pageCount', () => {
    const inBbox = q.lakesInBboxInfiniteQuery(transport, { bbox: BBOX, filters: EMPTY_LAKE_FILTERS, committedSearch: { mode: null }, enabled: true });
    const page = { data: [], meta: { total: 20, page: 2, pageSize: 7, hasMore: true } };
    expect(inBbox.getNextPageParam(page, [page], 2, [2])).toBe(3);
    const last = { ...page, meta: { ...page.meta, hasMore: false } };
    expect(inBbox.getNextPageParam(last, [last], 3, [3])).toBeUndefined();
    const lakes = q.lakesInfiniteQuery(transport);
    const multi = { ...cardList, meta: { pagination: { ...pagination, pageCount: 2 } } };
    expect(lakes.getNextPageParam(multi, [multi], 1, [1])).toBe(2);
  });

  it('seeds search results from the unfiltered list', () => {
    const qc = new QueryClient();
    const seed = { pages: [cardList], pageParams: [1] };
    qc.setQueryData(['lakes'], seed);
    const opts = q.lakeSearchResultsInfiniteQuery(transport, qc, { search: '' });
    expect(opts.initialData).toBe(seed);
    expect(opts.enabled).toBe(false);
  });

  it('flattens suggestion pages', () => {
    const s = { id: 'a', type: 'lake' as const, title: 'A', subtitle: '', icon: 'lake' as const, color: '#000' };
    const pageMeta = { query: '', normalizedTokens: [], countsByType: { nearby: 0, county: 0, city: 0, lake: 1 }, pagination };
    const data = { pages: [{ suggestions: [s], meta: pageMeta }, { suggestions: [s], meta: pageMeta }], pageParams: [1, 2] };
    expect(q.flattenLakesExploreSuggestions(data)).toHaveLength(2);
    expect(q.flattenLakesExploreSuggestions(undefined)).toEqual([]);
  });

  it('queryFns hit the api', async () => {
    const { transport: t, calls } = createFakeTransport([{ data: detail }, [], { data: { total: 3 } }]);
    const qc = new QueryClient();
    await qc.fetchQuery(q.lakeQuery(t, 'L'));
    await qc.fetchQuery({ ...q.lakeStandStatsQuery(t, 'L'), initialData: undefined });
    await expect(qc.fetchQuery(q.lakesExploreCountQuery(t, {}))).resolves.toBe(3);
    expect(calls.map(c => c.path)).toEqual(['/feed/lakes/L', '/lakes/L/statistics', '/lakes/explore/count']);
  });
});

/* ---------------------------------------------------------------- mutations */

describe('lakes mutations', () => {
  const body = { quality: 3, facilities: 5, atmosphere: 3, recommendToOthers: false, comment: 'edit' };

  function seededClient() {
    const qc = new QueryClient();
    qc.setQueryData(q.lakeReviewsKeys.myReviewByLakeId('L'), review);
    qc.setQueryData(q.lakeReviewsKeys.byLakeId('L'), {
      pages: [{ data: [review, { ...review, documentId: 'other' }], meta: { pagination } }],
      pageParams: [1],
    } satisfies InfiniteData<GetReviewsForLakeResponse>);
    qc.setQueryData(q.lakesKeys.byId('L'), { ...detail, documentId: 'L', reviewsMeta: meta });
    qc.setQueryData(q.lakesKeys.all, { pages: [{ data: [{ ...card, documentId: 'L' }, card], meta: { pagination } }], pageParams: [1] });
    return qc;
  }

  it('edit review applies optimistic updates to my review, the list, the lake and lake lists', async () => {
    const qc = seededClient();
    const { transport } = createFakeTransport();
    const m = editReviewMutation(transport, qc, 'L');
    await m.onMutate!({ body, lakeId: 'L' }, undefined as never);

    expect(qc.getQueryData<Review>(q.lakeReviewsKeys.myReviewByLakeId('L'))).toMatchObject({ quality: 3, comment: 'edit' });
    const list = qc.getQueryData<InfiniteData<GetReviewsForLakeResponse>>(q.lakeReviewsKeys.byLakeId('L'))!;
    expect(list.pages[0].data[0]).toMatchObject({ quality: 3, comment: 'edit' });
    expect(list.pages[0].data[1]).toMatchObject({ quality: 5, comment: 'Loc excelent' });
    // count 1: quality 5→3, facilities 5→5, atmosphere 3→3 → overall (3+5+3)/3
    const expectedMeta = { quality: 3, facilities: 5, atmosphere: 3, overall: 3.67, count: 1 };
    expect(qc.getQueryData<{ reviewsMeta: unknown }>(q.lakesKeys.byId('L'))!.reviewsMeta).toEqual(expectedMeta);
    const lakes = qc.getQueryData<InfiniteData<{ data: { documentId: string; reviewsMeta: unknown }[] }>>(q.lakesKeys.all)!;
    expect(lakes.pages[0].data[0].reviewsMeta).toEqual(expectedMeta);
    expect(lakes.pages[0].data[1].reviewsMeta).toEqual(meta);
  });

  it('edit review rolls back every snapshot on error', async () => {
    const qc = seededClient();
    const { transport } = createFakeTransport();
    const m = editReviewMutation(transport, qc, 'L');
    const ctx = await m.onMutate!({ body, lakeId: 'L' }, undefined as never);
    m.onError!(new Error('x'), { body, lakeId: 'L' }, ctx, undefined as never);
    expect(qc.getQueryData<Review>(q.lakeReviewsKeys.myReviewByLakeId('L'))).toEqual(review);
    expect(qc.getQueryData<{ reviewsMeta: unknown }>(q.lakesKeys.byId('L'))!.reviewsMeta).toEqual(meta);
    const lakes = qc.getQueryData<InfiniteData<{ data: { reviewsMeta: unknown }[] }>>(q.lakesKeys.all)!;
    expect(lakes.pages[0].data[0].reviewsMeta).toEqual(meta);
  });

  it('applyEditToLakePages leaves non-paginated lake entries alone', () => {
    const detailEntry = { documentId: 'L', reviewsMeta: meta };
    expect(applyEditToLakePages(detailEntry, 'L', review, body)).toBe(detailEntry);
    expect(applyEditToLakePages(undefined, 'L', review, body)).toBeUndefined();
  });

  it('review writes invalidate reviews, the lake, all lake lists and the to-review prompt', async () => {
    const qc = seededClient();
    qc.setQueryData(['bookings', 'to-review'], []);
    qc.setQueryData(['bookings', 'mine'], []);
    const { transport } = createFakeTransport([{ id: 1, documentId: 'r' }]);
    const m = postReviewMutation(transport, qc, 'L');
    await m.mutationFn!({ body, lakeId: 'L' }, undefined as never);
    m.onSettled!(undefined, null, { body, lakeId: 'L' }, undefined, undefined as never);
    expect(qc.getQueryState(q.lakeReviewsKeys.byLakeId('L'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(q.lakesKeys.byId('L'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(q.lakesKeys.all)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['bookings', 'to-review'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['bookings', 'mine'])?.isInvalidated).toBe(false);
  });

  it('invalidateReviewQueries is prefix-based like fish', () => {
    const qc = new QueryClient();
    qc.setQueryData(q.lakeReviewsKeys.myReviewByLakeId('L'), review);
    qc.setQueryData(q.lakeReviewsKeys.myReviewByLakeId('OTHER'), review);
    invalidateReviewQueries(qc, 'L');
    expect(qc.getQueryState(q.lakeReviewsKeys.myReviewByLakeId('L'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(q.lakeReviewsKeys.myReviewByLakeId('OTHER'))?.isInvalidated).toBe(false);
  });

  it('angler review invalidates reputation, bookings and operator-stats', () => {
    const qc = new QueryClient();
    for (const key of [['reputation', 'u'], ['bookings', 'mine'], ['operator-stats', 'owned'], ['lakes']]) qc.setQueryData(key, {});
    const { transport } = createFakeTransport();
    createAnglerReviewMutation(transport, qc).onSuccess!(anglerReview, { booking: 'b', stars: 5 }, undefined, undefined as never);
    expect(qc.getQueryState(['reputation', 'u'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['bookings', 'mine'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['operator-stats', 'owned'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['lakes'])?.isInvalidated).toBe(false);
  });
});
