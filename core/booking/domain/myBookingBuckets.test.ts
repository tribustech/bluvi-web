import { describe, expect, it } from 'vitest';
import {
  MY_BUCKETS,
  MY_BUCKET_LABELS,
  MY_SUB_LABELS,
  allowsUnfilteredView,
  myDefaultSub,
  myEmptyCopy,
  mySubsFor,
  type MySub,
} from './myBookingBuckets';

describe('my booking buckets', () => {
  it('labels every tab', () => {
    for (const bucket of MY_BUCKETS) {
      expect(MY_BUCKET_LABELS[bucket]).toBeTruthy();
    }
  });

  it('labels every sub it offers', () => {
    for (const bucket of MY_BUCKETS) {
      for (const sub of mySubsFor(bucket)) {
        expect(MY_SUB_LABELS[sub]).toBeTruthy();
      }
    }
  });

  it('never offers the operator-only review queue', () => {
    const subs = MY_BUCKETS.flatMap(mySubsFor) as string[];
    expect(subs).not.toContain('toreview');
  });

  it('opens Confirmate on upcoming, since its unfiltered view is mis-sorted', () => {
    expect(myDefaultSub('confirmed')).toBe('upcoming');
    expect(allowsUnfilteredView('confirmed')).toBe(false);
  });

  it('lets the other buckets show their own unfiltered view', () => {
    expect(myDefaultSub('unfinished')).toBeUndefined();
    expect(allowsUnfilteredView('unfinished')).toBe(true);
    expect(allowsUnfilteredView('all')).toBe(true);
  });

  it('has empty copy for every (bucket, sub) it can render', () => {
    for (const bucket of MY_BUCKETS) {
      const subs: (MySub | undefined)[] = allowsUnfilteredView(bucket)
        ? [undefined, ...mySubsFor(bucket)]
        : mySubsFor(bucket);
      for (const sub of subs) {
        expect(myEmptyCopy(bucket, sub)).toBeTruthy();
      }
    }
  });
});
