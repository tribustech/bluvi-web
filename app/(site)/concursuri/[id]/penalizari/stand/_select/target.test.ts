import { describe, expect, it } from 'vitest';
import { canPickPenaltyStand, penaltyTarget } from './target';

describe('canPickPenaltyStand', () => {
  it('needs a ranking type with penalties on a started competition', () => {
    expect(canPickPenaltyStand({ rankingType: 'quantity', competitionStatus: 'started' })).toBe(true);
    expect(canPickPenaltyStand({ rankingType: 'quantityQuality', competitionStatus: 'started' })).toBe(true);
  });
  it('a ranking type without penalties → no', () => {
    for (const rankingType of ['quality', 'nationalChampionship', 'feederRounds', null, undefined]) {
      expect(canPickPenaltyStand({ rankingType, competitionStatus: 'started' })).toBe(false);
    }
  });
  it('a competition that is not started → no', () => {
    for (const competitionStatus of ['draft', 'notStarted', 'completed', 'cancelled', null]) {
      expect(canPickPenaltyStand({ rankingType: 'quantity', competitionStatus })).toBe(false);
    }
  });
});

describe('penaltyTarget', () => {
  it('an allocated stand targets its registration', () => {
    expect(penaltyTarget({ allocated: true, registrationId: 'reg1' })).toBe('reg1');
  });
  it('no registration id, or unallocated → nothing', () => {
    expect(penaltyTarget({ allocated: true, registrationId: null })).toBeNull();
    expect(penaltyTarget({ allocated: true, registrationId: '' })).toBeNull();
    expect(penaltyTarget({ allocated: false, registrationId: 'reg1' })).toBeNull();
  });
});
