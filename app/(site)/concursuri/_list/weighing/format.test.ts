import { describe, expect, it } from 'vitest';
import { catchesBySpecies, fishCount, weigherName, weighingSummary, weighingThumb } from './format';

const competition = { documentId: 'c', name: 'Cupa', posterUrl: 'https://cdn/p.jpg' };

describe('recent weighing copy', () => {
  it('counts fish the Romanian way', () => {
    expect(fishCount(1)).toBe('1 pește');
    expect(fishCount(3)).toBe('3 pești');
    expect(fishCount(20)).toBe('20 de pești');
  });

  it('summarises a weighing, «Fără capturi» when empty', () => {
    expect(weighingSummary({ catchCount: 3, totalKg: 12.45 })).toBe('3 pești · 12,45 kg');
    expect(weighingSummary({ catchCount: 0, totalKg: 0 })).toBe('Fără capturi');
  });

  it('names the weigher and picks the thumbnail (photo, then poster)', () => {
    expect(weigherName({ angler: null, standLabel: 'Stand A1' })).toBe('Stand A1');
    expect(weighingThumb({ angler: { displayName: 'x', avatarUrl: 'https://a', isTeam: false }, competition })).toBe('https://a');
    expect(weighingThumb({ angler: null, competition })).toBe('https://cdn/p.jpg');
    expect(weighingThumb({ angler: null, competition: { ...competition, posterUrl: null } })).toBeNull();
  });

  it('groups catches by species, heaviest first', () => {
    const groups = catchesBySpecies([
      { weight: 2, fishType: { Name: 'Crap' } },
      { weight: 5, fishType: { Name: 'Amur' } },
      { weight: 1.5, fishType: { Name: 'Crap' } },
      { weight: 0.4, fishType: null },
    ]);
    expect(groups).toEqual([
      { species: 'Amur', count: 1, kg: 5 },
      { species: 'Crap', count: 2, kg: 3.5 },
      { species: 'Specie necunoscută', count: 1, kg: 0.4 },
    ]);
  });
});
