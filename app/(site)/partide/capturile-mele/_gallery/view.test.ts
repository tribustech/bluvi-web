import { describe, expect, it } from 'vitest';
import type { AnglerCatch } from '@/core/social';
import { catchesSubtitle, catchRatio, catchTileLabel, dedupeCatches } from './view';

const c = (key: string, over: Partial<AnglerCatch> = {}): AnglerCatch => ({
  key,
  source: 'partida',
  photoUrl: `https://x/${key}.jpg`,
  weightKg: 4.5,
  species: 'Crap',
  venueName: 'Balta Chita',
  date: '2026-09-20T08:30:00Z',
  competitionName: null,
  competitionDocumentId: null,
  ...over,
});

describe('dedupeCatches', () => {
  it('keeps the first occurrence of a key across pages, in order', () => {
    expect(dedupeCatches([{ data: [c('a'), c('b')] }, { data: [c('b'), c('c')] }]).map(x => x.key)).toEqual(['a', 'b', 'c']);
  });
  it('no pages → none', () => {
    expect(dedupeCatches(undefined)).toEqual([]);
  });
});

describe('catchesSubtitle', () => {
  it('hidden with nothing loaded', () => expect(catchesSubtitle(0, 0)).toBeNull());
  it('singular', () => expect(catchesSubtitle(1, 1)).toBe('1 captură'));
  it('plural', () => expect(catchesSubtitle(7, 7)).toBe('7 capturi'));
  it('«de» from 20', () => expect(catchesSubtitle(25, 20)).toBe('25 de capturi'));
  it('never below what is on screen', () => expect(catchesSubtitle(0, 3)).toBe('3 capturi'));
});

describe('catchRatio', () => {
  it('from the pixels', () => expect(catchRatio({ photoWidth: 1600, photoHeight: 1200 })).toBeCloseTo(4 / 3));
  it('unknown → null', () => expect(catchRatio({ photoWidth: null, photoHeight: 1200 })).toBeNull());
});

describe('catchTileLabel', () => {
  it('kg, species, venue', () => expect(catchTileLabel(c('a'))).toBe('Deschide captura: 4,5 kg, Crap, Balta Chita'));
  it('a competition catch names the competition', () =>
    expect(catchTileLabel(c('a', { source: 'competition', competitionName: 'Cupa Toamnei' }))).toBe('Deschide captura: 4,5 kg, Crap, Balta Chita, Cupa Toamnei'));
  it('nothing known', () => expect(catchTileLabel(c('a', { weightKg: null, species: null, venueName: null }))).toBe('Deschide captura'));
});
