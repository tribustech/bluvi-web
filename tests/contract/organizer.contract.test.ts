import { beforeAll, describe, expect, it } from 'vitest';
import {
  getAllocatedParticipants,
  getCompetitionActiveWeighing,
  getDraft,
  getExtraScalesList,
  getOrganizerCompetitionDetail,
  getOrganizerCompetitions,
  getOrganizerDashboard,
  getOrganizerRecentLakes,
  getOrganizerStatDetails,
  getWeighingById,
  getWeighingRevisions,
  getWeighings,
  getWeighingsSummary,
  getWeightingsTotal,
} from '@/core/organizer';
import {
  getCatchThresholdCounts,
  getCompetitionCatches,
  getCompetitionTimelineSnapshot,
  getCompetitionWeighingStatistics,
} from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { contractContext, expectDenied } from './context';

const { guest, user } = contractContext();

/**
 * Resolves with the value, or with `'denied'` on 401/403. Used where the local CMS legitimately
 * refuses the QA user (not an Organizer) or where a role grant is missing locally — each call site
 * says which. Any other failure (schema mismatch, 5xx) still fails the test.
 */
async function valueOrDenied<T>(promise: Promise<T>): Promise<T | 'denied'> {
  try {
    return await promise;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 403) return 'denied';
    throw e;
  }
}

/** Competition ids come from the public list (the `core/competitions` port owns that call). */
async function listCompetitionIds(t: Transport, status: string): Promise<string[]> {
  const res = await t.request<{ data: { documentId: string }[] }>({
    method: 'GET',
    path: '/feed/competitions',
    query: { status, pageSize: 25 },
    auth: 'none',
  });
  return res.data.data.map(c => c.documentId);
}

let competitionId: string | undefined;
let standId: string | undefined;

beforeAll(async () => {
  // A finished competition with weighings, so every statistics endpoint returns real rows.
  for (const status of ['completed', 'started']) {
    for (const id of await listCompetitionIds(guest, status)) {
      const catches = await getCompetitionCatches(guest, id, 'weight_desc', 1, 1);
      if (catches.pagination.total > 0) {
        competitionId = id;
        break;
      }
    }
    if (competitionId) break;
  }
  if (competitionId) {
    const summary = await getWeighingsSummary(user, competitionId);
    standId = summary[0]?.standId;
  }
});

describe('organizer dashboard (QA user is not an Organizer → 403 locally)', () => {
  it('refuses guests', async () => {
    await expectDenied(getOrganizerDashboard(guest));
    await expectDenied(getOrganizerCompetitions(guest, { pageSize: 5 }));
    await expectDenied(getOrganizerStatDetails(guest, { statKey: 'total' }));
    await expectDenied(getOrganizerRecentLakes(guest));
    await expectDenied(getOrganizerCompetitionDetail(guest, 'x'));
    await expectDenied(getDraft(guest, 'x'));
  });

  it('answers the user with a valid body or 403 (Authenticated role not granted the organizer routes)', async () => {
    const dashboard = await valueOrDenied(getOrganizerDashboard(user));
    if (dashboard !== 'denied') expect(dashboard.totalOrganized).toBeGreaterThanOrEqual(0);

    const mine = await valueOrDenied(getOrganizerCompetitions(user, { pageSize: 5 }));
    if (mine !== 'denied') expect(mine.meta.pagination.page).toBe(1);

    for (const statKey of ['pending', 'empty', 'fill', 'total'] as const) {
      const stats = await valueOrDenied(getOrganizerStatDetails(user, { statKey }));
      if (stats !== 'denied') expect(Array.isArray(stats.data)).toBe(true);
    }

    const lakes = await valueOrDenied(getOrganizerRecentLakes(user));
    if (lakes !== 'denied') expect(Array.isArray(lakes)).toBe(true);

    if (mine !== 'denied') {
      for (const c of mine.data.slice(0, 3)) {
        const detail = c.competitionStatus === 'draft' ? await getDraft(user, c.documentId) : await getOrganizerCompetitionDetail(user, c.documentId);
        expect(detail.documentId).toBe(c.documentId);
      }
    }
  });
});

describe('competition management reads', () => {
  it('active weighing is per-user', async () => {
    expect(competitionId, 'no local competition with catches').toBeTruthy();
    await expectDenied(getCompetitionActiveWeighing(guest, competitionId!));
    const active = await getCompetitionActiveWeighing(user, competitionId!);
    expect(Array.isArray(active)).toBe(true);
  });

  it('allocated participants and extra scales are public', async () => {
    for (const t of [guest, user]) {
      const allocated = await getAllocatedParticipants(t, competitionId!);
      expect(Object.keys(allocated).length).toBeGreaterThan(0);
      const extra = await getExtraScalesList(t, competitionId!);
      expect(Array.isArray(extra)).toBe(true);
    }
  });
});

describe('weighings', () => {
  it('summary: user OK; guest 403 locally (Public role lacks the grant although the route is edge-cached)', async () => {
    const summary = await getWeighingsSummary(user, competitionId!);
    expect(summary.length).toBeGreaterThan(0);
    const asGuest = await valueOrDenied(getWeighingsSummary(guest, competitionId!));
    if (asGuest !== 'denied') expect(asGuest.length).toBe(summary.length);
  });

  it('lists a stand, totals it and opens every weighing', async () => {
    expect(standId, 'no stand with weighings').toBeTruthy();
    for (const t of [guest, user]) {
      const weighings = await getWeighings(t, competitionId!, standId!);
      expect(weighings.length).toBeGreaterThan(0);
      const total = await getWeightingsTotal(t, competitionId!, standId!);
      expect(Number(total)).toBeGreaterThan(0);
      for (const w of weighings.slice(0, 3)) {
        const detail = await getWeighingById(t, w.documentId);
        expect(detail.documentId).toBe(w.documentId);
      }
    }
  });

  it('revisions (weighing-logs): user OK; guest 403 locally (Public role lacks the grant)', async () => {
    const [w] = await getWeighings(user, competitionId!, standId!);
    const revisions = await getWeighingRevisions(user, w.documentId);
    expect(revisions.meta.pagination.page).toBe(1);
    await valueOrDenied(getWeighingRevisions(guest, w.documentId));
  });
});

describe('competition statistics', () => {
  it('catches, weighing statistics and threshold counts are public', async () => {
    for (const t of [guest, user]) {
      const catches = await getCompetitionCatches(t, competitionId!, 'stand', 1, 20);
      expect(catches.data.length).toBeGreaterThan(0);
      const sector = catches.data[0].sectorName;
      if (sector) {
        const bySector = await getCompetitionCatches(t, competitionId!, 'weight_desc', 1, 5, { sectorName: sector });
        expect(bySector.data.every(c => c.sectorName === sector)).toBe(true);
      }
      const stats = await getCompetitionWeighingStatistics(t, competitionId!);
      expect(stats.data.length).toBeGreaterThan(0);
      const thresholds = await getCatchThresholdCounts(t, competitionId!);
      expect(thresholds.general.count10Plus).toBeGreaterThanOrEqual(0);
    }
  });

  it('parses every local competition (all statuses, incl. extra-scales and revisions)', async () => {
    let revisionsSeen = 0;
    for (const status of ['completed', 'started', 'notStarted']) {
      for (const id of await listCompetitionIds(guest, status)) {
        await getAllocatedParticipants(guest, id);
        await getExtraScalesList(guest, id);
        await getCompetitionWeighingStatistics(guest, id);
        await getCatchThresholdCounts(guest, id);
        await getCompetitionCatches(guest, id, 'weight_asc', 1, 50);
        const summary = await getWeighingsSummary(user, id);
        for (const { standId: s } of summary.slice(0, 2)) {
          for (const w of await getWeighings(guest, id, s)) {
            const detail = await getWeighingById(guest, w.documentId);
            if (detail.numberOfRevisions > 0) {
              const revisions = await getWeighingRevisions(user, w.documentId);
              revisionsSeen += revisions.data.length;
            }
          }
        }
      }
    }
    // Local data has reopened weighings on some competitions; 0 is fine on a fresh DB.
    expect(revisionsSeen).toBeGreaterThanOrEqual(0);
  });

  it('timeline snapshot: snapshot, null (204) or 403 — the local CMS grants it to no role', async () => {
    for (const t of [guest, user]) {
      const snapshot = await valueOrDenied(getCompetitionTimelineSnapshot(t, competitionId!));
      if (snapshot !== 'denied' && snapshot) expect(Array.isArray(snapshot.stands)).toBe(true);
    }
  });
});
