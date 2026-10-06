import { describe, expect, it } from 'vitest';
import { getCompetitionDuration, getParticipationType, getRankingTypeLabel } from './competitionLabels';

describe('getRankingTypeLabel', () => {
  it('every known type', () => {
    expect(getRankingTypeLabel({ rankingType: 'quantity' })).toBe('Cantitate');
    expect(getRankingTypeLabel({ rankingType: 'qualityQuantity' })).toBe('Calitate/Cantitate');
    expect(getRankingTypeLabel({ rankingType: 'bestOf', bestOfFishCount: 5 })).toBe('Best of 5');
    expect(getRankingTypeLabel({ rankingType: 'fipsed' })).toBe('Campionat Mondial FIPSed');
    expect(getRankingTypeLabel({ rankingType: 'feederRounds' })).toBe('Feeder');
    expect(getRankingTypeLabel({ rankingType: 'bestOfTiers', bestOfTierSizes: [3, 5, 7] })).toBe('Best of 3, 5, 7');
    expect(getRankingTypeLabel({ rankingType: 'bestOfTiers', bestOfTierSizes: [] })).toBe('Best of x, y, z...');
    expect(getRankingTypeLabel({ rankingType: 'unknown' })).toBe('');
  });
});

describe('getParticipationType', () => {
  it('individual, team size before the start only', () => {
    expect(getParticipationType({ competitionType: 'single', competitionStatus: 'notStarted' })).toBe('Individual');
    expect(getParticipationType({ competitionType: 'team', competitionStatus: 'notStarted', teamParticipants: 3 })).toBe('Echipe de 3');
    expect(getParticipationType({ competitionType: 'team', competitionStatus: 'notStarted', teamParticipants: null })).toBe('Echipe');
    expect(getParticipationType({ competitionType: 'team', competitionStatus: 'started', teamParticipants: 3 })).toBe('Echipe');
  });
});

describe('getCompetitionDuration', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 1) + h * 3_600_000).toISOString();
  it('hours up to 72', () => {
    expect(getCompetitionDuration(at(0), at(1))).toBe('1 oră');
    expect(getCompetitionDuration(at(0), at(72))).toBe('72 ore');
  });
  it('days, with the remaining hours', () => {
    expect(getCompetitionDuration(at(0), at(96))).toBe('4 zile');
    expect(getCompetitionDuration(at(0), at(97))).toBe('4 zile și 1 oră');
    expect(getCompetitionDuration(at(0), at(75))).toBe('3 zile și 3 ore');
  });
});
