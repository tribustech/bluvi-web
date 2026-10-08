import { describe, expect, it } from 'vitest';
import { anyRunning, inkOn, rodClockView, sameRuntime } from './countdown';

const NOW = 1_800_000_000_000;
const rod = { durationMs: 30 * 60_000 };

describe('rodClockView (fish PartidaRodCard countdown)', () => {
  it('idle: not running, no progress', () => {
    const v = rodClockView(rod, { phase: 'idle', endEpoch: null }, NOW, false);
    expect(v).toMatchObject({ running: false, expired: false, progress: 0 });
  });

  it('fishing: «Timp rămas» and the remaining time, progress at least 2 %', () => {
    const v = rodClockView(rod, { phase: 'fishing', endEpoch: NOW + 12 * 60_000 + 30_000 }, NOW, false);
    expect(v).toMatchObject({ running: true, expired: false, label: 'Timp rămas', value: '00:12:30', tone: 'ink' });
    expect(v.progress).toBeCloseTo(1 - 750_000 / 1_800_000);
    expect(rodClockView(rod, { phase: 'fishing', endEpoch: NOW + rod.durationMs }, NOW, false).progress).toBe(0.02);
  });

  it('a deadline that passed is «Expirat» on minus, even when the snapshot still says fishing (c10)', () => {
    const v = rodClockView(rod, { phase: 'fishing', endEpoch: NOW - 133_000 }, NOW, false);
    expect(v).toMatchObject({ phase: 'firing', running: true, expired: true, label: 'Expirat', value: '-00:02:13', tone: 'danger', progress: 1 });
  });

  it('a firing runtime whose deadline is still ahead counts down again (effectivePhase both ways)', () => {
    const v = rodClockView(rod, { phase: 'firing', endEpoch: NOW + 60_000 }, NOW, false);
    expect(v).toMatchObject({ phase: 'fishing', expired: false, value: '00:01:00' });
  });

  it('a firing runtime with no deadline reads «A expirat»', () => {
    expect(rodClockView(rod, { phase: 'firing', endEpoch: null }, NOW, false).value).toBe('A expirat');
  });

  it('provisional: «Se sincronizează», muted — never a red «Expirat» (invariant 18)', () => {
    const past = rodClockView(rod, { phase: 'fishing', endEpoch: NOW - 5_000 }, NOW, true);
    expect(past).toMatchObject({ label: 'Se sincronizează', tone: 'muted' });
    expect(rodClockView(rod, { phase: 'fishing', endEpoch: NOW + 5_000 }, NOW, true)).toMatchObject({ label: 'Se sincronizează', tone: 'muted' });
  });
});

describe('anyRunning / sameRuntime / inkOn', () => {
  it('ticks only while a rod is fishing or firing', () => {
    expect(anyRunning([{ phase: 'idle', endEpoch: null }, { phase: 'ready', endEpoch: null }], NOW)).toBe(false);
    expect(anyRunning([{ phase: 'idle', endEpoch: null }, { phase: 'fishing', endEpoch: NOW - 1 }], NOW)).toBe(true);
  });

  it('idle and ready draw the same; running needs the same deadline', () => {
    expect(sameRuntime({ phase: 'idle', endEpoch: null }, { phase: 'ready', endEpoch: null })).toBe(true);
    expect(sameRuntime({ phase: 'fishing', endEpoch: 5 }, { phase: 'firing', endEpoch: 5 })).toBe(true);
    expect(sameRuntime({ phase: 'fishing', endEpoch: 5 }, { phase: 'fishing', endEpoch: 6 })).toBe(false);
    expect(sameRuntime({ phase: 'fishing', endEpoch: 5 }, { phase: 'idle', endEpoch: null })).toBe(false);
  });

  it('picks the readable ink on a rod colour', () => {
    expect(inkOn('#22C55E')).toBe('dark');
    expect(inkOn('#FACC15')).toBe('dark');
    expect(inkOn('#4F46E5')).toBe('light');
    expect(inkOn('#1E293B')).toBe('light');
    expect(inkOn(null)).toBe('light');
  });
});
