import { describe, expect, it } from 'vitest';
import { compareNames, sortedSectors } from './standOrder';

describe('standOrder', () => {
  it('compares stand names naturally', () => {
    expect(['10', '9', 'A10', 'A2', '1'].sort(compareNames)).toEqual(['1', '9', '10', 'A2', 'A10']);
  });

  it('sorts the sectors by name and each one’s stands naturally (SIM3 feeder: A, D, C, B in the CMS)', () => {
    const cms = [
      { name: 'A', stands: [{ name: '1' }, { name: '2' }] },
      { name: 'D', stands: [{ name: '18' }, { name: '19' }, { name: '20' }, { name: '17' }] },
      { name: 'C', stands: [{ name: '14' }, { name: '15' }, { name: '11' }, { name: '12' }] },
      { name: 'B', stands: [{ name: '7' }, { name: '9' }, { name: '6' }] },
    ];
    const sorted = sortedSectors(cms);
    expect(sorted.map(s => s.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(sorted.map(s => s.stands.map(st => st.name))).toEqual([['1', '2'], ['6', '7', '9'], ['11', '12', '14', '15'], ['17', '18', '19', '20']]);
    // The input is left as it is (the phone keeps fish's order).
    expect(cms[1].stands[0].name).toBe('18');
  });
});
