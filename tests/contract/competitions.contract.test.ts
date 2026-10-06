import { beforeAll, describe, expect, it } from 'vitest';
import {
  COMPETITION_CARD_STATUSES,
  DEFAULT_COMPETITION_FILTERS,
  SIGNED_OUT_MY_STATUS,
  getCatchThresholdCounts,
  getCompetition,
  getCompetitionCards,
  getCompetitionCatches,
  getCompetitionMyStatus,
  getCompetitionNotificationPreferences,
  getCompetitionRegistrations,
  getCompetitionsByStatus,
  getCompetitionsList,
  getCompetitionSuggestions,
  getCompetitionTimelineSnapshot,
  getCompetitionWeighingStatistics,
  getCurrentPoll,
  getFeaturedCompetition,
  getFishSpecies,
  getFollowedCompetitions,
  getFollowers,
  getFutureCompetitions,
  getLiveCompetition,
  getMyCompetitions,
  getPastPolls,
  getPulsePerson,
  getRankingBestN,
  getRankings,
  getSponsorById,
  getSponsors,
  getStandStatsByLakeId,
  updateCompetitionNotificationPreferences,
  feederGeneralModel,
  feederLegModel,
  feederTabCount,
  isNationalChampionshipRankings,
  ncGeneralModel,
  ncSectorRows,
  type FeederRoundsRanking,
  type CompetitionCatchesSort,
  type CompetitionListItem,
  type CompetitionStatus,
} from '@/core/competitions';
import { getUSerStatuteForCompetition, postUserStatisticsBatch } from '@/core/social';
import { isApiError } from '@/core/transport';
import { contractContext, expectDenied } from './context';

const { guest, user, userDocumentId } = contractContext();

/** Every competition the local CMS lists, discovered once. */
let all: CompetitionListItem[] = [];
const STATUSES: CompetitionStatus[] = ['notStarted', 'started', 'completed'];

beforeAll(async () => {
  for (const status of STATUSES) {
    const res = await getCompetitionsByStatus(guest, status, { page: 1, pageSize: 100 });
    all.push(...res.data);
  }
  all = all.filter((c, i, a) => a.findIndex(x => x.documentId === c.documentId) === i);
});

const ranked = () => all.filter(c => c.competitionStatus !== 'notStarted');

describe('competitions — lists', () => {
  it('lists /feed/competitions by status, with and without a lake, as guest and user', async () => {
    expect(all.length).toBeGreaterThan(0);
    const lakeId = all.find(c => c.lake)?.lake?.documentId;
    for (const t of [guest, user]) {
      for (const status of STATUSES) {
        const res = await getCompetitionsByStatus(t, status, { page: 1, pageSize: 5 });
        expect(res.meta.pagination.page).toBe(1);
        if (lakeId) await getCompetitionsByStatus(t, status, { pageSize: 5 }, lakeId);
      }
      await getFutureCompetitions(t, { pagination: { pageSize: 5 } });
    }
  });

  it('parses the legacy /competitions list as guest and user', async () => {
    for (const t of [guest, user]) {
      const list = await getCompetitionsList(t, { page: 1, pageSize: 100 });
      expect(Array.isArray(list)).toBe(true);
    }
  });

  it('reads my competitions as user and refuses a guest', async () => {
    const res = await getMyCompetitions(user, { page: 1, pageSize: 10 });
    expect(res.meta.pagination.page).toBe(1);
    // fish never calls it signed out. The CMS answers a guest with a 500
    // (COMPETITION:FIND_MY_COMPETITIONS_ERROR) instead of 401/403 — refused either way.
    await expect(getMyCompetitions(guest)).rejects.toMatchObject({ status: 500, bluCode: 'COMPETITION:FIND_MY_COMPETITIONS_ERROR' });
  });
});

describe('competitions — detail', () => {
  it('opens every competition, its fish species and followers, as guest and user', async () => {
    for (const c of all) {
      for (const t of [guest, user]) {
        const detail = await getCompetition(t, c.documentId);
        expect(detail.documentId).toBe(c.documentId);
      }
      await getFishSpecies(guest, c.documentId);
      await getFollowers(guest, c.documentId);
      await getFollowers(user, c.documentId);
    }
  });

  it('reads my-status as user; a guest degrades to the signed-out overlay (401 swallowed)', async () => {
    for (const c of all.slice(0, 10)) {
      const status = await getCompetitionMyStatus(user, c.documentId);
      expect(typeof status.isFollowing).toBe('boolean');
      await expect(getCompetitionMyStatus(guest, c.documentId)).resolves.toEqual(SIGNED_OUT_MY_STATUS);
    }
  });

  it('reads the registrations list as user and refuses a guest', async () => {
    for (const c of all) await getCompetitionRegistrations(user, c.documentId);
    await expectDenied(getCompetitionRegistrations(guest, all[0].documentId));
  });

  it('reads the live competition as user and refuses a guest', async () => {
    const live = await getLiveCompetition(user);
    expect(live === null || typeof live.competition.documentId === 'string').toBe(true);
    await expectDenied(getLiveCompetition(guest));
  });

  it.skip('follow → unfollow round trip — skipped: this task forbids writes to competitions (followers relation)', () => {});
});

describe('competitions — Competiții cards', () => {
  const base = { search: null, filters: DEFAULT_COMPETITION_FILTERS, sort: 'date' as const };

  it('reads the public card lists for every status as guest and user', async () => {
    for (const t of [guest, user]) {
      for (const status of COMPETITION_CARD_STATUSES) {
        const page = await getCompetitionCards(t, { ...base, scope: 'all', status, pageSize: 50 });
        expect(page.meta.counts).toBeDefined();
      }
      await getCompetitionCards(t, { ...base, scope: 'all', sort: 'places', filters: { ...DEFAULT_COMPETITION_FILTERS, format: 'team' } });
      await getCompetitionCards(t, { ...base, scope: 'all', search: { type: 'text', value: 'cupa', label: 'cupa' } });
    }
  });

  it('reads the per-user card lists as user and refuses a guest', async () => {
    for (const scope of ['registered', 'organized', 'followed'] as const) {
      await getCompetitionCards(user, { ...base, scope });
      await getCompetitionCards(user, { ...base, scope, status: 'started' });
    }
    await expectDenied(getCompetitionCards(guest, { ...base, scope: 'registered' }));
  });

  it('reads suggestions, featured and pulse person as guest and user', async () => {
    for (const t of [guest, user]) {
      const groups = await getCompetitionSuggestions(t, '');
      expect(Array.isArray(groups)).toBe(true);
      await getCompetitionSuggestions(t, 'cupa');
      // competitions-list.results.c11: a lake / organizer pick narrows the cards by documentId, with
      // every filter the sheet sends (a county from the explore suggestions, a custom range).
      const lake = groups.flatMap(g => g.items).find(s => s.type === 'lake');
      const organizer = groups.flatMap(g => g.items).find(s => s.type === 'organizer');
      for (const pick of [lake, organizer]) {
        if (!pick) continue;
        const search = { type: pick.type as 'lake' | 'organizer', value: pick.value, label: pick.title };
        const page = await getCompetitionCards(t, { ...base, scope: 'all', search });
        expect(page.meta.pagination.total).toBeGreaterThan(0);
        await getCompetitionCards(t, {
          ...base,
          scope: 'all',
          search,
          status: 'notStarted',
          filters: { period: '2026-01-01..2026-12-31', format: 'single', availableOnly: true, countyId: 'none', countyName: null },
        });
      }
      await getFeaturedCompetition(t);
      // The server draws one of ten criteria per request: sample several to cover more shapes.
      for (let i = 0; i < 5; i++) await getPulsePerson(t);
    }
  });
});

describe('competitions — rankings', () => {
  const SORTS: CompetitionCatchesSort[] = ['weight_asc', 'weight_desc', 'stand', 'sector'];

  it('reads the ranking of every started/completed competition (all ranking types)', async () => {
    const types = new Set<string>();
    for (const c of ranked()) {
      const r = await getRankings(guest, c.documentId);
      types.add(r.metadata.rankingType);
    }
    // The local DB carries every ranking type the table builders dispatch on.
    expect(types.size).toBeGreaterThan(3);
    await getRankings(user, ranked()[0].documentId);
  });

  it('feeds the feeder-legs and club (NC / FIPSed) rankings into their view models', async () => {
    let feeder = 0;
    let clubs = 0;
    for (const c of ranked()) {
      const r = await getRankings(guest, c.documentId);
      if (r.metadata.rankingType === 'feederRounds') {
        const rows = r.rankings as FeederRoundsRanking[];
        const legs = feederTabCount(rows, r.metadata.roundsCount);
        expect(feederGeneralModel(rows, legs).rows).toHaveLength(rows.length);
        for (let leg = 1; leg <= legs; leg++) {
          const { sections } = feederLegModel(rows, leg);
          expect(sections.reduce((n, s) => n + s.rows.length, 0)).toBe(rows.length);
        }
        feeder++;
      } else if (isNationalChampionshipRankings(r.rankings)) {
        expect(ncGeneralModel(r.rankings, r.metadata.numberOfSectors)).toHaveLength(r.rankings.length);
        for (const sectorId of new Set(r.rankings.flatMap(club => club.teams.map(t => t.sectorId)))) {
          expect(ncSectorRows(r.rankings, sectorId, 'position').length).toBeGreaterThan(0);
        }
        clubs++;
      }
    }
    expect(feeder + clubs).toBeGreaterThan(0);
  });

  it('reads best-N, catches (every sort and filter), weighing stats and thresholds', async () => {
    for (const c of ranked()) {
      await getRankingBestN(guest, c.documentId);
      await getCompetitionWeighingStatistics(guest, c.documentId);
      await getCatchThresholdCounts(guest, c.documentId);
      for (const sort of SORTS) {
        const page = await getCompetitionCatches(guest, c.documentId, sort, 1, 20);
        const first = page.data[0];
        if (first?.sectorName) await getCompetitionCatches(guest, c.documentId, sort, 1, 20, { sectorName: first.sectorName });
        if (first?.standName) await getCompetitionCatches(guest, c.documentId, sort, 1, 20, { standKey: `${first.sectorName}${first.standName}` });
      }
    }
    const c = ranked()[0];
    await getRankingBestN(user, c.documentId);
    await getCompetitionCatches(user, c.documentId, 'weight_desc', 1);
  });

  it('reads the timeline snapshot', async ctx => {
    for (const c of ranked()) {
      try {
        await getCompetitionTimelineSnapshot(user, c.documentId);
        await getCompetitionTimelineSnapshot(guest, c.documentId);
      } catch (e) {
        // Route has no `auth: false` and the local Public/Authenticated roles lack the
        // `competition.getTimelineSnapshot` grant, so both answer 403 locally.
        if (isApiError(e) && e.status === 403) {
          ctx.skip('local CMS: Public/Authenticated roles lack the competition.getTimelineSnapshot grant (403)');
        }
        throw e;
      }
    }
  });
});

describe('competitions — stands, polls, sponsors', () => {
  it('reads stand stats for every lake that hosts a competition', async () => {
    const lakeIds = [...new Set(all.map(c => c.lake?.documentId).filter((x): x is string => !!x))];
    for (const id of [...lakeIds, 's84u55lo4n9z0emngozttt6e']) {
      await getStandStatsByLakeId(guest, id);
      await getStandStatsByLakeId(user, id);
    }
  });

  it('reads polls as user and refuses a guest', async () => {
    await getCurrentPoll(user);
    const past = await getPastPolls(user, { page: 1, pageSize: 10 });
    expect(past.meta.pagination.page).toBe(1);
    await expectDenied(getCurrentPoll(guest));
    await expectDenied(getPastPolls(guest));
  });

  it('reads the sponsor dashboard and every sponsor as guest and user', async () => {
    for (const t of [guest, user]) {
      const list = await getSponsors(t);
      for (const s of list.data) {
        const detail = await getSponsorById(t, s.documentId);
        expect(detail.data.documentId).toBe(s.documentId);
      }
    }
  });
});

describe('competitions — notification preferences and profile', () => {
  it('reads followed competitions and preferences as user; refuses a guest', async () => {
    const followed = await getFollowedCompetitions(user);
    const id = followed[0]?.documentId ?? all[0].documentId;
    const prefs = await getCompetitionNotificationPreferences(user, id);
    expect(prefs.groups.length).toBeGreaterThan(0);
    await expectDenied(getFollowedCompetitions(guest));
    await expectDenied(getCompetitionNotificationPreferences(guest, id));
  });

  it('round-trips the current muted list unchanged (idempotent PUT)', async () => {
    const followed = await getFollowedCompetitions(user);
    const id = followed[0]?.documentId ?? all[0].documentId;
    const before = await getCompetitionNotificationPreferences(user, id);
    const muted = [
      ...before.groups.flatMap(g => g.types.filter(t => t.muted).map(t => t.key)),
      ...(before.extraMuted ?? []),
    ];
    const after = await updateCompetitionNotificationPreferences(user, id, muted);
    expect(after.groups).toEqual(before.groups);
  });

  it('reads the statute and the participant stats batch as user; refuses a guest', async () => {
    for (const c of all.slice(0, 10)) {
      const statute = await getUSerStatuteForCompetition(user, c.documentId);
      expect(['author', 'referee', 'participant', null]).toContain(statute.userRole);
    }
    const ids = [userDocumentId, ...all.flatMap(c => c.registrations.flatMap(r => r.participants.map(p => p.documentId)))].slice(0, 30);
    const stats = await postUserStatisticsBatch(user, ids);
    expect(stats[userDocumentId]).toBeDefined();
    await expectDenied(getUSerStatuteForCompetition(guest, all[0].documentId));
    await expectDenied(postUserStatisticsBatch(guest, ids));
  });
});
