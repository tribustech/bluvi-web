import { describe, expect, it } from 'vitest';
import { createCompetitionDefaultValues, parseTierSizesInput, RANKING_TYPES, type CreateCompetitionFormData } from '@/core/organizer';
import { digitsOnly, legLabel, rankingNormalization, rankingTypePatch, rankingTypePatchRestoring, sectorModeIcon, splitRankingLabel, tiersOnly, typeOwnValues } from './model';

const v = (over: Partial<CreateCompetitionFormData> = {}): CreateCompetitionFormData => ({ ...createCompetitionDefaultValues, name: 'Cupa', ...over });

describe('organizer.step-ranking model', () => {
  it('c2: a disabled type writes nothing; a hydrated one is cleared', () => {
    expect(rankingTypePatch(v(), 'nationalChampionship')).toBeNull();
    expect(rankingTypePatch(v(), 'fipsed')).toBeNull();
    expect(rankingNormalization(v({ rankingType: 'fipsed' }))).toEqual({ rankingType: undefined });
  });

  it('c4: quantity → default general mode, no grid rule, best-of / tiers / legs cleared', () => {
    const p = rankingTypePatch(v({ gridRule: 'average', bestOfFishCount: '5', numberOfWinners: '3', bestOfTierSizes: [9, 7], roundsCount: '3' }), 'quantity');
    expect(p).toEqual({
      rankingType: 'quantity',
      generalRankingWinnerMode: 'bySectorPosition',
      gridRule: undefined,
      bestOfFishCount: '',
      numberOfWinners: '',
      bestOfTierSizes: undefined,
      roundsCount: undefined,
    });
  });

  it('c4: quality keeps a known grid rule and a supported mode; a reversed mode not supported falls back', () => {
    expect(rankingTypePatch(v({ gridRule: 'average', generalRankingWinnerMode: 'byPoints' }), 'quality')).toMatchObject({ gridRule: 'average', generalRankingWinnerMode: 'byPoints' });
    expect(rankingTypePatch(v({ generalRankingWinnerMode: 'bySectorPositionPerisReversed' }), 'quality')).toMatchObject({ generalRankingWinnerMode: 'bySectorPosition', gridRule: 'catchCount' });
    expect(rankingTypePatch(v({ generalRankingWinnerMode: 'bySectorPositionPerisReversed' }), 'quantityQuality')).toMatchObject({ generalRankingWinnerMode: 'bySectorPositionPerisReversed' });
  });

  it('c4: bestOf keeps its fields; bestOfTiers keeps the tiers; types without a mode drop it', () => {
    const b = rankingTypePatch(v({ bestOfFishCount: '5', generalRankingWinnerMode: 'byPoints' }), 'bestOf')!;
    expect('bestOfFishCount' in b).toBe(false);
    expect(b.generalRankingWinnerMode).toBeUndefined();
    const t = rankingTypePatch(v({ bestOfTierSizes: [9, 7] }), 'bestOfTiers')!;
    expect('bestOfTierSizes' in t).toBe(false);
    expect(t.bestOfFishCount).toBe('');
  });

  it('c4 c9: feeder sets 2 legs unless it already has some', () => {
    expect(rankingTypePatch(v(), 'feederRounds')!.roundsCount).toBe('2');
    expect('roundsCount' in rankingTypePatch(v({ roundsCount: '3' }), 'feederRounds')!).toBe(false);
  });

  it('normalization: nothing to do for a coherent value', () => {
    expect(rankingNormalization(v({ rankingType: 'quality', generalRankingWinnerMode: 'bySectorPosition', gridRule: 'catchCount' }))).toEqual({});
    expect(rankingNormalization(v({ rankingType: 'quality' }))).toEqual({ generalRankingWinnerMode: 'bySectorPosition', gridRule: 'catchCount' });
    expect(rankingNormalization(v({ rankingType: 'bestOf', gridRule: 'average' }))).toEqual({ gridRule: undefined });
    expect(rankingNormalization(v())).toEqual({});
  });

  it('c1: labels split into emoji + plain name, for every type', () => {
    expect(RANKING_TYPES.map(t => splitRankingLabel(t.value, t.label).name)).toEqual([
      'Cantitate',
      'Calitate',
      'Cantitate/Calitate',
      'Calitate/Cantitate',
      'Calitate/Calitate',
      'Calitate/Cantitate/CMMC',
      'Best of',
      'Best of x, y, z...',
      'Feeder (FIPS)',
      'Campionat Național',
      'Campionat Mondial FIPSed',
    ]);
    expect(splitRankingLabel('quantityQuality', '⚖️🏆 Cantitate/Calitate').emoji).toBe('⚖️🏆');
  });

  it('c6: the sector-mode icon follows the metric that decides the general ranking', () => {
    expect(sectorModeIcon('quantityQuality', 'bySectorPosition')).toBe('⚖️');
    expect(sectorModeIcon('quantityQuality', 'bySectorPositionPerisReversed')).toBe('🐟');
    expect(sectorModeIcon('qualityQuantity', 'bySectorPosition')).toBe('🐟');
    expect(sectorModeIcon('quality', 'bySectorPosition')).toBe('🐟');
    expect(sectorModeIcon('quantity', 'bySectorPosition')).toBe('⚖️');
  });

  it('c8 c10: input filters; tier messages (core parseTierSizesInput)', () => {
    expect(tiersOnly('9, 7;5a,3')).toBe('9,75,3');
    expect(digitsOnly('1a2 ')).toBe('12');
    expect(parseTierSizesInput('9,7,5,3')).toEqual({ tiers: [9, 7, 5, 3], error: null });
    expect(parseTierSizesInput('')).toEqual({ tiers: null, error: null });
    expect(parseTierSizesInput(',,').error).toBe('Adaugă cel puțin un prag.');
    expect(parseTierSizesInput('0,1').error).toBe('Pragurile trebuie să fie numere întregi pozitive (ex: 9,7,5,3).');
    expect(parseTierSizesInput('5,7').error).toBe('Pragurile trebuie să fie ordonate descrescător și distincte.');
    expect(parseTierSizesInput(Array.from({ length: 21 }, (_, i) => 21 - i).join(',')).error).toBe('Sunt permise cel mult 20 de praguri.');
  });

  it('c9: leg labels', () => {
    expect(['1', '2', '3'].map(legLabel)).toEqual(['1 manșă', '2 manșe', '3 manșe']);
  });

  it('a type\'s own values are kept and come back with the type (arrow keys)', () => {
    expect(typeOwnValues(v({ bestOfTierSizes: [9, 7, 5, 3] }), 'bestOfTiers')).toEqual({ bestOfTierSizes: [9, 7, 5, 3] });
    expect(typeOwnValues(v({ bestOfFishCount: '10', numberOfWinners: '3' }), 'bestOf')).toEqual({ bestOfFishCount: '10', numberOfWinners: '3' });
    expect(typeOwnValues(v({ roundsCount: '3' }), 'feederRounds')).toEqual({ roundsCount: '3' });
    expect(typeOwnValues(v({ bestOfTierSizes: [] }), 'bestOfTiers')).toEqual({});
    expect(typeOwnValues(v({ bestOfTierSizes: [9] }), 'quantity')).toEqual({});
    expect(rankingTypePatchRestoring(v({ rankingType: 'feederRounds' }), 'bestOfTiers', { bestOfTierSizes: [9, 7] })).toMatchObject({ rankingType: 'bestOfTiers', bestOfTierSizes: [9, 7], roundsCount: undefined });
    expect(rankingTypePatchRestoring(v(), 'feederRounds', { roundsCount: '3' })).toMatchObject({ roundsCount: '3' });
    expect(rankingTypePatchRestoring(v(), 'feederRounds', undefined)).toMatchObject({ roundsCount: '2' });
    expect(rankingTypePatchRestoring(v(), 'fipsed', { roundsCount: '3' })).toBeNull();
  });
});
