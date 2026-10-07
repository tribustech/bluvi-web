import { describe, expect, it } from 'vitest';
import { computeBaitHistory } from '../baitHistory';
import { composeBait } from '../baitTaxonomy';

describe('composeBait', () => {
  it('joins type · size mm · flavour labels, skipping the missing ones', () => {
    expect(composeBait('boilies', 20, 'scopex')).toBe('Boilies 20mm Scopex');
    expect(composeBait(null, 16, null)).toBe('16mm');
    expect(composeBait(null, null, null)).toBe('');
  });
});

describe('computeBaitHistory', () => {
  const rod = (bait: string) => ({ index: 1, label: 'L1', color: '', bait, baitType: null, baitSize: null, baitFlavor: null, lane: 'center' as const, distance: 0, castLat: null, castLng: null, durationMs: null, alarmSound: null });
  it('dedupes by trimmed lowercase name, newest first, capped', () => {
    const sessions = [{ startedAt: 100, rods: [rod('Boilies'), rod(' ')] }];
    const events = [
      { outcome: 'capture' as const, occurredAt: 300, bait: 'boilies ', baitType: 'boilies', baitSize: 20, baitFlavor: null },
      { outcome: 'lost' as const, occurredAt: 400, bait: 'Porumb', baitType: null, baitSize: null, baitFlavor: null },
      { outcome: 'capture' as const, occurredAt: 200, bait: 'Viermi', baitType: null, baitSize: null, baitFlavor: null },
    ];
    expect(computeBaitHistory(sessions, events)).toEqual([
      { bait: 'boilies', baitType: 'boilies', baitSize: 20, baitFlavor: null },
      { bait: 'Viermi', baitType: null, baitSize: null, baitFlavor: null },
    ]);
    expect(computeBaitHistory(sessions, events, 1)).toHaveLength(1);
  });
});
