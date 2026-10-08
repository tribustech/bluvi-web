import { describe, expect, it } from 'vitest';
import type { LocalSession } from '@/core/partide';
import { detailRows, membersLabel, positionLabel, standAnchorPatch, standCoordinates } from './model';

const H = 3_600_000;
const start = new Date(2026, 9, 7, 9, 46).getTime(); // local 7 oct 09:46

const session = (patch: Partial<LocalSession> = {}): LocalSession =>
  ({
    clientId: 'c',
    startedAt: start,
    endedAt: null,
    plannedDurationMs: 8 * H,
    anchorLat: 44.4321,
    anchorLng: 26.1234,
    anchorName: null,
    targetSpecies: [],
    standName: null,
    standId: null,
    ...patch,
  }) as LocalSession;

describe('detailRows (fish InfoScene readRows, c4)', () => {
  it('live: Început, Sfârșit estimat, Durată estimată — no read-only extras', () => {
    expect(detailRows(session(), false)).toEqual([
      { label: 'Început', value: '7 oct. · 09:46' },
      { label: 'Sfârșit estimat', value: '7 oct. · 17:46' },
      { label: 'Durată estimată', value: '8h' },
    ]);
  });

  it('ended: Sfârșit + Durată (h:mm), Reper, then Poziție (5 decimals), Specii vizate, Stand', () => {
    const rows = detailRows(
      session({ endedAt: start + 6 * H + 12 * 60_000, anchorName: 'Lângă ponton', standName: '7', targetSpecies: [{ id: '1', name: 'Crap' }, { id: null, name: 'Somn' }] }),
      true,
    );
    expect(rows).toEqual([
      { label: 'Început', value: '7 oct. · 09:46' },
      { label: 'Sfârșit', value: '7 oct. · 15:58' },
      { label: 'Durată', value: '06:12' },
      { label: 'Reper', value: 'Lângă ponton' },
      { label: 'Poziție', value: '44.43210, 26.12340' },
      { label: 'Specii vizate', value: 'Crap, Somn' },
      { label: 'Stand', value: '7' },
    ]);
  });

  it('ended without species / stand leaves those rows out', () => {
    expect(detailRows(session({ endedAt: start + H }), true).map(r => r.label)).toEqual(['Început', 'Sfârșit', 'Durată', 'Poziție']);
  });

  it('open but read-only here: the live rows plus the settings as facts', () => {
    expect(detailRows(session({ standName: 'A9' }), false, true).map(r => r.label)).toEqual(['Început', 'Sfârșit estimat', 'Durată estimată', 'Poziție', 'Stand']);
  });
});

describe('membersLabel', () => {
  it('1 membru / 2 membri / 20 de membri', () => {
    expect(membersLabel(1)).toBe('1 membru');
    expect(membersLabel(2)).toBe('2 membri');
    expect(membersLabel(20)).toBe('20 de membri');
  });
});

describe('positionLabel', () => {
  it('five decimals', () => expect(positionLabel({ anchorLat: 45, anchorLng: 25.123456 })).toBe('45.00000, 25.12346'));
});

describe('standAnchorPatch (fish handleStandSelect, c6)', () => {
  const s = { anchorLat: 44.1, anchorLng: 26.1 };
  it('a stand with coordinates moves the anchor and sets the stand', () => {
    expect(standAnchorPatch(s, { documentId: 'st-1', name: 'Stand 3', coordinates: { lat: '44.5', long: '26.5' } })).toEqual({
      anchorLat: 44.5,
      anchorLng: 26.5,
      standId: 'st-1',
      standName: 'Stand 3',
    });
  });
  it('a stand without (or with junk 0/0) coordinates keeps the anchor', () => {
    expect(standAnchorPatch(s, { documentId: 'st-2', name: '4', coordinates: null })).toEqual({ anchorLat: 44.1, anchorLng: 26.1, standId: 'st-2', standName: '4' });
    expect(standCoordinates({ coordinates: { lat: '0', long: '0' } })).toBeNull();
  });
  it('«Fără stand» clears the stand and keeps the anchor', () => {
    expect(standAnchorPatch(s, null)).toEqual({ anchorLat: 44.1, anchorLng: 26.1, standId: null, standName: null });
  });
});
