import { describe, expect, it } from 'vitest';
import {
  BUCKET_LABELS,
  BUCKETS,
  bucketFromLegacyStatus,
  defaultSub,
  emptyCopy,
  subsFor,
  SUB_LABELS,
} from './operatorBookingBuckets';

describe('subsFor', () => {
  it('gives sub-filters only to the two buckets that need them', () => {
    expect(subsFor('pending')).toEqual([]);
    expect(subsFor('all')).toEqual([]);
    expect(subsFor('confirmed')).toEqual(['today', 'upcoming', 'past', 'toreview']);
    expect(subsFor('unfinished')).toEqual(['rejected', 'cancelled', 'noshow']);
  });

  it('gives Confirmate a fourth sub for the review queue', () => {
    expect(subsFor('confirmed')).toEqual(['today', 'upcoming', 'past', 'toreview']);
  });
});

describe('defaultSub', () => {
  it('opens Confirmate on today and Nefinalizate unfiltered', () => {
    expect(defaultSub('confirmed')).toBe('today');
    expect(defaultSub('unfinished')).toBeUndefined();
    expect(defaultSub('pending')).toBeUndefined();
    expect(defaultSub('all')).toBeUndefined();
  });
});

describe('bucketFromLegacyStatus', () => {
  // Home and the operator panel deep-link here with ?status=cancelled when they
  // show the "N cancelled in the last 24h" line.
  it('maps the cancelled deep link onto the new bucket', () => {
    expect(bucketFromLegacyStatus('cancelled')).toEqual({ bucket: 'unfinished', sub: 'cancelled' });
  });

  // Operator push notifications (BOOKING_NEW_REQUEST_OPERATOR,
  // BOOKING_PENDING_NUDGE_OPERATOR) deep-link here with ?status=pending so the
  // tap lands on the request the notification announced.
  it('maps the pending deep link onto the pending bucket with no sub', () => {
    expect(bucketFromLegacyStatus('pending')).toEqual({ bucket: 'pending' });
  });

  // BOOKING_AUTO_REJECTED_OPERATOR deep-links here with ?status=rejected.
  it('maps the rejected deep link onto Nefinalizate/rejected', () => {
    expect(bucketFromLegacyStatus('rejected')).toEqual({ bucket: 'unfinished', sub: 'rejected' });
  });

  // The home card's "N evaluări de dat" line links here with ?status=toreview.
  it('maps the review-queue deep link onto Confirmate/De evaluat', () => {
    expect(bucketFromLegacyStatus('toreview')).toEqual({ bucket: 'confirmed', sub: 'toreview' });
  });

  it('falls back to Confirmate for anything else', () => {
    expect(bucketFromLegacyStatus(undefined)).toEqual({ bucket: 'confirmed', sub: 'today' });
    expect(bucketFromLegacyStatus('nonsense')).toEqual({ bucket: 'confirmed', sub: 'today' });
  });
});

describe('BUCKETS', () => {
  it('agrees with BUCKET_LABELS so the tab order cannot drift from the model', () => {
    expect(BUCKETS).toEqual(Object.keys(BUCKET_LABELS));
  });
});

describe('emptyCopy', () => {
  it('says what is missing, not that something is wrong', () => {
    expect(emptyCopy('pending')).toBe('Nimic de aprobat.');
    expect(emptyCopy('confirmed', 'today')).toBe('Nicio rezervare azi.');
    expect(emptyCopy('confirmed', 'upcoming')).toBe('Nicio rezervare viitoare.');
    expect(emptyCopy('confirmed', 'past')).toBe('Nicio rezervare încheiată.');
    expect(emptyCopy('unfinished')).toBe('Nimic nefinalizat.');
    expect(emptyCopy('unfinished', 'rejected')).toBe('Nicio cerere neacceptată.');
    expect(emptyCopy('unfinished', 'cancelled')).toBe('Nicio anulare.');
    expect(emptyCopy('unfinished', 'noshow')).toBe('Nicio neprezentare.');
    expect(emptyCopy('all')).toBe('Nicio rezervare.');
  });

  it('labels and empties the review queue', () => {
    expect(SUB_LABELS.toreview).toBe('De evaluat');
    expect(emptyCopy('confirmed', 'toreview')).toBe('Nimic de evaluat.');
  });
});

describe('SUB_LABELS', () => {
  it('labels every sub in Romanian', () => {
    expect(SUB_LABELS.today).toBe('Azi');
    expect(SUB_LABELS.upcoming).toBe('Viitoare');
    expect(SUB_LABELS.past).toBe('Trecute');
    expect(SUB_LABELS.rejected).toBe('Cereri neacceptate');
    expect(SUB_LABELS.cancelled).toBe('Anulate');
    expect(SUB_LABELS.noshow).toBe('Neprezentări');
  });
});
