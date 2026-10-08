import { describe, expect, it } from 'vitest';
import { shouldLeave, winnerGroups, winnerName } from './model';

const types = [
  { key: 'crap', label: 'Crap', description: null, badgeColor: 'blue' },
  { key: 'feeder', label: 'Feeder', description: null, badgeColor: '  ' },
];

describe('participant.raffle-winners model', () => {
  it('c1: stays only for an ended session with winners', () => {
    expect(shouldLeave({ isEnded: true, hasWinners: true })).toBe(false);
    expect(shouldLeave({ isEnded: true, hasWinners: false })).toBe(true);
    expect(shouldLeave({ isEnded: false, hasWinners: true })).toBe(true);
    expect(shouldLeave({ isEnded: false, hasWinners: false })).toBe(true);
  });

  it('c4: one group per key in CMS order; label, colour (blank → null), session prize else none', () => {
    const groups = winnerGroups({
      types,
      sessionPrizes: [{ title: 'Kit', count: 1, typeKey: 'crap', description: null, image: null }],
      winnersByTypeKey: { feeder: [], crap: [{ documentId: 'a', username: 'A' }], rapitor: [] },
    });
    expect(groups.map((g) => g.typeKey)).toEqual(['feeder', 'crap', 'rapitor']);
    expect(groups.map((g) => g.label)).toEqual(['Feeder', 'Crap', 'Răpitor']);
    expect(groups.map((g) => g.badgeColor)).toEqual([null, 'blue', null]);
    expect(groups.map((g) => g.prize?.title ?? null)).toEqual([null, 'Kit', null]);
  });

  it('c4: no prize (never the static intro prizes) when the session has none — rule 4', () => {
    const groups = winnerGroups({ types, sessionPrizes: [], winnersByTypeKey: { feeder: [], crap: [] } });
    expect(groups.map((g) => g.prize)).toEqual([null, null]);
  });

  it('c5: the username, else «Câștigător #{i}»', () => {
    expect(winnerName({ username: ' Ion ' }, 0)).toBe('Ion');
    expect(winnerName({ username: null }, 1)).toBe('Câștigător #2');
    expect(winnerName({ username: '  ' }, 0)).toBe('Câștigător #1');
  });
});
