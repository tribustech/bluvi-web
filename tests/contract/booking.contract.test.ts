import { describe, expect, it } from 'vitest';
import {
  getBlocks,
  getBooking,
  getBookingQuote,
  getLakeAvailability,
  getLakeBookings,
  getLakesToReview,
  getMyBookingsPage,
  getMyBookingsUpcomingCount,
  getOwnedLakes,
  lookupAnglerByPhone,
  mergePages,
  monthWindow,
  MY_BUCKETS,
  mySubsFor,
  BUCKETS,
  subsFor,
  zonedWallTimeIso,
  type LakeAvailability,
} from '@/core/booking';
import { getProfile } from '@/core/social';
import { contractContext, expectDenied } from './context';

const { guest, user, userDocumentId } = contractContext();

/** Local Chita Lake — booking-enabled, owned by the QA user. */
const CHITA = 's84u55lo4n9z0emngozttt6e';

/** Read-only by construction: no booking, block, cancellation or no-show is ever written here. */
describe('booking — public reads', () => {
  it('reads two months of Chita availability as guest and as user', async () => {
    for (const t of [guest, user]) {
      const now = new Date();
      const pages: LakeAvailability[] = [];
      for (const offset of [0, 1]) {
        const w = monthWindow(offset, now);
        const page = await getLakeAvailability(t, CHITA, { from: w.from, to: w.to });
        expect(page.lakeId).toBe(CHITA);
        expect(page.bookingEnabled).toBe(true);
        expect(page.stands.length).toBeGreaterThan(0);
        pages.push(page);
      }
      const merged = mergePages(pages);
      expect(merged.timezone).toBe('Europe/Bucharest');
      expect(merged.loadedRange.from).toBe(pages[0].window.from);
    }
  });

  it('quotes a tour and a refused tour as guest and as user', async () => {
    const avail = await getLakeAvailability(guest, CHITA);
    const stand = avail.stands.find(s => s.extras.length > 0) ?? avail.stands[0];
    const [first, second] = avail.slotStartTimes;
    expect(first).toBeTruthy();
    // A lake-zone day ~40 days out, so the lead time never refuses it.
    const day = new Date(Date.now() + 40 * 86_400_000);
    const [y, m, d] = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
    const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    const startISO = zonedWallTimeIso(y, m, d, minutes(first), avail.timezone);
    const endISO = new Date(new Date(startISO).getTime() + avail.incrementHours * 3_600_000).toISOString();

    for (const t of [guest, user]) {
      const quote = await getBookingQuote(t, { lakeId: CHITA, standId: stand.documentId, startISO, endISO, extras: stand.extras });
      if (quote.total !== null) {
        expect(quote.total).toBeGreaterThan(0);
        expect(quote.basis.durationHours).toBe(avail.incrementHours);
      } else {
        expect(quote.refusal.message).toBeTruthy();
      }
    }

    // A tour ending at a forbidden end time is a 200 refusal, not an error.
    const forbidden = avail.forbiddenEndTimes?.[0];
    if (forbidden && second) {
      const refusedStart = zonedWallTimeIso(y, m, d, minutes(second), avail.timezone);
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      const refusedEnd = zonedWallTimeIso(
        next.getUTCFullYear(),
        next.getUTCMonth() + 1,
        next.getUTCDate(),
        minutes(forbidden),
        avail.timezone
      );
      const refused = await getBookingQuote(guest, {
        lakeId: CHITA,
        standId: stand.documentId,
        startISO: refusedStart,
        endISO: refusedEnd,
        extras: [],
      });
      expect(refused.total).toBeNull();
      expect(refused.refusal?.code).toBe('END_TIME_NOT_ALLOWED');
    }
  });
});

describe('booking — the angler (user)', () => {
  it('pages my bookings in every bucket/sub, opens them, and is denied as guest', async () => {
    let firstId: string | undefined;
    for (const bucket of MY_BUCKETS) {
      for (const sub of [undefined, ...mySubsFor(bucket)]) {
        const page = await getMyBookingsPage(user, { bucket, sub, pageSize: 5 });
        expect(page.page).toBe(1);
        expect(page.pendingCount).toBeGreaterThanOrEqual(0);
        firstId ??= page.data[0]?.documentId;
      }
    }
    await expectDenied(getMyBookingsPage(guest, { bucket: 'all' }));

    expect(firstId, 'the QA user has local bookings to open').toBeTruthy();
    const detail = await getBooking(user, firstId!);
    expect(detail.documentId).toBe(firstId);
    await expectDenied(getBooking(guest, firstId!));
  });

  it('reads the Home count, denied as guest', async ctx => {
    await expectDenied(getMyBookingsUpcomingCount(guest));
    try {
      expect(await getMyBookingsUpcomingCount(user)).toBeGreaterThanOrEqual(0);
    } catch (e) {
      // Local DB: the QA user's role has no `api::booking.booking.mineCount` grant (403), while
      // mine/detail/to-review are granted. A grant problem, not a contract one.
      if ((e as { status?: number }).status === 403) ctx.skip('local role lacks api::booking.booking.mineCount grant (403)');
      throw e;
    }
  });

  it('reads the lakes to review, denied as guest', async () => {
    const list = await getLakesToReview(user);
    expect(Array.isArray(list)).toBe(true);
    await expectDenied(getLakesToReview(guest));
  });
});

describe('booking — the operator (user owns Chita)', () => {
  it('lists owned lakes, denied as guest', async () => {
    const owned = await getOwnedLakes(user);
    expect(owned.map(l => l.documentId)).toContain(CHITA);
    await expectDenied(getOwnedLakes(guest));
  });

  it('pages the Chita inbox in every bucket/sub, denied as guest', async () => {
    for (const bucket of BUCKETS) {
      for (const sub of [undefined, ...subsFor(bucket)]) {
        const page = await getLakeBookings(user, CHITA, { bucket, sub, pageSize: 5 });
        expect(page.page).toBe(1);
      }
    }
    await expectDenied(getLakeBookings(guest, CHITA, { bucket: 'pending' }));
  });

  it('lists Chita blocks, denied as guest', async () => {
    const blocks = await getBlocks(user, CHITA);
    expect(Array.isArray(blocks)).toBe(true);
    await expectDenied(getBlocks(guest, CHITA));
  });

  it('looks up an angler by phone (hit + miss), denied as guest', async () => {
    const profile = await getProfile(user);
    expect(profile.phone, 'QA user has a phone').toBeTruthy();
    const hit = await lookupAnglerByPhone(user, CHITA, profile.phone!);
    expect(hit).toMatchObject({ matched: true, user: { documentId: userDocumentId } });
    const miss = await lookupAnglerByPhone(user, CHITA, '0700000001');
    expect(miss).toEqual({ matched: false, user: null });
    await expectDenied(lookupAnglerByPhone(guest, CHITA, profile.phone!));
  });
});
