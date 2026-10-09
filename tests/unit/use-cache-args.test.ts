import { describe, expect, it } from 'vitest';
import { publicGetArgs } from '@/lib/server/public-get';
import { ogModelArgs } from '@/lib/server/og/images';

/*
 * m8.cache-warming — the arguments of the 'use cache' functions behind the public pages are their
 * cache keys: the prerender's warming pass and its final pass must build the same key, or the final
 * pass misses («Unexpected cache miss after cache warming phase»). Same input → identical JSON.
 */

describe('publicGetArgs (cachedPublicGet key)', () => {
  it('is identical across calls and across header key order', () => {
    const a = publicGetArgs('http://cms/api/feed/lakes/index', { 'x-app-version': '2.0.0', 'x-app-platform': 'web' });
    const b = publicGetArgs('http://cms/api/feed/lakes/index', { 'x-app-platform': 'web', 'x-app-version': '2.0.0' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(publicGetArgs('http://cms/api/feed/lakes/index', { 'x-app-version': '2.0.0', 'x-app-platform': 'web' })));
  });

  it('never reorders the URL (the query order is the request the CMS and Cloudflare see)', () => {
    const url = 'http://cms/api/feed/community/history?page=1&pageSize=10&venue=lake%3Aabc';
    expect(publicGetArgs(url, {})[0]).toBe(url);
  });

  it('carries only plain strings (serialisable, no transport objects)', () => {
    const [url, headers] = publicGetArgs('http://cms/x', { b: '2', a: '1' });
    expect(typeof url).toBe('string');
    expect(Object.getPrototypeOf(headers)).toBe(Object.prototype);
    expect(Object.keys(headers)).toEqual(['a', 'b']);
  });
});

describe('ogModelArgs (OG model / image key)', () => {
  it('is identical across calls', () => {
    expect(JSON.stringify(ogModelArgs('3506', 'Capturi'))).toBe(JSON.stringify(ogModelArgs('3506', 'Capturi')));
  });

  it('an absent label is an explicit null, never undefined', () => {
    expect(ogModelArgs('3506', undefined)).toEqual(['3506', null]);
    expect(JSON.stringify(ogModelArgs('3506', undefined))).toBe(JSON.stringify(ogModelArgs('3506', null)));
  });

  it('an absent id (an image route without params) is the empty string', () => {
    expect(ogModelArgs(undefined, 'Hartă')).toEqual(['', 'Hartă']);
  });
});
