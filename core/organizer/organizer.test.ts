import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { ApiError, type TransportRequest } from '../transport';
import { competitionCardsKeys, competitionsKeys, type Registration } from '../competitions';
import * as api from './api';
import {
  activeWeighing,
  allocated,
  competitionDoc,
  extraScale,
  paginated,
  participation,
  raffleActive,
  revisionClosed,
  revisionReopen,
  statDetailItem,
  weighingByStand,
  weighingDetail,
} from './fixtures.test-data';
import {
  acceptRegistrationMutation,
  addCatchToWeighingMutation,
  cancelOrganizerCompetitionMutation,
  createPenaltyMutation,
  invalidateOrganizerDashboardQueries,
  joinRaffleSessionMutation,
  reopenCantarMutation,
  startCompetitionMutation,
} from './mutations';
import {
  competitionManagementKeys,
  organizerCompetitionsInfiniteQuery,
  organizerDashboardQuery,
  organizerKeys,
  organizerStatDetailsInfiniteQuery,
  raffleKeys,
  raffleParticipationQuery,
  weighingKeys,
  weighingRevisionsQuery,
} from './queries';

const file = () => ({ blob: new Blob(['x'], { type: 'image/jpeg' }), filename: 'a.jpg' });

type Case = {
  name: string;
  run: (t: ReturnType<typeof createFakeTransport>['transport']) => Promise<unknown>;
  response: unknown;
  expect: Partial<TransportRequest>;
  result?: unknown;
};

const C = 'cmp1';
const W = 'w1';

const cases: Case[] = [
  // organizer.ts
  { name: 'getDraft', run: t => api.getDraft(t, 'd1'), response: { data: competitionDoc }, expect: { method: 'GET', path: '/competitions/organizer/draft/d1', auth: 'required' } },
  { name: 'createDraft', run: t => api.createDraft(t, { name: 'Cupa' }), response: { data: competitionDoc }, expect: { method: 'POST', path: '/competitions/organizer/draft', body: { data: { name: 'Cupa' } }, auth: 'required' } },
  { name: 'updateDraft', run: t => api.updateDraft(t, 'd1', { name: 'X' }), response: { data: competitionDoc }, expect: { method: 'PUT', path: '/competitions/organizer/draft/d1', body: { data: { name: 'X' } } } },
  { name: 'deleteDraft', run: t => api.deleteDraft(t, 'd1'), response: { data: { documentId: 'd1' } }, expect: { method: 'DELETE', path: '/competitions/organizer/draft/d1' }, result: { documentId: 'd1' } },
  { name: 'publishDraft', run: t => api.publishDraft(t, 'd1'), response: { data: { ...competitionDoc, competitionStatus: 'notStarted' } }, expect: { method: 'PUT', path: '/competitions/organizer/draft/d1/publish' } },
  {
    name: 'updateOrganizerCompetition',
    run: t => api.updateOrganizerCompetition(t, C, { name: 'X' }, true),
    response: {
      data: { ...competitionDoc, competitionStatus: 'notStarted' },
      meta: { allocationsReset: true, affectedAllocationsCount: 3, risks: [{ riskCode: 'LAKE_CHANGED_WITH_ALLOCATIONS' }], impact: { registeredCount: 3, pendingCount: 0, allocatedRegistrationsCount: 3, allocatedStandsCount: 3 }, triggers: ['x'] },
    },
    expect: { method: 'PUT', path: `/competitions/organizer/${C}`, body: { data: { name: 'X' }, confirmRiskChanges: true }, auth: 'required' },
  },
  {
    name: 'getOrganizerDashboard',
    run: t => api.getOrganizerDashboard(t),
    response: { data: { totalOrganized: 3, pendingRegistrations: 1, activeCompetitions: 2, emptySpots: 5, fillRate: 60, draftsCount: 1, byStatus: { draft: 1, notStarted: 2 } } },
    expect: { method: 'GET', path: '/competitions/organizer/dashboard', auth: 'required' },
  },
  {
    name: 'getOrganizerCompetitions',
    run: t => api.getOrganizerCompetitions(t, { status: '', page: 2, pageSize: 5 }),
    response: paginated([{ ...competitionDoc, viewers: 4, registrations: [] }], 2, 5, 6),
    expect: { method: 'GET', path: '/competitions/organizer/my-competitions', query: { page: 2, pageSize: 5 }, auth: 'required' },
  },
  { name: 'getOrganizerStatDetails', run: t => api.getOrganizerStatDetails(t, { statKey: 'pending' }), response: paginated([statDetailItem], 1, 5), expect: { path: '/competitions/organizer/stat-details', query: { statKey: 'pending' } } },
  { name: 'getOrganizerRecentLakes', run: t => api.getOrganizerRecentLakes(t), response: { data: [{ documentId: 'l1', name: 'Chita', lastUsedAt: '2026-01-01T00:00:00.000Z' }] }, expect: { path: '/competitions/organizer/recent-lakes', auth: 'required' } },
  {
    name: 'getOrganizerCompetitionDetail',
    run: t => api.getOrganizerCompetitionDetail(t, C),
    response: { data: { documentId: C, name: 'X', competitionStatus: 'completed', startDate: null, description: null, regulation: null } },
    expect: { path: `/competitions/organizer/${C}`, auth: 'required' },
  },
  {
    name: 'getOrganizerCompetitionSourceDetail (draft → draft endpoint)',
    run: t => api.getOrganizerCompetitionSourceDetail(t, { documentId: 'd1', name: 'X', competitionStatus: 'draft', startDate: null }),
    response: { data: competitionDoc },
    expect: { path: '/competitions/organizer/draft/d1' },
  },
  {
    name: 'cancelOrganizerCompetition',
    run: t => api.cancelOrganizerCompetition(t, C, { reason: 'Vreme' }),
    response: { data: { documentId: C, notifiedUsers: 4, failedNotifications: 0 } },
    expect: { method: 'PUT', path: `/competitions/organizer/${C}/cancel`, body: { reason: 'Vreme' } },
  },
  // competitions.ts (management)
  { name: 'getCompetitionActiveWeighing', run: t => api.getCompetitionActiveWeighing(t, C), response: [activeWeighing], expect: { method: 'GET', path: `/competitions/${C}/active-weighing`, auth: 'required' } },
  { name: 'startCompetition', run: t => api.startCompetition(t, C), response: { ...competitionDoc, competitionStatus: 'started' }, expect: { method: 'PUT', path: `/competitions/${C}/start` } },
  { name: 'endCompetition', run: t => api.endCompetition(t, C), response: { data: { ...competitionDoc, competitionStatus: 'completed' } }, expect: { method: 'PUT', path: `/competitions/${C}/end` } },
  { name: 'allocateStandsToSectors', run: t => api.allocateStandsToSectors(t, { competitionId: C, body: { allocations: { A: ['s1'] } } }), response: { data: competitionDoc }, expect: { method: 'POST', path: `/competitions/${C}/allocate-stands-to-sectors`, body: { allocations: { A: ['s1'] } } } },
  { name: 'allocateStandToRegistration', run: t => api.allocateStandToRegistration(t, { competitionId: C, body: { allocations: { r1: 's1' } } }), response: { success: true }, expect: { method: 'POST', path: `/competitions/${C}/allocate-stand-to-registration`, body: { allocations: { r1: 's1' } } } },
  { name: 'getAllocatedParticipants', run: t => api.getAllocatedParticipants(t, C), response: { data: allocated }, expect: { path: `/competitions/${C}/allocated-participants`, auth: 'none' }, result: allocated },
  { name: 'addCompetitionReferee', run: t => api.addCompetitionReferee(t, C, { documentId: 'u1' }), response: null, expect: { method: 'PATCH', path: `/competitions/${C}/referee`, body: { documentId: 'u1' } } },
  { name: 'removeCompetitionReferee', run: t => api.removeCompetitionReferee(t, C, 'u1'), response: null, expect: { method: 'DELETE', path: `/competitions/${C}/referee/u1` } },
  { name: 'getExtraScalesList', run: t => api.getExtraScalesList(t, C), response: [extraScale], expect: { path: `/competitions/${C}/extra-scale`, auth: 'none' } },
  { name: 'requestExtraScale', run: t => api.requestExtraScale(t, C), response: { data: { message: 'ok' } }, expect: { method: 'POST', path: `/competitions/${C}/request-extra` } },
  { name: 'deleteExtraScaleRequest', run: t => api.deleteExtraScaleRequest(t, C), response: { id: 1, documentId: 'e1', extraStatus: 'cancelled' }, expect: { method: 'DELETE', path: `/competitions/${C}/request-extra` } },
  // weighing.ts
  { name: 'getWeighingsSummary', run: t => api.getWeighingsSummary(t, C), response: { data: [{ standId: 's1', totalKg: 108.6, regularCount: 5, extraCount: 0 }] }, expect: { path: `/competitions/${C}/weighings-summary`, auth: 'optional' } },
  { name: 'getWeighings', run: t => api.getWeighings(t, C, 's1'), response: { data: [weighingByStand] }, expect: { path: '/feed/weighings/by-stand', query: { competitionId: C, standId: 's1' }, auth: 'none' } },
  { name: 'getWeightingsTotal', run: t => api.getWeightingsTotal(t, C, 's1'), response: { data: [weighingByStand, weighingByStand] }, expect: { path: '/feed/weighings/by-stand' }, result: '39.200' },
  { name: 'getWeighingById', run: t => api.getWeighingById(t, W), response: weighingDetail, expect: { path: `/feed/weighings/${W}`, auth: 'none' } },
  {
    name: 'startCantar',
    run: t => api.startCantar(t, { standId: 's1', competitionId: C, weighingType: 'extra' }),
    response: { id: 1, documentId: W, weighingStatus: 'started', weighingType: 'extra', startDate: '2026-05-08T14:55:00.000Z' },
    expect: { method: 'POST', path: '/weighings/start', body: { data: { stand: 's1', competition: C, weighingType: 'extra' } } },
  },
  { name: 'deleteCantar', run: t => api.deleteCantar(t, W), response: { data: { documentId: W, deletedCatches: 2 } }, expect: { method: 'DELETE', path: `/weighings/${W}` } },
  { name: 'addCatchToWeighing', run: t => api.addCatchToWeighing(t, W, [{ weight: 4.2, fishType: 'f1' }]), response: [{ id: 1, documentId: 'c1', weight: 4.2 }], expect: { method: 'POST', path: `/weighings/${W}/catch`, body: [{ weight: 4.2, fishType: 'f1' }] } },
  { name: 'endCantar', run: t => api.endCantar(t, W), response: { message: 'Cântarul a fost închis cu succes.' }, expect: { method: 'POST', path: `/weighings/${W}/end` } },
  { name: 'reopenWeighing', run: t => api.reopenWeighing(t, { weighingId: W, competitionId: C, reason: 'Uitat' }), response: { message: 'ok' }, expect: { method: 'POST', path: `/weighings/${W}/reopen`, body: { data: { competitionId: C, reason: 'Uitat' } } } },
  {
    name: 'getWeighingRevisions',
    run: t => api.getWeighingRevisions(t, W),
    response: paginated([revisionReopen, revisionClosed], 1, 100),
    expect: {
      path: '/weighing-logs',
      auth: 'optional',
      query: {
        filters: { weighing: { documentId: W } },
        sort: ['createdAt:asc'],
        populate: { author: { fields: ['id', 'username'] }, weighing: { fields: ['id'] } },
        pagination: { pageSize: 100, page: 1 },
      },
    },
  },
  // penalties.ts
  {
    name: 'createPenalty',
    run: t => api.createPenalty(t, { competitionId: C, registrationId: 'r1', action: 'DEDUCT_TOTAL_WEIGHT', value: 1.5, reason: 'Nada' }),
    response: { id: 7, documentId: 'p1', action: 'DEDUCT_TOTAL_WEIGHT', value: 1.5, reason: 'Nada', createdAt: '2026-05-08T15:00:00.000Z' },
    expect: { method: 'POST', path: `/competitions/${C}/registrations/r1/penalties`, body: { action: 'DEDUCT_TOTAL_WEIGHT', value: 1.5, reason: 'Nada' } },
  },
  { name: 'deletePenalty', run: t => api.deletePenalty(t, 'p1'), response: null, expect: { method: 'DELETE', path: '/penalties/p1' } },
  // raffle.ts
  { name: 'fetchActiveRaffle', run: t => api.fetchActiveRaffle(t), response: raffleActive, expect: { path: '/raffle-sessions/active', auth: 'none' } },
  { name: 'fetchActiveRaffle (no session)', run: t => api.fetchActiveRaffle(t), response: { data: null }, expect: { path: '/raffle-sessions/active' }, result: null },
  { name: 'fetchRaffleParticipation', run: t => api.fetchRaffleParticipation(t), response: { data: participation }, expect: { path: '/raffle-sessions/participation', auth: 'required' } },
  { name: 'joinRaffleSession', run: t => api.joinRaffleSession(t, 'f5jc', 'crap'), response: { data: participation }, expect: { method: 'POST', path: '/raffle-sessions/f5jc/join', body: { typeKey: 'crap' } } },
  {
    name: 'uploadRaffleReceipt',
    run: t => api.uploadRaffleReceipt(t, 'f5jc', file(), { mediaOrigin: 'http://cms' }),
    response: { data: { url: '/uploads/r.jpg', fileId: 9, participation: { ...participation, canChangeType: undefined } } },
    expect: { method: 'POST', path: '/raffle-sessions/f5jc/receipt', auth: 'required' },
  },
  { name: 'deleteRaffleReceipt', run: t => api.deleteRaffleReceipt(t, 'f5jc'), response: { data: { ...participation, receiptUrl: undefined, receiptUploaded: false } }, expect: { method: 'DELETE', path: '/raffle-sessions/f5jc/receipt' } },
  // catch.ts (media.ts + requestOrganizerRole are tested in core/social)
  { name: 'deleteCatch', run: t => api.deleteCatch(t, 'c1'), response: { data: { statusCode: 204, message: 'Operation was successful' } }, expect: { method: 'DELETE', path: '/catches/c1' } },
];

describe('organizer api', () => {
  it.each(cases)('$name', async c => {
    const { transport, calls } = createFakeTransport([c.response]);
    const result = await c.run(transport);
    expect(calls[0]).toMatchObject(c.expect);
    if ('result' in c) expect(result).toEqual(c.result);
  });

  it('never sends an empty status filter (fish withQuery)', async () => {
    const { transport, calls } = createFakeTransport([paginated([])]);
    await api.getOrganizerCompetitions(transport, 'draft');
    expect(calls[0].query).toEqual({ status: 'draft' });
  });

  it('normalises a bare-array organizer list', async () => {
    const { transport } = createFakeTransport([[competitionDoc]]);
    const res = await api.getOrganizerCompetitions(transport, { pageSize: 10 });
    expect(res.meta.pagination).toEqual({ page: 1, pageSize: 10, pageCount: 1, total: 1 });
  });

  it('strips author PII from the draft', async () => {
    const { transport } = createFakeTransport([{ data: competitionDoc }]);
    const draft = await api.getDraft(transport, 'd1');
    expect(draft.author).toEqual({ id: 13, documentId: 'q9kp', username: 'Toni' });
  });

  it('resolves relative raffle media against the given origin', async () => {
    const { transport } = createFakeTransport([raffleActive]);
    const res = await api.fetchActiveRaffle(transport, { mediaOrigin: 'http://cms' });
    expect(res?.session.headerLogoLeftUrl).toBe('http://cms/uploads/left.png');
    expect(res?.session.prizes?.[0].image?.url).toBe('http://cms/uploads/kit.jpg');
    expect(res?.session.prizes?.[0].items?.[0].image?.url).toBe('http://cms/uploads/m.jpg');
    expect(res?.winnersByTypeKey?.crap[0].avatarUrl).toBe('http://cms/uploads/a.jpg');
  });

  it('maps a 404 raffle / 401 participation to null', async () => {
    const failing = (status: number) => ({
      request: async () => {
        throw new ApiError({ message: 'x', status, code: 'HTTP' });
      },
    });
    await expect(api.fetchActiveRaffle(failing(404))).resolves.toBeNull();
    await expect(api.fetchRaffleParticipation(failing(401))).resolves.toBeNull();
    await expect(api.fetchRaffleParticipation(failing(500))).rejects.toMatchObject({ status: 500 });
  });
});

describe('organizer queries', () => {
  const { transport: t } = createFakeTransport();

  it('keeps the fish key shapes', () => {
    expect(organizerKeys.competitions('draft', 10)).toEqual(['organizer', 'competitions', { status: 'draft', pageSize: 10 }]);
    expect(organizerKeys.competitions()).toEqual(['organizer', 'competitions', { status: 'all', pageSize: null }]);
    expect(organizerKeys.statDetails(undefined, 5)).toEqual(['organizer', 'stat-details', { statKey: null, pageSize: 5 }]);
    expect(weighingKeys.totalWeightByCompetitionIdAndStandId('c', 's')).toEqual(['weighings', 'competition', 'c', 'stand', 's', 'totalWeight']);
    expect(weighingKeys.revisions('w')).toEqual(['weighings', 'id', 'w', 'revisions']);
    expect(competitionManagementKeys.activeWeighingById('c')).toEqual(['competitions', 'c', 'active-weighing']);
    expect(competitionManagementKeys.extraScalesList('c')).toEqual(['competition', 'c', 'extra-scales-list']);
    expect(raffleKeys.participation).toEqual(['raffle', 'participation']);
  });

  it('gates organizer queries on the role', () => {
    expect(organizerDashboardQuery(t, { isOrganizer: false }).enabled).toBe(false);
    expect(organizerCompetitionsInfiniteQuery(t, { isOrganizer: true, status: 'draft' }).queryKey).toEqual(organizerKeys.competitions('draft', 10));
    expect(organizerStatDetailsInfiniteQuery(t, null, { isOrganizer: true }).enabled).toBe(false);
    expect(organizerStatDetailsInfiniteQuery(t, 'fill', { isOrganizer: true }).queryKey).toEqual(organizerKeys.statDetails('fill', 5));
  });

  it('groups revisions by session', async () => {
    const { transport } = createFakeTransport([paginated([revisionReopen, { ...revisionClosed, sessionId: 2 }])]);
    const q = weighingRevisionsQuery(transport, 'w');
    expect(q.staleTime).toBe(0);
    const grouped = await (q.queryFn as () => Promise<Record<number, unknown[]>>)();
    expect(Object.keys(grouped)).toEqual(['1', '2']);
  });

  it('only asks for participation with a session and a user', () => {
    expect(raffleParticipationQuery(t, { isAuthenticated: true, hasActiveSession: false }).enabled).toBe(false);
    expect(raffleParticipationQuery(t, { isAuthenticated: true, hasActiveSession: true }).enabled).toBe(true);
  });
});

describe('organizer mutations', () => {
  const run = async (options: object, qc: QueryClient, v: unknown) =>
    qc.getMutationCache().build(qc, options as never).execute(v as never);

  it('invalidates the organizer dashboard family and the Concursuri cards', async () => {
    const qc = new QueryClient();
    const keys = [organizerKeys.dashboard, organizerKeys.competitions('draft', 10), organizerKeys.statDetails('fill', 5), ['competition-cards', 'list', 'x'], ['news']];
    keys.forEach(k => qc.setQueryData(k, 1));
    await invalidateOrganizerDashboardQueries(qc);
    expect(keys.map(k => qc.getQueryState(k)?.isInvalidated)).toEqual([true, true, true, true, false]);
  });

  it('cancel also invalidates the competition detail', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['competitions', 'c1'], 1);
    const { transport } = createFakeTransport([{ data: { documentId: 'c1', notifiedUsers: 1, failedNotifications: 0 } }]);
    await run(cancelOrganizerCompetitionMutation(transport, qc), qc, { id: 'c1' });
    expect(qc.getQueryState(['competitions', 'c1'])?.isInvalidated).toBe(true);
  });

  it('start competition refreshes the live competition', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['competition', 'live'], 1);
    const { transport } = createFakeTransport([{ ...competitionDoc, competitionStatus: 'started' }]);
    await run(startCompetitionMutation(transport, qc), qc, 'c1');
    expect(qc.getQueryState(['competition', 'live'])?.isInvalidated).toBe(true);
  });

  it('penalties invalidate both rankings', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['rankings', 'c1'], 1);
    qc.setQueryData(['competition', 'c1', 'ranking-best-n'], 1);
    const { transport } = createFakeTransport([{ documentId: 'p', action: 'WARNING', value: null, reason: 'Motiv', createdAt: 'x' }]);
    await run(createPenaltyMutation(transport, qc, 'c1'), qc, { competitionId: 'c1', registrationId: 'r', action: 'WARNING', reason: 'Motiv' });
    expect(qc.getQueryState(['rankings', 'c1'])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['competition', 'c1', 'ranking-best-n'])?.isInvalidated).toBe(true);
  });

  it('shows added catches optimistically and rolls them back on failure', async () => {
    const qc = new QueryClient();
    qc.setQueryData(weighingKeys.byId(W), weighingDetail);
    const failing = { request: async () => { throw new Error('down'); } };
    const options = addCatchToWeighingMutation(failing, qc, W);
    expect('mutationKey' in options && options.mutationKey).toEqual(['add-catch', W]);
    const ctx = await (options.onMutate as (v: unknown) => Promise<unknown>)({ weighingId: W, data: [{ weight: 2, fishType: 'f' }], fishTypeName: 'Crap' });
    const optimistic = qc.getQueryData<typeof weighingDetail>(weighingKeys.byId(W));
    expect(optimistic?.catches[0]).toMatchObject({ documentId: 'optimistic-catch-0', weight: 2, fishType: { Name: 'Crap' } });
    (options.onError as (e: unknown, v: unknown, c: unknown) => void)(new Error('down'), { weighingId: W }, ctx);
    expect(qc.getQueryData(weighingKeys.byId(W))).toEqual(weighingDetail);
  });

  it('reopen flips the weighing to started and restores on error', async () => {
    const qc = new QueryClient();
    const key = weighingKeys.byCompetitionIdAndStandId(C, 's1');
    qc.setQueryData(key, [weighingByStand]);
    const options = reopenCantarMutation(createFakeTransport().transport, qc, { weighingId: weighingByStand.documentId, standId: 's1' });
    const vars = { weighingId: weighingByStand.documentId, competitionId: C, reason: 'x' };
    const ctx = await (options.onMutate as (v: unknown) => Promise<unknown>)(vars);
    expect(qc.getQueryData<(typeof weighingByStand)[]>(key)?.[0].weighingStatus).toBe('started');
    (options.onError as (e: unknown, v: unknown, c: unknown) => void)(new Error('x'), vars, ctx);
    expect(qc.getQueryData(key)).toEqual([weighingByStand]);
  });

  it('raffle writes refresh session, participation and competitions', async () => {
    const qc = new QueryClient();
    [raffleKeys.active, raffleKeys.participation, ['competitions', 'x']].forEach(k => qc.setQueryData(k, 1));
    const { transport } = createFakeTransport([{ data: participation }]);
    await run(joinRaffleSessionMutation(transport, qc), qc, { sessionDocumentId: 'f5jc', typeKey: 'crap' });
    expect(qc.getQueryState(raffleKeys.active)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(raffleKeys.participation)?.isInvalidated).toBe(true);
    expect(qc.getQueryState(['competitions', 'x'])?.isInvalidated).toBe(true);
  });

  it('accepts a registration optimistically and marks the list stale WITHOUT refetching', async () => {
    const qc = new QueryClient();
    const key = competitionsKeys.registrationsListById('c');
    const list = [
      { id: 1, documentId: 'reg-1', registrationStatus: 'pending', teamName: null },
      { id: 2, documentId: 'reg-2', registrationStatus: 'registered', teamName: null },
    ] as Registration[];
    qc.setQueryData(key, list);
    const invalidate = vi.spyOn(qc, 'invalidateQueries');
    const { transport } = createFakeTransport([null]);
    const m = acceptRegistrationMutation(transport, qc, 'c');
    const ctx = await m.onMutate!('reg-1', {} as never);
    expect(qc.getQueryData<Registration[]>(key)![0].registrationStatus).toBe('registered');
    m.onError!(new Error('x'), 'reg-1', ctx, {} as never);
    expect(qc.getQueryData(key)).toEqual(list);
    await m.onSettled!(undefined, null, 'reg-1', ctx, {} as never);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: key, refetchType: 'none' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: competitionsKeys.byId('c'), exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: competitionCardsKeys.root });
  });
});
