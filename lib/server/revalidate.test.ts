import { describe, expect, it } from 'vitest';
import { parseRevalidateBody, secretMatches } from './revalidate';

describe('revalidate webhook', () => {
  it('checks the shared secret', () => {
    expect(secretMatches('abc', 'abc')).toBe(true);
    expect(secretMatches('abd', 'abc')).toBe(false);
    expect(secretMatches('ab', 'abc')).toBe(false);
    expect(secretMatches(null, 'abc')).toBe(false);
    expect(secretMatches('abc', undefined)).toBe(false);
  });

  it('accepts the tag batch the CMS purges', () => {
    expect(parseRevalidateBody({ tags: ['lake-abc', 'lakes-list', 'lake-abc'] })).toEqual({ tags: ['lake-abc', 'lakes-list'] });
  });

  it('rejects malformed bodies', () => {
    expect(parseRevalidateBody(null)).toHaveProperty('error');
    expect(parseRevalidateBody({ tags: [] })).toHaveProperty('error');
    expect(parseRevalidateBody({ tags: [1] })).toHaveProperty('error');
    expect(parseRevalidateBody({ tags: ['x'.repeat(257)] })).toHaveProperty('error');
    expect(parseRevalidateBody({ tags: Array.from({ length: 101 }, (_, i) => `t${i}`) })).toHaveProperty('error');
  });
});
