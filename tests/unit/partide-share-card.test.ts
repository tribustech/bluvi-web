import { describe, expect, it } from 'vitest';
import { ALL_FIELDS, shareCardLines, shareFieldKeys } from '@/components/partide/share/shareCard';
import { anglerCatchShareTarget, catchDay } from '@/components/partide/CatchLightbox';

/* The shared Bluvi share card (fish ShareCatchSheet): the «Competiție» field of a competition catch. */
const c = { weightKg: 12.5, species: 'Crap', occurredAt: '2026-09-20T08:30:00.000Z' };

describe('shareFieldKeys / shareCardLines with a competition', () => {
  it('offers «Competiție» last, only for a competition catch', () => {
    expect(shareFieldKeys(c, 'Snagov', 'Cupa Bluvi')).toEqual(['kg', 'balta', 'specie', 'date', 'competition']);
    expect(shareFieldKeys(c, 'Snagov')).toEqual(['kg', 'balta', 'specie', 'date']);
  });
  it('draws the competition under the venue, following its switch', () => {
    expect(shareCardLines(c, 'Snagov', ALL_FIELDS, 'Cupa Bluvi')).toEqual(['Snagov', 'Cupa Bluvi', '12,5 kg', 'Crap', '20 sep 2026']);
    expect(shareCardLines(c, 'Snagov', { ...ALL_FIELDS, competition: false }, 'Cupa Bluvi')).toEqual(['Snagov', '12,5 kg', 'Crap', '20 sep 2026']);
  });
});

describe('anglerCatchShareTarget (fish anglerCatchToShareEvent)', () => {
  it('reads the full photo and the catch date', () => {
    expect(
      anglerCatchShareTarget({
        key: 'k',
        source: 'partida',
        photoUrl: 'https://x/full.jpg',
        photoGridUrl: 'https://x/grid.jpg',
        weightKg: 3,
        species: null,
        venueName: 'Snagov',
        date: '2026-09-20T08:30:00.000Z',
        competitionName: null,
        competitionDocumentId: null,
      }),
    ).toEqual({ key: 'k', photoUrl: 'https://x/full.jpg', weightKg: 3, species: null, occurredAt: '2026-09-20T08:30:00.000Z' });
    expect(catchDay('2026-12-31T22:30:00.000Z')).toBe('1 ian 2027');
  });
});
