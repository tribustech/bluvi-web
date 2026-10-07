import { describe, expect, it } from 'vitest';
import { destinationOf } from './laneFixtures';
import { laneForRod, LANE_TOLERANCE_DEG } from '../derivedLane';
import type { LocalRod } from '../types';

const anchor = { lat: 44.43, lng: 26.1 };

const rod = (index: number, patch: Partial<LocalRod> = {}): LocalRod => ({
  index,
  label: `L${index}`,
  color: '#6366F1',
  bait: '',
  baitType: null,
  baitSize: null,
  baitFlavor: null,
  lane: 'left',
  distance: 60,
  castLat: null,
  castLng: null,
  durationMs: null,
  alarmSound: null,
  ...patch,
});

const placed = (index: number, bearing: number, m = 80): LocalRod => {
  const p = destinationOf(anchor, bearing, m);
  return rod(index, { castLat: p.lat, castLng: p.lng, lane: 'center' });
};

describe('laneForRod', () => {
  it('a schematic rod keeps its stored lane', () => {
    const r = rod(1, { lane: 'right' });
    expect(laneForRod([r], r, anchor)).toBe('right');
    expect(laneForRod([r], r, null)).toBe('right');
  });

  it('a map rod without an anchor has no honest lane', () => {
    const r = placed(1, 0);
    expect(laneForRod([r], r, null)).toBeNull();
  });

  it('a single map rod is degenerate (its own bearing is «forward») → null, never a fake Centru', () => {
    const r = placed(1, 37);
    expect(laneForRod([r], r, anchor)).toBeNull();
  });

  it('every cast inside the centre cone → null for all of them', () => {
    const rods = [placed(1, 0), placed(2, LANE_TOLERANCE_DEG - 5), placed(3, -(LANE_TOLERANCE_DEG - 5))];
    for (const r of rods) expect(laneForRod(rods, r, anchor)).toBeNull();
  });

  it('a fan of three casts reads Stânga / Centru / Dreapta around the mean bearing', () => {
    const left = placed(1, 330);
    const centre = placed(2, 0);
    const right = placed(3, 30);
    const rods = [left, centre, right];
    expect(laneForRod(rods, left, anchor)).toBe('left');
    expect(laneForRod(rods, centre, anchor)).toBe('center');
    expect(laneForRod(rods, right, anchor)).toBe('right');
  });

  it('wraps across north (350° and 10° are 20° apart, not 340°)', () => {
    const a = placed(1, 340);
    const b = placed(2, 20);
    expect(laneForRod([a, b], a, anchor)).toBe('left');
    expect(laneForRod([a, b], b, anchor)).toBe('right');
  });
});
