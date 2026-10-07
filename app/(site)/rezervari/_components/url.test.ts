import { describe, expect, it } from 'vitest';
import { myBookingsQuery, parseSub, parseTab, urlValues } from './url';

describe('rezervari url', () => {
  it('parses tabs, falling back to «Toate»', () => {
    expect(parseTab(undefined)).toBe('all');
    expect(parseTab('in-asteptare')).toBe('pending');
    expect(parseTab('confirmate')).toBe('confirmed');
    expect(parseTab('nefinalizate')).toBe('unfinished');
    expect(parseTab('bogus')).toBe('all');
  });

  it('parses a sub only when the bucket offers it', () => {
    expect(parseSub('confirmed', 'azi')).toBe('today');
    expect(parseSub('unfinished', 'neprezentari')).toBe('noshow');
    expect(parseSub('unfinished', 'azi')).toBeNull();
    expect(parseSub('all', 'azi')).toBeNull();
    expect(parseSub('confirmed', undefined)).toBeNull();
  });

  it('leaves defaults out of the URL', () => {
    expect(urlValues('all', undefined)).toEqual({ tab: null, filtru: null });
    expect(urlValues('confirmed', 'upcoming')).toEqual({ tab: 'confirmate', filtru: null });
    expect(urlValues('confirmed', 'past')).toEqual({ tab: 'confirmate', filtru: 'trecute' });
    expect(urlValues('unfinished', undefined)).toEqual({ tab: 'nefinalizate', filtru: null });
    expect(urlValues('unfinished', 'cancelled')).toEqual({ tab: 'nefinalizate', filtru: 'anulate' });
  });

  it('normalises a query for the return path', () => {
    expect(myBookingsQuery()).toBe('');
    expect(myBookingsQuery('confirmate', 'azi')).toBe('?tab=confirmate&filtru=azi');
    expect(myBookingsQuery('confirmate', 'viitoare')).toBe('?tab=confirmate');
    expect(myBookingsQuery('x', 'y')).toBe('');
  });
});
