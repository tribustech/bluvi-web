import { describe, expect, it } from 'vitest';
import { releaseVelocity, rubberBand, settle } from './sheetPhysics';

describe('releaseVelocity', () => {
  it('reads the last 100 ms only', () => {
    const v = releaseVelocity([
      { y: 0, t: 0 },
      { y: 10, t: 400 },
      { y: 60, t: 450 },
      { y: 110, t: 500 },
    ]);
    expect(v).toBeCloseTo(1); // 100 px in 100 ms
  });
  it('is 0 for a hold without movement', () => {
    expect(releaseVelocity([{ y: 5, t: 0 }])).toBe(0);
  });
});

describe('settle', () => {
  const rests = [332, 598]; // 50% and 90% of a 664 px phone
  it('a still release settles on the nearest rest', () => {
    expect(settle(350, 0, rests, true)).toBe(0);
    expect(settle(560, 0, rests, true)).toBe(1);
  });
  it('a slow drag closes only past half of the lowest rest', () => {
    expect(settle(180, 0, rests, true)).toBe(0);
    expect(settle(150, 0, rests, true)).toBe('close');
  });
  it('a flick down closes from the low rest, a flick up opens the high one', () => {
    expect(settle(300, 1.5, rests, true)).toBe('close');
    expect(settle(360, -1.5, rests, true)).toBe(1);
  });
  it('a sheet that cannot be dismissed never closes', () => {
    expect(settle(20, 3, rests, false)).toBe(0);
  });
});

describe('rubberBand', () => {
  it('damps past the ends only', () => {
    expect(rubberBand(400, 300, 600)).toBe(400);
    expect(rubberBand(700, 300, 600)).toBe(620);
    expect(rubberBand(200, 300, 600)).toBe(270);
  });
});
