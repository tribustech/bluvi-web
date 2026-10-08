import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { ApiError } from '../transport';
import * as api from './api';
import { DEFAULT_COMPETITION_FILTERS } from './domain/filters';
import { applyMutedTypes } from './domain/notificationPreferences';
import {
  PULSE_CARD_PARAMS,
  featuredHeroPick,
  pulseCountTile,
  pulseLists,
  pulseLiveKey,
  resolvePulseSlots,
  wantsFeaturedHero,
} from './domain/pulse';
import {
  applyFollowToCompetition,
  applyPollVote,
  followCompetitionMutation,
  pollVoteMutation,
  updateCompetitionNotificationPreferencesMutation,
} from './mutations';
import {
  RECENT_WEIGHINGS_POLL_MS,
  pulsePeopleQuery,
  recentWeighingsQuery,
  competitionCardsInfiniteQuery,
  competitionCardsKeys,
  competitionCatchesInfiniteQuery,
  competitionKeys,
  competitionMyStatusQuery,
  competitionNotificationKeys,
  competitionProfileKeys,
  competitionQuery,
  competitionsKeys,
  catchThresholdCountsQuery,
  competitionTimelineSnapshotQuery,
  competitionWeighingStatisticsQuery,
  filteredCompetitionsInfiniteQuery,
  myCompetitionsInfiniteQuery,
  participantStatisticsBatchQuery,
  participantStatisticsState,
  pollKeys,
  rankingsQuery,
  selectCompetitionCards,
  sortPollOptionsByVotes,
  standStatsByLakeIdQuery,
} from './queries';
import type { CompetitionCard, CompetitionDetail, NotificationPreferences, Poll } from './schemas';

/* ------------------------------------------------------------------ */
/* Fixtures — trimmed from real local-CMS responses                    */
/* ------------------------------------------------------------------ */

const pagination = { page: 1, pageSize: 1, pageCount: 17, total: 17 };

const listItem = {
  id: 608,
  documentId: 'uxxie29m6820wrpdv45w0m7q',
  name: '[AUDIT] Combinat A',
  startDate: '2026-10-17T06:00:00.000Z',
  endDate: '2026-10-17T18:00:00.000Z',
  competitionStatus: 'completed',
  competitionType: 'single',
  rankingType: 'quantity',
  bestOfFishCount: null,
  bestOfTierSizes: null,
  registerFee: null,
  participantsLimit: 10,
  teamParticipants: 1,
  registrationDeadline: '2026-10-17T05:00:00.000Z',
  banner: null,
  lake: {
    id: 186,
    documentId: 't2vog9qczowvd5k8sbbflcn4',
    name: 'Balta Roveng',
    coordinates: { lat: '44.13', long: '26.33' },
    images: [{ url: 'https://x/a.jpg', smallUrl: 'https://x/s.jpg', blurhash: 'L' }],
  },
  viewers: 1,
  registrations: [
    { registrationStatus: 'registered', participants: [{ id: 563, documentId: 'kbj3', username: 'Audit Pescar', avatar: null }] },
  ],
};

const detail: CompetitionDetail = {
  id: 547,
  documentId: 'z7rv',
  name: 'CN Test',
  startDate: '2026-05-09T09:24:49.000Z',
  endDate: '2026-05-12T09:24:49.000Z',
  competitionStatus: 'completed',
  competitionType: 'single',
  rankingType: 'nationalChampionship',
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
  description: [{ type: 'paragraph', children: [{ text: 'Hhfhj', type: 'text' }] }],
  reward: null,
  regulation: null,
  banner: null,
  lake: { id: 231, documentId: 'iy8y', name: 'Iazul Bila 2', contact: [], stands: [{ id: 2837, documentId: 'ahs6', name: '1' }] },
  author: { id: 129, documentId: 'vsfh', username: 'Andrew R', phone: null },
  referees: [],
  sponsors: [],
  fishType: [{ id: 7, documentId: 'cyx5', Name: 'Crap' }],
  sectors: [{ id: 585, documentId: 'sf4s', name: 'A', minFishNumber: 1, stands: [{ id: 2837, documentId: 'ahs6', name: '1' }] }],
  followers: [],
  registrations: [
    {
      id: 1974,
      documentId: 'gqdf',
      registrationStatus: 'registered',
      teamName: '',
      guestName: 'Cici',
      stand: { id: 2837, documentId: 'ahs6', name: '1' },
      club: { name: 'Ardealul' },
      author: null,
      participants: [],
    },
  ],
  viewers: 3,
};

const card: CompetitionCard = {
  id: 608,
  documentId: 'uxxie',
  name: '[AUDIT] Combinat A',
  startDate: '2026-10-17T06:00:00.000Z',
  endDate: '2026-10-17T18:00:00.000Z',
  dateLabel: '17 oct.',
  hoursLabel: '09:00–21:00',
  status: 'completed',
  format: { kind: 'single', teamSize: 1, unit: 'pescari' },
  rankingType: 'quantity',
  rankingLabel: 'Cantitate',
  banner: null,
  lake: { documentId: 't2vo', name: 'Balta Roveng', county: { documentId: 'njf0', name: 'Giurgiu' }, image: null },
  organizer: { documentId: 'af2k', username: 'Audit Organizator', avatarUrl: null },
  joinedCount: 1,
  pendingCount: 0,
  capacity: 10,
  placesLeft: 9,
  viewers: 1,
  participantFaces: [],
  results: { capturedAt: '2026-09-27T19:35:35.323Z', hasCatches: false, catchCount: 0, totalKg: null, biggestFishKg: null, podium: [] },
};
const cardsPage = { data: [card], meta: { pagination, counts: { notStarted: 7, started: 3, completed: 17 } } };

const quantityRanking = {
  rankings: [
    {
      sectorId: 'hx32',
      sectorName: 'A',
      standId: 3383,
      standName: '1',
      participant: null,
      teamName: '',
      guestName: 'Pescar 01',
      registrationId: 'yer6',
      biggestFish: 12,
      quantity: 15.5,
      catchCount: 2,
      penalties: [],
      isEliminated: false,
      quantityPoints: 1,
      sectorPosition: 1,
      generalPosition: 1,
    },
  ],
  metadata: { numberOfSectors: 1, rankingType: 'quantity', totalQuantity: 0, totalCatchesCount: 0, biggestCatch: null, biggestFish: 0 },
};

const poll: Poll = {
  id: 1,
  documentId: 'nbcy',
  title: 'Care e cea mai populară baltă din 2026?',
  description: null,
  closesAt: '2026-07-20T20:00:00.000Z',
  votingClosed: false,
  totalVotes: 3,
  myVoteOptionId: null,
  options: [
    { id: 1, documentId: 'a', title: 'Chita Lake', description: null, order: 1, votesCount: 1, suggestedBy: null },
    { id: 2, documentId: 'b', title: 'Balta Roveng', description: null, order: 2, votesCount: 2, suggestedBy: null },
    { id: 3, documentId: 'c', title: 'Balta Alesteu', description: null, order: 3, votesCount: 0, suggestedBy: null },
  ],
};

const prefs: NotificationPreferences = {
  groups: [
    {
      key: 'start-end',
      label: 'Start și încheiere',
      types: [
        { key: 'competition:start', label: 'Concursul a început', muted: false },
        { key: 'competition:end', label: 'Concursul s-a încheiat', muted: false },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* API                                                                */
/* ------------------------------------------------------------------ */

describe('competitions api — requests', () => {
  it('lists by status on /feed/competitions with flat params', async () => {
    const { transport, calls } = createFakeTransport([{ data: [listItem], meta: { pagination } }]);
    const res = await api.getCompetitionsByStatus(transport, 'completed', { page: 2 }, 'lake1');
    expect(res.data[0].lake?.coordinates?.lat).toBe('44.13');
    expect(calls[0]).toMatchObject({
      method: 'GET',
      path: '/feed/competitions',
      query: { status: 'completed', lakeId: 'lake1', page: 2, pageSize: 20 },
      auth: 'none',
    });
    await api.getFutureCompetitions(createFakeTransport([{ data: [], meta: { pagination } }]).transport, {});
  });

  it('asks the legacy list with fish’s populate/pagination', async () => {
    const { transport, calls } = createFakeTransport([{ data: [], meta: { pagination } }]);
    await api.getCompetitionsList(transport);
    expect(calls[0]).toMatchObject({
      path: '/competitions',
      query: { sort: ['startDate'], populate: { lake: true }, pagination: { page: 1, pageSize: 100 } },
    });
  });

  it('reads my competitions per-user', async () => {
    const { transport, calls } = createFakeTransport([{ data: [], meta: { pagination } }]);
    await api.getMyCompetitions(transport, { page: 2 });
    expect(calls[0]).toMatchObject({ path: '/competitions/me', query: { pagination: { page: 2, pageSize: 10 } }, auth: 'required' });
  });

  it('unwraps the detail and parses the real DTO', async () => {
    const { transport, calls } = createFakeTransport([{ data: detail }]);
    await expect(api.getCompetition(transport, 'z7rv')).resolves.toEqual(detail);
    expect(calls[0]).toMatchObject({ path: '/feed/competitions/z7rv', auth: 'none' });
  });

  it('falls back to the signed-out overlay on a 401 from my-status', async () => {
    const t = {
      request: async () => {
        throw new ApiError({ message: 'x', status: 401, code: 'HTTP' });
      },
    };
    await expect(api.getCompetitionMyStatus(t, 'c')).resolves.toEqual(api.SIGNED_OUT_MY_STATUS);
    const { transport, calls } = createFakeTransport([{ data: { isFollowing: true, userRegistrationStatus: 'pending' } }]);
    await expect(api.getCompetitionMyStatus(transport, 'c')).resolves.toEqual({ isFollowing: true, userRegistrationStatus: 'pending' });
    expect(calls[0]).toMatchObject({ path: '/feed/competitions/c/my-status', auth: 'required' });
  });

  it('rethrows other my-status errors', async () => {
    const t = {
      request: async () => {
        throw new ApiError({ message: 'x', status: 500, code: 'HTTP' });
      },
    };
    await expect(api.getCompetitionMyStatus(t, 'c')).rejects.toMatchObject({ status: 500 });
  });

  it('reads registrations, fish species and followers', async () => {
    const reg = { id: 1, documentId: 'r', registrationStatus: 'registered', teamName: null, guestName: null, participants: [] };
    const { transport, calls } = createFakeTransport([
      [reg],
      { data: { documentId: 'c', fishSpecies: [{ id: 7, documentId: 'f', Name: 'Crap' }] } },
      { data: [{ id: 1, documentId: 'u', username: 'A', avatar: null }] },
    ]);
    await expect(api.getCompetitionRegistrations(transport, 'c')).resolves.toHaveLength(1);
    await expect(api.getFishSpecies(transport, 'c')).resolves.toEqual([{ id: 7, documentId: 'f', Name: 'Crap' }]);
    await expect(api.getFollowers(transport, 'c')).resolves.toHaveLength(1);
    expect(calls.map(c => [c.path, c.auth])).toEqual([
      ['/competitions/c/registrations', 'required'],
      ['/feed/competitions/c/fish-species', 'none'],
      ['/feed/competitions/c/followers', 'none'],
    ]);
  });

  it('returns null for no live competition and for a 404', async () => {
    const { transport } = createFakeTransport([{ competition: null, 'extra-scales': [] }]);
    await expect(api.getLiveCompetition(transport)).resolves.toBeNull();
    const notFound = {
      request: async () => {
        throw new ApiError({ message: 'x', status: 404, code: 'HTTP' });
      },
    };
    await expect(api.getLiveCompetition(notFound)).resolves.toBeNull();
    const live = { competition: { documentId: 'c', name: 'Live', rankingType: 'quantity' }, 'extra-scales': [] };
    await expect(api.getLiveCompetition(createFakeTransport([live]).transport)).resolves.toEqual(live);
  });

  it('follows with a POST body', async () => {
    const { transport, calls } = createFakeTransport([{ isFollowing: true }]);
    await expect(api.followCompetition(transport, 'c', true)).resolves.toEqual({ isFollowing: true });
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/competitions/c/follow', body: { follow: true }, auth: 'required' });
  });

  it('routes the cards to the public or per-user endpoint', async () => {
    const { transport, calls } = createFakeTransport([cardsPage, cardsPage]);
    const base = { search: null, filters: DEFAULT_COMPETITION_FILTERS, sort: 'date' as const };
    await api.getCompetitionCards(transport, { ...base, scope: 'all', status: 'completed' });
    await api.getCompetitionCards(transport, { ...base, scope: 'registered' });
    expect(calls[0]).toMatchObject({ path: '/feed/competition-cards?status=completed&page=1&pageSize=20', auth: 'none' });
    expect(calls[1]).toMatchObject({ path: '/feed/my-competition-cards?page=1&pageSize=20&scope=registered', auth: 'required' });
  });

  it('reads suggestions, featured and pulse person (null-safe)', async () => {
    const group = { title: 'Concursuri', items: [{ id: 'competition:x', type: 'competition', value: 'x', title: 'Cupa', subtitle: 's' }] };
    const person = {
      criterion: 'winner',
      avatarUrls: [],
      destination: { type: 'competition', documentId: 'k5c9' },
      kicker: 'CÂȘTIGĂTOR',
      displayName: 'Andrei Popescu',
      line: 'Individual · locul 1',
      meta: 'Cupa',
    };
    const { transport, calls } = createFakeTransport([{ data: { groups: [group] } }, { data: null }, { data: card }, { data: null }, { data: person }]);
    await expect(api.getCompetitionSuggestions(transport, '  cupa ')).resolves.toEqual([group]);
    await expect(api.getCompetitionSuggestions(transport, '')).resolves.toEqual([]);
    await expect(api.getFeaturedCompetition(transport)).resolves.toEqual(card);
    await expect(api.getPulsePerson(transport)).resolves.toBeNull();
    await expect(api.getPulsePerson(transport)).resolves.toEqual(person);
    expect(calls[0].path).toBe('/feed/competition-suggestions?q=cupa');
    expect(calls[1].path).toBe('/feed/competition-suggestions');
    expect(calls[2]).toMatchObject({ path: '/feed/featured-competition', auth: 'none' });
    expect(calls[3]).toMatchObject({ path: '/feed/pulse-person', auth: 'none' });
  });

  it('reads the ranking family', async () => {
    const { transport, calls } = createFakeTransport([
      quantityRanking,
      { best3: [], best5: [], best7: [] },
      { data: [], pagination: { page: 1, pageSize: 20, total: 0, pageCount: 1 } },
      { data: [] },
      { bySector: [], general: { count10Plus: 0, count15Plus: 0, count20Plus: 0, count25Plus: 0, count30Plus: 0 } },
      null,
    ]);
    const ranking = await api.getRankings(transport, 'c');
    expect(ranking.metadata.rankingType).toBe('quantity');
    await api.getRankingBestN(transport, 'c');
    await api.getCompetitionCatches(transport, 'c', 'weight_desc', 2, 20, { standKey: 'A2' });
    await api.getCompetitionWeighingStatistics(transport, 'c');
    await api.getCatchThresholdCounts(transport, 'c');
    await expect(api.getCompetitionTimelineSnapshot(transport, 'c')).resolves.toBeNull();
    expect(calls.map(c => c.path)).toEqual([
      '/competitions/c/ranking',
      '/competitions/c/ranking/best-n',
      '/competitions/c/catches',
      '/competitions/c/weighing-statistics',
      '/competitions/c/catch-threshold-counts',
      '/competitions/c/timeline-snapshot',
    ]);
    expect(calls[2].query).toEqual({ sort: 'weight_desc', page: 2, pageSize: 20, standKey: 'A2' });
  });

  it('rejects a ranking row that lacks its ranking type’s fields', async () => {
    const broken = { ...quantityRanking, rankings: [{ ...quantityRanking.rankings[0], quantityPoints: undefined }] };
    await expect(api.getRankings(createFakeTransport([broken]).transport, 'c')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('writes registrations with fish’s bodies', async () => {
    const { transport, calls } = createFakeTransport([{ data: { id: 1, documentId: 'r' } }, { data: { id: 1, documentId: 'r' } }, null, null, null, null, null, null]);
    await api.createCompetitionRegistration(transport, { competition: 'c', participants: ['u'], teamName: 't', phone: null, registrationStatus: 'pending' });
    await api.updateCompetitionRegistration(transport, { competition: 'c', registrationId: 'r', participants: ['u'], teamName: 't' });
    await api.removeRegistration(transport, 'r');
    await api.acceptRegistration(transport, 'r');
    await api.rejectRegistration(transport, 'r');
    await api.moveRegistrationToWaitingList(transport, 'r');
    await api.addGuestRegistration(transport, { competitionId: 'c', guestName: 'G' });
    await api.updateGuestRegistration(transport, { registrationId: 'r', guestName: 'G2' });
    expect(calls.map(c => `${c.method} ${c.path}`)).toEqual([
      'POST /registrations',
      'PUT /registrations/r',
      'PATCH /registrations/r/leave',
      'PATCH /registrations/r/accept',
      'PATCH /registrations/r/reject',
      'PATCH /registrations/r/pending',
      'POST /registrations/guests',
      'PUT /registrations/guests/r',
    ]);
    expect(calls[1].body).toEqual({ data: { competition: 'c', participants: ['u'], teamName: 't' } });
    expect(calls[6].body).toEqual({ data: { competitionId: 'c', guestName: 'G' } });
    expect(calls[7].body).toEqual({ data: { guestName: 'G2', teamName: undefined } });
    expect(calls.every(c => c.auth === 'required')).toBe(true);
  });

  it('reads stand stats, polls, sponsors', async () => {
    const stand = { standId: 's', name: '1', coordinates: { latitude: null, longitude: null }, biggestFish: 0, totalCatchesCount: 0, quality: null };
    const sponsorDetail = { id: 4, documentId: 'g3', name: 'Test', url: null, description: [], image: { url: 'u', largeUrl: null, blurhash: null } };
    const { transport, calls } = createFakeTransport([
      [stand],
      { data: poll },
      { data: [poll], meta: { pagination } },
      null,
      null,
      { data: [{ id: 3, documentId: 'sy', name: 'TT', url: null, image: null }] },
      { data: sponsorDetail },
    ]);
    await expect(api.getStandStatsByLakeId(transport, 'l')).resolves.toEqual([stand]);
    await expect(api.getCurrentPoll(transport)).resolves.toEqual(poll);
    await api.getPastPolls(transport);
    await api.castPollVote(transport, { pollId: 'p', optionId: 2 });
    await api.submitPollSuggestion(transport, { pollId: 'p', text: 'Chita' });
    await api.getSponsors(transport);
    await api.getSponsorById(transport, 'g3');
    expect(calls.map(c => `${c.method} ${c.path} ${c.auth}`)).toEqual([
      'GET /lakes/l/statistics none',
      'GET /polls/current optional',
      'GET /polls/past optional',
      'PUT /polls/p/vote required',
      'POST /polls/p/suggest required',
      'GET /feed/sponsors/dashboard none',
      'GET /feed/sponsors/g3 none',
    ]);
    expect(calls[2].query).toEqual({ page: 1, pageSize: 10 });
    expect(calls[3].body).toEqual({ optionId: 2 });
  });

  it('reads and writes notification preferences', async () => {
    const followed = { documentId: 'k', name: 'Chat', bannerThumbUrl: null, competitionStatus: 'started', mutedCount: 0 };
    const { transport, calls } = createFakeTransport([prefs, prefs, { data: [followed] }]);
    await api.getCompetitionNotificationPreferences(transport, 'c');
    await api.updateCompetitionNotificationPreferences(transport, 'c', ['competition:end']);
    await expect(api.getFollowedCompetitions(transport)).resolves.toEqual([followed]);
    expect(calls.map(c => `${c.method} ${c.path} ${c.auth}`)).toEqual([
      'GET /feed/competitions/c/notification-preferences required',
      'PUT /feed/competitions/c/notification-preferences required',
      'GET /feed/followed-competitions required',
    ]);
    expect(calls[1].body).toEqual({ mutedTypes: ['competition:end'] });
  });
});

/* ------------------------------------------------------------------ */
/* Statistici tab — fish services/api/rankings.ts (from the organizer port) */
/* ------------------------------------------------------------------ */

const timeline = {
  competitionStart: '2026-05-08T14:00:00.000Z',
  competitionEnd: '2026-05-10T10:00:00.000Z',
  rankingType: 'quantity',
  defaultMetric: 'quantity',
  availableMetrics: ['quantity', 'catchCount', 'biggestFish'],
  generatedAt: '2026-05-10T10:05:00.000Z',
  stands: [
    {
      standId: 3677,
      standName: '1',
      sectorId: 'riy4',
      sectorName: 'A',
      teamName: null,
      guestName: null,
      events: [{ weighingId: 4737, t: '2026-05-08T15:00:00.000Z', quantity: 19.6, catchCount: 4, biggestFish: 6.1 }],
    },
  ],
  weighingFingerprints: { '4737': { initialEndDate: '2026-05-08T15:00:00.000Z' } },
};

describe('competition statistics api', () => {
  const C = 'cmp1';
  const W = 'w1';
  const cases: {
    name: string;
    run: (t: ReturnType<typeof createFakeTransport>['transport']) => Promise<unknown>;
    response: unknown;
    expect: Record<string, unknown>;
    result?: unknown;
  }[] = [
    {
      name: 'getCompetitionCatches',
      run: t => api.getCompetitionCatches(t, C, 'stand', 2, 20, { standKey: 'A2' }),
      response: { data: [{ id: 'c1', weight: 4.9, standId: 3677, standName: '1', sectorId: 's', sectorName: 'A', teamName: '', guestName: null, participantUsername: 'T', fishName: 'Caras' }], pagination: { page: 2, pageSize: 20, total: 389, pageCount: 20 } },
      expect: { path: `/competitions/${C}/catches`, query: { sort: 'stand', page: 2, pageSize: 20, standKey: 'A2' }, auth: 'none' },
    },
    {
      name: 'getCompetitionWeighingStatistics',
      run: t => api.getCompetitionWeighingStatistics(t, C),
      response: { data: [{ weighingDocumentId: W, startDate: 'a', endDate: 'b', sequenceIndex: 1, totalWeightKg: 19.6, catchCount: 4, weighingType: 'normal', sectorName: 'A', standName: '1' }] },
      expect: { path: `/competitions/${C}/weighing-statistics`, auth: 'none' },
    },
    {
      name: 'getCatchThresholdCounts',
      run: t => api.getCatchThresholdCounts(t, C),
      response: { bySector: [{ sectorName: 'A', count10Plus: 24, count15Plus: 13, count20Plus: 0, count25Plus: 0, count30Plus: 0 }], general: { count10Plus: 24, count15Plus: 13, count20Plus: 0, count25Plus: 0, count30Plus: 0 } },
      expect: { path: `/competitions/${C}/catch-threshold-counts` },
    },
    { name: 'getCompetitionTimelineSnapshot', run: t => api.getCompetitionTimelineSnapshot(t, C), response: { data: timeline }, expect: { path: `/competitions/${C}/timeline-snapshot`, auth: 'optional' }, result: timeline },
    { name: 'getCompetitionTimelineSnapshot (204)', run: t => api.getCompetitionTimelineSnapshot(t, C), response: null, expect: { path: `/competitions/${C}/timeline-snapshot` }, result: null },
  ];

  it.each(cases)('$name', async c => {
    const { transport, calls } = createFakeTransport([c.response]);
    const result = await c.run(transport);
    expect(calls[0]).toMatchObject(c.expect);
    if ('result' in c) expect(result).toEqual(c.result);
  });
});

describe('competition statistics queries', () => {
  const { transport: t } = createFakeTransport();

  it('carries the statistics enabled rules and stale time', () => {
    expect(competitionWeighingStatisticsQuery(t, 'c', 'notStarted').enabled).toBe(false);
    expect(competitionTimelineSnapshotQuery(t, 'c', 'draft').enabled).toBe(false);
    expect(catchThresholdCountsQuery(t, 'c', 'started', { enabled: false }).enabled).toBe(false);
    expect(catchThresholdCountsQuery(t, 'c', 'completed').staleTime).toBe(300_000);
    const q = competitionCatchesInfiniteQuery(t, 'c', 'stand', 'started');
    const page = (p: number) => ({ data: [], pagination: { page: p, pageSize: 20, total: 40, pageCount: 2 } });
    expect(q.getNextPageParam(page(1), [page(1)], 1, [1])).toBe(2);
    expect(q.getNextPageParam(page(2), [page(2)], 2, [2])).toBeUndefined();
  });
});

/* fish services/queries/__tests__/competitionCards.test.ts */
describe('buildCompetitionCardsQuery', () => {
  const base = {
    scope: 'all' as const,
    status: 'notStarted' as const,
    search: null,
    filters: DEFAULT_COMPETITION_FILTERS,
    sort: 'date' as const,
  };

  // Every default that leaks into the url is a distinct edge cache entry for an identical request.
  it('omits every default value', () => {
    expect(api.buildCompetitionCardsQuery(base)).toBe('status=notStarted&page=1&pageSize=20');
  });

  it('sends a committed lake as lakeId, never as text', () => {
    const q = api.buildCompetitionCardsQuery({ ...base, search: { type: 'lake', value: 'l1', label: 'Chita' } });
    expect(q).toContain('lakeId=l1');
    expect(q).not.toContain('q=');
  });

  it('sends a committed organizer as organizerId', () => {
    const q = api.buildCompetitionCardsQuery({ ...base, search: { type: 'organizer', value: 'o1', label: 'Carp United' } });
    expect(q).toContain('organizerId=o1');
  });

  it('sends free text as q', () => {
    const q = api.buildCompetitionCardsQuery({ ...base, search: { type: 'text', value: 'cupa', label: 'cupa' } });
    expect(q).toContain('q=cupa');
    expect(q).not.toContain('lakeId');
  });

  it('sends only the filters that are set', () => {
    const q = api.buildCompetitionCardsQuery({
      ...base,
      filters: { period: 'next7', format: 'team', availableOnly: true, countyId: 'j1', countyName: 'Ilfov' },
    });
    expect(q).toContain('period=next7');
    expect(q).toContain('format=team');
    expect(q).toContain('availableOnly=true');
    expect(q).toContain('countyId=j1');
  });

  it('omits the scope for the public list and sends it otherwise', () => {
    expect(api.buildCompetitionCardsQuery(base)).not.toContain('scope');
    expect(api.buildCompetitionCardsQuery({ ...base, scope: 'registered' })).toContain('scope=registered');
  });
});

/* ------------------------------------------------------------------ */
/* Queries                                                            */
/* ------------------------------------------------------------------ */

describe('competitions queries', () => {
  const { transport } = createFakeTransport();
  const signedIn = { isAuthenticated: true };
  const signedOut = { isAuthenticated: false };

  it('keeps the fish key shapes', () => {
    expect(competitionsKeys.byStatusAndLake('started', 'l')).toEqual(['competitions', 'started', 'l']);
    expect(competitionsKeys.fishSpecies('c')).toEqual(['competitions', 'competitionId', 'c', 'fish-species']);
    expect(competitionKeys.catchesInfinite('c', 'stand', { sectorName: 'A' })).toEqual(['competition', 'c', 'catches', 'stand', 'sector:A']);
    expect(competitionKeys.catchesInfinite('c', 'stand', { standKey: 'A2' })[4]).toBe('stand:A2');
    expect(competitionKeys.catchesInfinite('c', 'stand')[4]).toBe('all');
    expect(competitionCardsKeys.list('sig')).toEqual(['competition-cards', 'list', 'sig']);
    expect(competitionNotificationKeys.preferences('c')).toEqual(['notifications', 'preferences', 'c']);
    expect(competitionProfileKeys.statuteForCompetition('c')).toEqual(['profile-statute', 'c']);
    expect(pollKeys.current).toEqual(['poll', 'current']);
    expect(filteredCompetitionsInfiniteQuery(transport, { status: 'started', pagination: { pageSize: 5 } }).queryKey).toEqual([
      'competitions',
      'started',
      { pageSize: 5 },
    ]);
    expect(myCompetitionsInfiniteQuery(transport, signedIn).queryKey).toEqual(['competitions', 'my']);
    expect(standStatsByLakeIdQuery(transport, 'l').initialData).toEqual([]);
  });

  it('merges the detail with the overlay, and skips my-status when signed out', async () => {
    const { transport: t, calls } = createFakeTransport([{ data: detail }]);
    const merged = await competitionQuery(t, 'z7rv', signedOut).queryFn!({} as never);
    expect(merged).toMatchObject({ documentId: 'z7rv', isFollowing: false, userRegistrationStatus: null });
    expect(calls).toHaveLength(1);
    const my = await competitionMyStatusQuery(t, 'z7rv', signedOut).queryFn!({} as never);
    expect(my).toEqual(api.SIGNED_OUT_MY_STATUS);
  });

  it('gates the per-user card lists on the session and keys them by url', () => {
    const params = { search: null, filters: DEFAULT_COMPETITION_FILTERS, sort: 'date' as const };
    const pub = competitionCardsInfiniteQuery(transport, { ...params, scope: 'all', status: 'started' }, signedOut, { refetchInterval: 30_000 });
    expect(pub.queryKey).toEqual(['competition-cards', 'list', 'status=started&page=1&pageSize=20']);
    expect(pub.enabled).toBe(true);
    expect(pub.refetchInterval).toBe(30_000);
    const mine = competitionCardsInfiniteQuery(transport, { ...params, scope: 'registered' }, signedOut);
    expect(mine.enabled).toBe(false);
    expect(mine.refetchInterval).toBe(false);
    expect(selectCompetitionCards({ pages: [cardsPage], pageParams: [1] }, { scope: 'registered' }, signedOut)).toEqual({
      competitions: [card],
      counts: cardsPage.meta.counts,
      total: 17,
      requiresSignIn: true,
    });
  });

  it('disables ranking reads before the start', () => {
    expect(rankingsQuery(transport, 'c', 'notStarted').enabled).toBe(false);
    expect(rankingsQuery(transport, 'c', 'started').enabled).toBe(true);
    expect(competitionTimelineSnapshotQuery(transport, 'c', 'draft').enabled).toBe(false);
    const catches = competitionCatchesInfiniteQuery(transport, 'c', 'weight_desc', 'started', { enabled: false });
    expect(catches.enabled).toBe(false);
    expect(catches.getNextPageParam({ data: [], pagination: { page: 1, pageSize: 20, total: 40, pageCount: 2 } }, [], 1, [1])).toBe(2);
  });

  it('sorts poll options by votes with the admin order as tiebreak', () => {
    expect(sortPollOptionsByVotes(poll)!.options.map(o => o.id)).toEqual([2, 1, 3]);
    expect(sortPollOptionsByVotes(null)).toBeNull();
  });

  it('dedupes the stats batch key and derives the unauthorized state', () => {
    const q = participantStatisticsBatchQuery(transport, 'c', ['b', 'a', 'b'], signedIn);
    expect(q.queryKey).toEqual(['profile', 'participant-statistics-batch', 'c', 'a,b']);
    expect(participantStatisticsBatchQuery(transport, 'c', [], signedIn).enabled).toBe(false);
    const base = { data: undefined, isError: false, error: null, isLoading: false };
    expect(participantStatisticsState(base, ['a'], signedOut).isStatsUnauthorized).toBe(true);
    expect(
      participantStatisticsState({ ...base, isError: true, error: { status: 401, bluCode: 'GET_STATISTICS_BATCH:USER_NOT_LOGGED_IN' } }, ['a'], signedIn)
        .isStatsUnauthorized
    ).toBe(true);
    expect(participantStatisticsState({ ...base, isLoading: true }, ['a'], signedIn)).toEqual({
      statsMap: {},
      isStatsUnauthorized: false,
      isLoading: true,
    });
  });
});

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

describe('competitions mutations', () => {
  it('follows optimistically and rolls back on error', async () => {
    const qc = client();
    const merged = { ...detail, isFollowing: false, userRegistrationStatus: null };
    qc.setQueryData(competitionsKeys.byId('z7rv'), merged);
    const failing = {
      request: async () => {
        throw new ApiError({ message: 'x', status: 500, code: 'HTTP' });
      },
    };
    const m = followCompetitionMutation(failing, qc);
    const ctx = await m.onMutate!({ competitionId: 'z7rv', follow: true }, {} as never);
    expect(qc.getQueryData(competitionsKeys.byId('z7rv'))).toMatchObject({ isFollowing: true, viewers: 4 });
    m.onError!(new Error('x'), { competitionId: 'z7rv', follow: true }, ctx, {} as never);
    expect(qc.getQueryData(competitionsKeys.byId('z7rv'))).toEqual(merged);
    expect(applyFollowToCompetition(undefined, false)).toMatchObject({ viewers: 1, isFollowing: false });
  });

  it('votes optimistically: a first vote counts once, a change moves one', () => {
    const first = applyPollVote(poll, 3);
    expect(first.totalVotes).toBe(4);
    expect(first.options.find(o => o.id === 3)!.votesCount).toBe(1);
    const change = applyPollVote({ ...poll, myVoteOptionId: 2 }, 1);
    expect(change.totalVotes).toBe(3);
    expect(change.options.map(o => o.votesCount)).toEqual([2, 1, 0]);
  });

  it('writes the optimistic poll into the current key', async () => {
    const qc = client();
    qc.setQueryData(pollKeys.current, poll);
    const { transport } = createFakeTransport([null]);
    const m = pollVoteMutation(transport, qc);
    const ctx = await m.onMutate!({ pollId: 'nbcy', optionId: 1 }, {} as never);
    expect(qc.getQueryData<Poll>(pollKeys.current)!.myVoteOptionId).toBe(1);
    m.onError!(new Error('x'), { pollId: 'nbcy', optionId: 1 }, ctx, {} as never);
    expect(qc.getQueryData(pollKeys.current)).toEqual(poll);
  });

  it('applies muted types optimistically and stores the server answer', async () => {
    const qc = client();
    const key = competitionNotificationKeys.preferences('c');
    qc.setQueryData(key, prefs);
    const { transport } = createFakeTransport();
    const m = updateCompetitionNotificationPreferencesMutation(transport, qc, 'c');
    await m.onMutate!(['competition:end', 'chat:room:x'], {} as never);
    const optimistic = qc.getQueryData<NotificationPreferences>(key)!;
    expect(optimistic.groups[0].types.map(t => t.muted)).toEqual([false, true]);
    expect(optimistic.extraMuted).toEqual(['chat:room:x']);
    expect(applyMutedTypes(prefs, [])).toEqual({ ...prefs, extraMuted: [] });
  });
});

/* ------------------------------------------------------------------ */
/* Pulse derivations                                                  */
/* ------------------------------------------------------------------ */

describe('pulse derivations', () => {
  const NOW = new Date('2026-09-23T09:00:00.000Z').getTime();
  const c = (over: Partial<CompetitionCard>): CompetitionCard => ({ ...card, ...over });

  it('drops stale starts, merges my upcoming and lets live win the dedupe', () => {
    const lists = pulseLists(
      {
        live: [c({ documentId: 'L', status: 'started' })],
        upcoming: [
          c({ documentId: 'L', status: 'notStarted', startDate: '2026-09-24T06:00:00.000Z' }),
          c({ documentId: 'stale', status: 'notStarted', startDate: '2026-09-21T06:00:00.000Z' }),
          c({ documentId: 'b', status: 'notStarted', startDate: '2026-09-26T06:00:00.000Z' }),
        ],
        completed: [],
        mine: [c({ documentId: 'm', status: 'notStarted', startDate: '2026-09-25T06:00:00.000Z' })],
      },
      NOW
    );
    expect(lists.upcoming.map(x => x.documentId)).toEqual(['m', 'b']);
    expect(pulseLiveKey(lists.live)).toBe('L');
  });

  it('only wants featured with nothing live and no personal rung', () => {
    const base = { enabled: true, ready: true, liveCount: 0, localHero: null };
    expect(wantsFeaturedHero(base)).toBe(true);
    expect(wantsFeaturedHero({ ...base, liveCount: 1 })).toBe(false);
    const personal = { kind: 'next' as const, competition: card, mine: true, live: [], myImminent: card };
    expect(wantsFeaturedHero({ ...base, localHero: personal })).toBe(false);
  });

  it('lets the server slots win over the frozen local pick', () => {
    const frozen = { hero: null, moment: { key: 'k', kicker: 'K', displayName: 'D', line: 'L', meta: 'M', avatarUrls: [], competitionId: 'x' } };
    const slots = resolvePulseSlots({ wantsFeatured: true, featured: card, person: null, frozen });
    expect(slots.hero).toEqual(featuredHeroPick(card));
    expect(slots.moment).toBe(frozen.moment);
    expect(resolvePulseSlots({ wantsFeatured: false, featured: card, person: null, frozen }).hero).toBeNull();
  });

  it('counts starting-soon and caps faces at six', () => {
    const faces = ['1', '2', '3', '4', '5', '6', '7'];
    const tile = pulseCountTile(
      { live: [], upcoming: [c({ startDate: '2026-09-25T06:00:00.000Z', participantFaces: faces }), c({ startDate: '2026-12-01T00:00:00.000Z' })] },
      NOW
    );
    expect(tile).toEqual({ startingSoonCount: 1, faces: faces.slice(0, 6) });
  });

  it('reads the Live tab’s exact params', () => {
    expect(api.buildCompetitionCardsQuery({ ...PULSE_CARD_PARAMS.live })).toBe('status=started&page=1&pageSize=20');
  });
});

describe('web-only feed reads: recent weighings, pulse people', () => {
  const weighing = {
    weighingDocumentId: 'w1',
    endAt: '2026-10-06T09:12:00.000Z',
    weighingType: 'normal',
    competition: { documentId: 'c1', name: 'Cupa Toamnei', posterUrl: 'https://cdn/x.jpg' },
    standLabel: 'Sector A, Stand 6',
    angler: { displayName: 'Ion Pop', avatarUrl: null, isTeam: false },
    catchCount: 3,
    totalKg: 12.45,
  };
  const person = {
    criterion: 'mostCompetitions',
    avatarUrls: [],
    destination: { type: 'angler', documentId: 'a1' },
    rank: 1,
    kicker: 'TOP CONCURSURI',
    displayName: 'Florin',
    line: '9 concursuri',
    meta: 'Din toate timpurile',
  };

  it('reads /feed/recent-weighings as a public read (null angler, open weighing type)', async () => {
    const odd = { ...weighing, weighingDocumentId: 'w2', angler: null, weighingType: 'bonus' };
    const { transport, calls } = createFakeTransport([{ data: [weighing, odd] }, null]);
    await expect(api.getRecentWeighings(transport)).resolves.toEqual([weighing, odd]);
    await expect(api.getRecentWeighings(transport)).resolves.toEqual([]);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/recent-weighings', auth: 'none' });
  });

  it('reads /feed/pulse-person?limit and falls back to [data] on an older CMS', async () => {
    const other = { ...person, displayName: 'Ana' };
    const { transport, calls } = createFakeTransport([{ data: person, items: [person, other] }, { data: person }, { data: null }]);
    await expect(api.getPulsePeople(transport, 6)).resolves.toEqual([person, other]);
    await expect(api.getPulsePeople(transport, 6)).resolves.toEqual([person]);
    await expect(api.getPulsePeople(transport, 6)).resolves.toEqual([]);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/feed/pulse-person', query: { limit: 6 }, auth: 'none' });
  });

  it('polls recent weighings on the 30s TTL and never retries nor polls a 404', () => {
    const { transport } = createFakeTransport();
    const q = recentWeighingsQuery(transport);
    expect(q.queryKey).toEqual(competitionCardsKeys.recentWeighings);
    // The interval (and the focus re-read) read the query's error: a 404 stops them, anything else polls.
    type Q = { state: { error: unknown } };
    const interval = q.refetchInterval as unknown as (q: Q) => number | false;
    const onFocus = q.refetchOnWindowFocus as unknown as (q: Q) => boolean;
    const at = (error: unknown) => ({ state: { error } });
    expect(interval(at(null))).toBe(RECENT_WEIGHINGS_POLL_MS);
    expect(interval(at(new ApiError({ message: 'x', status: 500, code: 'HTTP' })))).toBe(RECENT_WEIGHINGS_POLL_MS);
    expect(interval(at(new ApiError({ message: 'x', status: 404, code: 'HTTP' })))).toBe(false);
    expect(onFocus(at(null))).toBe(true);
    expect(onFocus(at(new ApiError({ message: 'x', status: 404, code: 'HTTP' })))).toBe(false);
    expect(RECENT_WEIGHINGS_POLL_MS).toBe(30_000);
    const off = recentWeighingsQuery(transport, { refetchInterval: false }).refetchInterval as unknown as (q: Q) => number | false;
    expect(off(at(null))).toBe(false);
    const retry = q.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, new ApiError({ message: 'x', status: 404, code: 'HTTP' }))).toBe(false);
    expect(retry(0, new ApiError({ message: 'x', status: 500, code: 'HTTP' }))).toBe(true);
    expect(retry(2, new ApiError({ message: 'x', status: 500, code: 'HTTP' }))).toBe(false);
  });

  it('keys pulse people by limit', () => {
    const { transport } = createFakeTransport();
    expect(pulsePeopleQuery(transport, 6).queryKey).toEqual(['competition-cards', 'pulse-people', 6]);
    expect(pulsePeopleQuery(transport, 6, false).enabled).toBe(false);
  });
});
