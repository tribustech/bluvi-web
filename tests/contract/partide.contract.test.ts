import { describe, expect, it } from 'vitest';
import {
  confirmSessionAccess,
  fetchAllFollowingUids,
  getActiveSession,
  getAllMySessions,
  getCommunityActive,
  getCommunityHistory,
  getCommunityOverview,
  getCommunitySession,
  getCommunityStats,
  getCommunityVenueCatches,
  getCommunityVenueSection,
  getMarkers,
  getMyCatches,
  getMySessionFollows,
  getMySessions,
  getSession,
  getSessionCatches,
  type CommunityVenueRef,
} from '@/core/partide';
import { contractContext, expectDenied } from './context';

const { guest, user, userDocumentId } = contractContext();

/** Local QA data: Chita Lake is owned by the QA user and has community history. */
const CHITA: CommunityVenueRef = { kind: 'lake', id: 's84u55lo4n9z0emngozttt6e' };

describe('partide — community (public)', () => {
  it('overview, active (cursor) and history (paged) parse as guest and as user', async () => {
    for (const t of [guest, user]) {
      const overview = await getCommunityOverview(t);
      expect(Array.isArray(overview.latestCatches)).toBe(true);

      const active = await getCommunityActive(t, { pageSize: 10 });
      expect(active.meta?.pagination.pageSize).toBe(10);
      if (active.meta?.nextCursor) await getCommunityActive(t, { pageSize: 10, cursor: active.meta.nextCursor });
      await getCommunityActive(t, { pageSize: 10, venues: ['lake:s84u55lo4n9z0emngozttt6e', 'water:AG-08'] });

      const history = await getCommunityHistory(t, { page: 1, pageSize: 10 });
      expect(history.meta.pagination.page).toBe(1);
      const narrowed = await getCommunityHistory(t, { page: 1, pageSize: 10, venues: ['lake:s84u55lo4n9z0emngozttt6e'] });
      for (const row of narrowed.data) expect(row.venue.key).toBe('lake:s84u55lo4n9z0emngozttt6e');
    }
  });

  it('stats (the Clasamente / leaderboard payload) parse for every period, community-wide and per venue', async () => {
    for (const t of [guest, user]) {
      for (const period of ['week', 'month', 'year'] as const) {
        const stats = await getCommunityStats(t, period);
        expect(stats.period).toBe(period);
      }
      const venueStats = await getCommunityStats(t, 'year', CHITA);
      expect(venueStats.period).toBe('year');
    }
  });

  it('session detail and its cursor-paged catches parse for sessions found in the feeds', async () => {
    const overview = await getCommunityOverview(guest);
    const history = await getCommunityHistory(guest, { page: 1, pageSize: 5 });
    const ids = [...new Set([...overview.latestCatches.map(c => c.sessionDocumentId), ...history.data.map(r => r.documentId)])].slice(0, 4);
    expect(ids.length).toBeGreaterThan(0);
    for (const t of [guest, user]) {
      for (const id of ids) {
        const detail = await getCommunitySession(t, id);
        expect(detail.documentId).toBe(id);
        const all = await getSessionCatches(t, id, { pageSize: 2 });
        if (all.meta.nextCursor) await getSessionCatches(t, id, { pageSize: 2, cursor: all.meta.nextCursor });
        await getSessionCatches(t, id, { photosOnly: true });
      }
    }
  });

  it('venue section and venue catches parse for a lake and for a public water', async () => {
    const stats = await getCommunityStats(guest, 'year');
    const waterKey = stats.topVenues.map(v => v.key).find(k => k.startsWith('water:'));
    const venues: CommunityVenueRef[] = [CHITA];
    if (waterKey) venues.push({ kind: 'water', code: waterKey.slice('water:'.length) });
    for (const t of [guest, user]) {
      for (const venue of venues) {
        const section = await getCommunityVenueSection(t, venue);
        expect(Array.isArray(section.monthlyActivity)).toBe(true);
        const catches = await getCommunityVenueCatches(t, venue, { page: 1, pageSize: 5 });
        expect(catches.meta.pagination.page).toBe(1);
      }
    }
    expect(venues.length, 'local stats list no public water to exercise the /waters routes').toBe(2);
  });
});

describe('partide — my sessions (per-user)', () => {
  it('lists my sessions, my catches, my follows and my live session as user; guest is denied', async () => {
    const page = await getMySessions(user, 1, 10);
    expect(page.meta.page).toBe(1);
    const all = await getAllMySessions(user);
    expect(all.total).toBe(page.meta.total);
    const catches = await getMyCatches(user, { pageSize: 5 });
    if (catches.meta.nextCursor) await getMyCatches(user, { pageSize: 5, cursor: catches.meta.nextCursor });
    expect(Array.isArray(await getMySessionFollows(user))).toBe(true);
    const active = await getActiveSession(user);
    expect(active === null || typeof active.documentId === 'string').toBe(true);

    await expectDenied(getMySessions(guest));
    await expectDenied(getMyCatches(guest, { pageSize: 5 }));
    await expectDenied(getMySessionFollows(guest));
    await expectDenied(getActiveSession(guest));
  });

  it('opens my own session detail when the QA user has one', async ({ skip }) => {
    const { data } = await getAllMySessions(user);
    // Local DB: the QA user sim-qa@bluvi.test has no partide (GET /feed/sessions/mine → total 0);
    // creating one would write sessions/Firestore, which this suite must not do.
    if (data.length === 0) skip();
    const detail = await getSession(user, data[0].documentId);
    expect(detail.clientId).toBe(data[0].clientId);
  });

  it('classifies a missing session as deleted (PARTIDA:NOT_FOUND); guest is denied', async () => {
    await expect(confirmSessionAccess(user, 'contract-missing-session')).resolves.toBe('deleted');
    await expectDenied(getSession(guest, 'contract-missing-session'));
  });

  it('walks my following list for the prieteni chip; guest is denied', async () => {
    const uids = await fetchAllFollowingUids(user, userDocumentId);
    expect(uids).toBeInstanceOf(Set);
    await expectDenied(fetchAllFollowingUids(guest, userDocumentId));
  });

  // Local CMS: the QA user's Authenticated role lacks `api::map-marker.map-marker.list`, so
  // GET /feed/map-markers answers 403 even signed in (verified with curl on 2026-09-27). The
  // guest-denied half is still asserted below.
  it.skip('lists map markers for a lake as user (local Authenticated role lacks map-marker.list → 403)', async () => {
    await getMarkers(user, { lakeId: CHITA.kind === 'lake' ? CHITA.id : '' });
  });

  it('denies map markers to a guest', async () => {
    await expectDenied(getMarkers(guest, { lakeId: 's84u55lo4n9z0emngozttt6e' }));
  });

  // Not exercised: every other partide call is a write (create/join/finish/extend/delete/leave,
  // kick/rotate, events, rods, photos, markers upsert/delete, follow/unfollow, legacy catch delete)
  // or a paid side effect (`/ai/format-text`). The suite never writes sessions/Firestore.
});
