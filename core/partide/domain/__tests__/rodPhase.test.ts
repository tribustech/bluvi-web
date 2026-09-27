import { describe, it, expect } from 'vitest';
import { effectivePhase, isRunningPhase } from '../rodPhase';

const NOW = 1_000_000;

describe('effectivePhase', () => {
  it('passes idle and ready through untouched', () => {
    expect(effectivePhase({ phase: 'idle', endEpoch: null }, NOW)).toBe('idle');
    expect(effectivePhase({ phase: 'ready', endEpoch: null }, NOW)).toBe('ready');
  });

  it('a stored fishing rod whose deadline passed is firing (no tick needed)', () => {
    expect(effectivePhase({ phase: 'fishing', endEpoch: NOW - 1 }, NOW)).toBe('firing');
    expect(effectivePhase({ phase: 'fishing', endEpoch: NOW }, NOW)).toBe('firing');
  });

  it('a rod FROZEN as firing by a wrong clock un-expires once the clock says the deadline is ahead', () => {
    // The cold-start case: the snapshot was mapped with the device clock (ahead),
    // then the first server sample pulled `now` back — the card must recover.
    expect(effectivePhase({ phase: 'firing', endEpoch: NOW + 60_000 }, NOW)).toBe('fishing');
  });

  it('keeps counting down while the deadline is ahead', () => {
    expect(effectivePhase({ phase: 'fishing', endEpoch: NOW + 1 }, NOW)).toBe('fishing');
  });

  it('a running rod with no deadline stays firing (serialized local firing)', () => {
    expect(effectivePhase({ phase: 'firing', endEpoch: null }, NOW)).toBe('firing');
    expect(effectivePhase({ phase: 'fishing', endEpoch: null }, NOW)).toBe('firing');
  });

  it('isRunningPhase covers both faces of a running rod', () => {
    expect(isRunningPhase('fishing')).toBe(true);
    expect(isRunningPhase('firing')).toBe(true);
    expect(isRunningPhase('idle')).toBe(false);
    expect(isRunningPhase('ready')).toBe(false);
  });
});
