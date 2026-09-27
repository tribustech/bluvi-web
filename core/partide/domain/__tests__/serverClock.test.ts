import { describe, expect, it } from 'vitest';
import { createServerClock, offsetFromHttpDate, offsetFromServerNow, readDateHeaders } from '../serverClock';

// Ported from fish `domain/__tests__/serverClock.test.ts` onto the instance clock.
const clockAt = (now = 1_000_000) => createServerClock(() => now);

describe('serverClock', () => {
  it('reports whether a live sample has been taken', () => {
    const c = clockAt();
    expect(c.hasSample()).toBe(false);
    c.noteServerNow('not-a-date');
    expect(c.hasSample()).toBe(false);
    c.noteHttpDate({ date: new Date(1_030_000).toUTCString() });
    expect(c.hasSample()).toBe(true);
    c.reset();
    expect(c.hasSample()).toBe(false);
    c.noteServerNow(new Date(1_030_000).toISOString());
    expect(c.hasSample()).toBe(true);
  });

  it('returns device time until a server sample arrives', () => {
    expect(clockAt().now()).toBe(1_000_000);
  });

  it('applies the offset from the latest server sample', () => {
    const c = clockAt();
    c.noteServerNow(new Date(1_030_000).toISOString()); // server is 30s ahead
    expect(c.now()).toBe(1_030_000);
  });

  it('ignores an unparseable sample rather than corrupting the clock', () => {
    const c = clockAt();
    c.noteServerNow('not-a-date');
    expect(c.now()).toBe(1_000_000);
  });

  describe('noteHttpDate', () => {
    it('samples the clock from a response Date header (plain record or fetch Headers)', () => {
      const c = clockAt();
      c.noteHttpDate({ date: new Date(1_030_000).toUTCString() });
      expect(c.now()).toBe(1_030_000);
      const d = clockAt();
      d.noteHttpDate(new Headers({ date: new Date(1_030_000).toUTCString() }));
      expect(d.now()).toBe(1_030_000);
    });

    it('adds Age so a cached response does not rewind the clock', () => {
      const c = clockAt();
      c.noteHttpDate({ date: new Date(400_000).toUTCString(), age: '600' });
      expect(c.now()).toBe(1_000_000);
    });

    it('ignores a response with no Date header', () => {
      const c = clockAt();
      c.noteHttpDate({});
      expect(c.now()).toBe(1_000_000);
      expect(c.hasSample()).toBe(false);
    });

    it('ignores an unparseable Age rather than trusting a bare cached Date', () => {
      const c = clockAt();
      c.noteHttpDate({ date: new Date(400_000).toUTCString(), age: 'soon' });
      expect(c.now()).toBe(1_000_000);
    });
  });

  it('exposes the pure offset functions', () => {
    expect(offsetFromServerNow(new Date(1_030_000).toISOString(), 1_000_000)).toBe(30_000);
    expect(offsetFromServerNow('x', 1)).toBeNull();
    expect(offsetFromHttpDate(new Date(400_000).toUTCString(), 600, 1_000_000)).toBe(0);
    expect(offsetFromHttpDate(new Date(400_000).toUTCString(), -1, 1_000_000)).toBeNull();
    expect(offsetFromHttpDate(null, null, 1)).toBeNull();
    expect(readDateHeaders({ Date: 'd', Age: 3 })).toEqual({ date: 'd', age: '3' });
    expect(readDateHeaders(null)).toEqual({ date: null, age: null });
  });
});
