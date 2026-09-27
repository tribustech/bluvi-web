import { describe, expect, it } from 'vitest';
import { parseCacheTags, parseCdnCacheControl } from './headers';

describe('parseCdnCacheControl', () => {
  it('reads the value the CMS stamps on public responses', () => {
    expect(parseCdnCacheControl('public, max-age=3600')).toEqual({ cacheable: true, maxAge: 3600 });
    expect(parseCdnCacheControl('Public, Max-Age=30')).toEqual({ cacheable: true, maxAge: 30 });
  });

  it('treats a missing, private or zero-age header as not cacheable', () => {
    expect(parseCdnCacheControl(null)).toEqual({ cacheable: false });
    expect(parseCdnCacheControl('')).toEqual({ cacheable: false });
    expect(parseCdnCacheControl('private, no-cache, no-store, max-age=0')).toEqual({ cacheable: false });
    expect(parseCdnCacheControl('public, max-age=0')).toEqual({ cacheable: false });
    expect(parseCdnCacheControl('public')).toEqual({ cacheable: false });
    expect(parseCdnCacheControl('max-age=60')).toEqual({ cacheable: false });
  });
});

describe('parseCacheTags', () => {
  it('splits, trims and dedupes', () => {
    expect(parseCacheTags('lake-abc, lakes-list,lake-abc')).toEqual(['lake-abc', 'lakes-list']);
  });

  it('drops empty and over-long tags', () => {
    expect(parseCacheTags(null)).toEqual([]);
    expect(parseCacheTags(' , ')).toEqual([]);
    expect(parseCacheTags(`ok,${'x'.repeat(257)}`)).toEqual(['ok']);
  });
});
