import { describe, it, expect } from 'vitest';
import { reduceRodCycle } from '../rodCycle';
import type { LocalRod, RodRuntime } from '../types';

const rod: LocalRod = { index: 1, label: 'L1', color: '#F43F5E', bait: 'Boilies',
  baitType: 'boilies', baitSize: 20, baitFlavor: null, lane: 'center', distance: 65,
  castLat: null, castLng: null, durationMs: 5_400_000, alarmSound: 'tone-1' };
const at = (phase: RodRuntime['phase'], endEpoch: number | null = null): RodRuntime => ({ phase, endEpoch });
const NOW = 1_000_000;

describe('cast', () => {
  it('idle → fishing, schedules the alarm at now+duration', () => {
    const { runtime, effects } = reduceRodCycle(rod, at('idle'), { type: 'cast' }, NOW);
    expect(runtime).toEqual({ phase: 'fishing', endEpoch: NOW + (rod.durationMs ?? 0) });
    expect(effects).toEqual([{ type: 'scheduleAlarm', whenMs: NOW + (rod.durationMs ?? 0), sound: 'tone-1', rodIndex: 1, label: 'L1' }]);
  });

  it('ready → fishing (the one-tap «Lansează din nou»)', () => {
    expect(reduceRodCycle(rod, at('ready'), { type: 'cast' }, NOW).runtime.phase).toBe('fishing');
  });

  it('is rejected while fishing', () => {
    expect(reduceRodCycle(rod, at('fishing', NOW + 1), { type: 'cast' }, NOW).runtime.phase).toBe('fishing');
  });

  it('a stored fishing rod whose deadline already passed recasts like an expired one', () => {
    // No `fired` tick ran (scene unfocused / app just opened): the deadline, not
    // the stamped phase, decides — the rod is expired and may restart.
    const { runtime } = reduceRodCycle(rod, at('fishing', NOW - 1), { type: 'cast' }, NOW);
    expect(runtime).toEqual({ phase: 'fishing', endEpoch: NOW + (rod.durationMs ?? 0) });
  });

  it('a rod frozen as firing with a deadline still ahead is treated as fishing: cast refused, stop needs an outcome', () => {
    expect(reduceRodCycle(rod, at('firing', NOW + 60_000), { type: 'cast' }, NOW).runtime).toEqual(at('firing', NOW + 60_000));
    expect(reduceRodCycle(rod, at('firing', NOW + 60_000), { type: 'requestStop' }, NOW).rejected).toBe('outcome-required');
  });

  it('firing → fishing: an expired rod restarts with nothing recorded', () => {
    const { runtime, effects } = reduceRodCycle(rod, at('firing'), { type: 'cast' }, NOW);
    expect(runtime).toEqual({ phase: 'fishing', endEpoch: NOW + (rod.durationMs ?? 0) });
    expect(effects).toEqual([
      { type: 'scheduleAlarm', whenMs: NOW + (rod.durationMs ?? 0), sound: 'tone-1', rodIndex: 1, label: 'L1' },
    ]);
    expect(effects.some(e => e.type === 'emitEvent')).toBe(false);
  });
});

describe('fired', () => {
  it('fishing → firing, KEEPING the (now past) endEpoch so the card counts up', () => {
    const { runtime, effects } = reduceRodCycle(rod, at('fishing', NOW), { type: 'fired' }, NOW);
    expect(runtime).toEqual({ phase: 'firing', endEpoch: NOW });
    expect(effects).toEqual([]);
  });
});

describe('resolve — the outcome exit from firing', () => {
  it('firing → ready, emits exactly one event and cancels the alarm', () => {
    const { runtime, effects } = reduceRodCycle(rod, at('firing'), { type: 'resolve', outcome: 'capture' }, NOW);
    expect(runtime).toEqual({ phase: 'ready', endEpoch: null });
    expect(effects).toEqual([
      { type: 'cancelAlarm', rodIndex: 1 },
      { type: 'emitEvent', outcome: 'capture', occurredAt: NOW },
    ]);
  });

  it('an early take: resolving while still fishing works the same way', () => {
    const { runtime, effects } = reduceRodCycle(rod, at('fishing', NOW + 99), { type: 'resolve', outcome: 'lost' }, NOW);
    expect(runtime.phase).toBe('ready');
    expect(effects.filter(e => e.type === 'emitEvent')).toHaveLength(1);
  });

  it('resolve with andStop lands in idle (rod taken out of the water)', () => {
    const { runtime } = reduceRodCycle(rod, at('firing'), { type: 'resolve', outcome: 'blank', andStop: true }, NOW);
    expect(runtime.phase).toBe('idle');
  });

  it('is ignored from idle/ready (no phantom events)', () => {
    expect(reduceRodCycle(rod, at('idle'), { type: 'resolve', outcome: 'blank' }, NOW).effects).toEqual([]);
    expect(reduceRodCycle(rod, at('ready'), { type: 'resolve', outcome: 'blank' }, NOW).effects).toEqual([]);
  });
});

describe('requestStop — forced outcome', () => {
  it('rejects stopping a fishing rod', () => {
    const res = reduceRodCycle(rod, at('fishing', NOW + 1), { type: 'requestStop' }, NOW);
    expect(res.rejected).toBe('outcome-required');
    expect(res.runtime.phase).toBe('fishing');
    expect(res.effects).toEqual([]);
  });

  it('rejects stopping a firing rod', () => {
    expect(reduceRodCycle(rod, at('firing'), { type: 'requestStop' }, NOW).rejected).toBe('outcome-required');
  });

  it('ready → idle without an event', () => {
    const res = reduceRodCycle(rod, at('ready'), { type: 'requestStop' }, NOW);
    expect(res.runtime.phase).toBe('idle');
    expect(res.effects).toEqual([]);
    expect(res.rejected).toBeUndefined();
  });
});

describe('timer-free rods (null durationMs)', () => {
  it('cast on a rod without a timer is a no-op (no alarm scheduled, stays idle)', () => {
    const timerFree = { ...rod, durationMs: null, alarmSound: null };
    const res = reduceRodCycle(timerFree, at('idle'), { type: 'cast' }, NOW);
    expect(res.runtime.phase).toBe('idle');
    expect(res.effects).toEqual([]);
  });
});

describe('forceStop — stop without an outcome', () => {
  it('fishing → idle, cancels the alarm, emits no event', () => {
    const res = reduceRodCycle(rod, at('fishing', NOW + 1), { type: 'forceStop' }, NOW);
    expect(res.runtime).toEqual({ phase: 'idle', endEpoch: null });
    expect(res.effects).toEqual([{ type: 'cancelAlarm', rodIndex: rod.index }]);
    expect(res.rejected).toBeUndefined();
  });

  it('firing → idle, cancels the alarm, emits no event', () => {
    const res = reduceRodCycle(rod, at('firing'), { type: 'forceStop' }, NOW);
    expect(res.runtime).toEqual({ phase: 'idle', endEpoch: null });
    expect(res.effects).toEqual([{ type: 'cancelAlarm', rodIndex: rod.index }]);
  });

  it('is a no-op on an idle rod', () => {
    const res = reduceRodCycle(rod, at('idle'), { type: 'forceStop' }, NOW);
    expect(res.runtime.phase).toBe('idle');
    expect(res.effects).toEqual([]);
  });
});
