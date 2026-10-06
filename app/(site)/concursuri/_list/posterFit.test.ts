import { describe, expect, it } from 'vitest';
import { clampRatio, MAX_RATIO, MIN_RATIO, posterFrame } from './posterFit';

describe('posterFrame', () => {
  it('clamps the phone frame to fish 0.55–2.4', () => {
    expect(clampRatio(0.3)).toBe(MIN_RATIO);
    expect(clampRatio(4)).toBe(MAX_RATIO);
    expect(clampRatio(1.5)).toBe(1.5);
  });

  it('fills the phone frame inside the clamp, shows the poster whole outside it', () => {
    expect(posterFrame(1.5)).toMatchObject({ phoneRatio: 1.5, phoneContain: false });
    expect(posterFrame(0.4)).toMatchObject({ phoneRatio: MIN_RATIO, phoneContain: true });
    expect(posterFrame(3)).toMatchObject({ phoneRatio: MAX_RATIO, phoneContain: true });
  });

  it('fills the desktop square only for a near-square poster', () => {
    expect(posterFrame(1).squareContain).toBe(false);
    expect(posterFrame(1.15).squareContain).toBe(false);
    expect(posterFrame(0.85).squareContain).toBe(false);
    expect(posterFrame(1.5).squareContain).toBe(true);
    expect(posterFrame(0.7).squareContain).toBe(true);
  });

  it('crops nothing while the ratio is unknown', () => {
    expect(posterFrame(null)).toEqual({ phoneRatio: 4 / 3, phoneContain: false, squareContain: true });
    expect(posterFrame(Number.NaN).squareContain).toBe(true);
  });
});
