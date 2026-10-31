import { describe, expect, it } from 'vitest';
import {
  SectorWithStandHandicaps,
  clearStandHandicaps,
  handicappedStandCount,
  pruneStandHandicaps,
  setStandHandicap,
  standHandicap,
  standHandicapGroups,
  supportsStandHandicap,
} from './standHandicaps';

const sector: SectorWithStandHandicaps = { name: 'A' };

describe('standHandicaps', () => {
  it('standHandicap is 100 unless the stand has a valid percent', () => {
    expect(standHandicap({ ...sector, standHandicaps: { s1: 30 } }, 's1')).toBe(30);
    expect(standHandicap({ ...sector, standHandicaps: { s1: 30 } }, 's2')).toBe(100);
    expect(standHandicap({ ...sector, standHandicaps: { s1: 0, s2: 150 } }, 's1')).toBe(100);
    expect(standHandicap(sector, 's1')).toBe(100);
  });

  it('setStandHandicap stores below 100, removes at 100', () => {
    const a = setStandHandicap(sector, 's1', 30);
    expect(a.standHandicaps).toEqual({ s1: 30 });
    const b = setStandHandicap(a, 's1', 100);
    expect('standHandicaps' in b).toBe(false);
    expect(setStandHandicap(a, 's2', 0).standHandicaps).toEqual({ s1: 30, s2: 1 });
  });

  it('clear, prune, count, groups', () => {
    const s = { ...sector, standHandicaps: { s1: 30, s2: 50, s3: 30 } };
    expect(clearStandHandicaps(s)).toEqual(sector);
    expect(pruneStandHandicaps([s], { A: ['s1', 's2'] })[0].standHandicaps).toEqual({ s1: 30, s2: 50 });
    expect('standHandicaps' in pruneStandHandicaps([s], { A: [] })[0]).toBe(false);
    expect(handicappedStandCount(s)).toBe(3);
    const stands = [
      { documentId: 's3', name: '10' },
      { documentId: 's1', name: '2' },
      { documentId: 's2', name: '5' },
      { documentId: 's4', name: '7' },
    ];
    expect(standHandicapGroups({ ...s, stands })).toEqual([
      { percent: 30, standNames: ['2', '10'] },
      { percent: 50, standNames: ['5'] },
    ]);
    expect(standHandicapGroups({ ...sector, stands })).toEqual([]);
  });

  it('supports only the kg-based ranking types', () => {
    for (const t of ['quantity', 'quantityQuality', 'qualityQuantity', 'calitateCantitateCMMC']) {
      expect(supportsStandHandicap(t)).toBe(true);
    }
    for (const t of ['quality', 'calitateCalitate', 'bestOf', 'bestOfTiers', 'nationalChampionship', 'fipsed', 'feederRounds', null]) {
      expect(supportsStandHandicap(t)).toBe(false);
    }
  });
});
