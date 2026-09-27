import { describe, it, expect } from 'vitest';
import { gridSource, thumbSource, fullSource } from '../photoSources';

const modern = {
  photoUrl: 'https://cdn/xl.jpg',
  photoGridUrl: 'https://cdn/md.jpg',
  photoThumbUrl: 'https://cdn/th.jpg',
};

// What a 30-day-old edge-cached response looks like: pre-variant shape.
const cached = { photoUrl: 'https://cdn/orig.jpg' };

describe('community photo sources', () => {
  it('uses the sized variant when the CMS sent one', () => {
    expect(gridSource(modern)).toBe('https://cdn/md.jpg');
    expect(thumbSource(modern)).toBe('https://cdn/th.jpg');
    expect(fullSource(modern)).toBe('https://cdn/xl.jpg');
  });

  it('falls back to photoUrl for a stale cached response', () => {
    expect(gridSource(cached)).toBe('https://cdn/orig.jpg');
    expect(thumbSource(cached)).toBe('https://cdn/orig.jpg');
    expect(fullSource(cached)).toBe('https://cdn/orig.jpg');
  });

  it('returns null when there is no photo at all', () => {
    expect(gridSource({ photoUrl: null })).toBeNull();
  });
});

describe('rail and records rows resolve to the grid variant', () => {
  it('prefers photoGridUrl for a rail catch', () => {
    expect(gridSource({ photoUrl: 'https://cdn/xl.jpg', photoGridUrl: 'https://cdn/md.jpg' }))
      .toBe('https://cdn/md.jpg');
  });

  it('falls back to photoUrl for a record from a stale cached response', () => {
    expect(gridSource({ photoUrl: 'https://cdn/orig.jpg' })).toBe('https://cdn/orig.jpg');
  });
});
