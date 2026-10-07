import { describe, expect, it } from 'vitest';
import {
  applyTimePick,
  buildCaptureDetails,
  buildEvent,
  buildRuntimeMetaPatch,
  clampWeight,
  decideCaptureSave,
  MAX_WEIGHT_KG,
  type CaptureFormState,
} from '../captureSave';
import type { LocalRod, RodRuntime } from '../types';

// fish scenes/__tests__/captureDetail.test.ts + captureSave + hooks buildEvent / buildRuntimeMetaPatch

const rod = (over: Partial<LocalRod> = {}): LocalRod & { lane: 'center' } => ({
  index: 1,
  label: 'L1',
  color: '#EF4444',
  bait: 'Boilies',
  baitType: 'boilies',
  baitSize: 20,
  baitFlavor: 'scopex',
  lane: 'center',
  distance: 65,
  castLat: null,
  castLng: null,
  durationMs: 1000,
  alarmSound: 'tone-1',
  ...over,
}) as LocalRod & { lane: 'center' };

const form = (over: Partial<CaptureFormState> = {}): CaptureFormState => ({
  rod: null,
  weightKg: 5,
  weightEstimated: false,
  species: { id: null, name: 'Crap' },
  baitEdit: null,
  photoLocalUri: null,
  coord: null,
  ...over,
});

describe('buildCaptureDetails', () => {
  it('pin overrides rod lat/lng (lane/distance still snapshot the rod)', () => {
    const { log, resolve } = buildCaptureDetails(form({ rod: rod(), coord: { lat: 44.1, lng: 26.2 } }));
    expect([log.lat, log.lng, resolve.lat, resolve.lng]).toEqual([44.1, 26.2, 44.1, 26.2]);
    expect(log.rod).toMatchObject({ index: 1, lane: 'center', distance: 65 });
  });

  it('an explicit derived distance rides both details; absent → omitted (rod snapshot applies)', () => {
    const withDist = buildCaptureDetails(form({ rod: rod(), coord: { lat: 44.1, lng: 26.2 }, distance: 110 }));
    expect(withDist.log.distance).toBe(110);
    expect(withDist.resolve.distance).toBe(110);
    const without = buildCaptureDetails(form({ rod: rod() }));
    expect(without.log.distance).toBeUndefined();
    expect(without.resolve.distance).toBeUndefined();
  });

  it('explicit bait overrides; untouched bait omits the fields; a cleared bait ("") passes through', () => {
    expect(buildCaptureDetails(form({ rod: rod(), baitEdit: { bait: 'Porumb', baitType: null, baitSize: null, baitFlavor: null } })).log.bait).toBe('Porumb');
    const untouched = buildCaptureDetails(form({ rod: rod() }));
    expect(untouched.log.bait).toBeUndefined();
    expect(untouched.log.rod).toMatchObject({ bait: 'Boilies' });
    const cleared = buildCaptureDetails(form({ rod: rod(), baitEdit: { bait: '', baitType: null, baitSize: null, baitFlavor: null } }));
    expect(cleared.log.bait).toBe('');
    expect(cleared.resolve.bait).toBe('');
  });

  it('a weightless catch is never «estimated»', () => {
    const { log, resolve } = buildCaptureDetails(form({ weightKg: null, weightEstimated: true }));
    expect(log.weightEstimated).toBe(false);
    expect(resolve.weightEstimated).toBe(false);
    expect(buildCaptureDetails(form({ weightKg: 3, weightEstimated: true })).log.weightEstimated).toBe(true);
  });

  it('time only when picked; species id and name; no rod → rod null; tags default to null («Toți»)', () => {
    const picked = buildCaptureDetails(form({ occurredAtMs: 123, species: { id: 'f1', name: 'Somn' } }));
    expect(picked.log.occurredAt).toBe(123);
    expect(picked.log).toMatchObject({ species: 'Somn', speciesId: 'f1', rod: null, photoTagUids: null, notes: null });
    expect(buildCaptureDetails(form()).log.occurredAt).toBeUndefined();
  });
});

describe('decideCaptureSave', () => {
  const now = 1_000_000;
  const rt = (phase: RodRuntime['phase'], endEpoch: number | null = null): RodRuntime => ({ phase, endEpoch });
  it('no rod → log; idle / ready → log', () => {
    expect(decideCaptureSave(null, [], now).action).toBe('log');
    expect(decideCaptureSave(1, [rt('idle')], now).action).toBe('log');
    expect(decideCaptureSave(1, [rt('ready')], now).action).toBe('log');
  });
  it('running → ask; past its deadline (firing) → resolve', () => {
    expect(decideCaptureSave(1, [rt('fishing', now + 60_000)], now).action).toBe('ask');
    expect(decideCaptureSave(1, [rt('fishing', now - 1)], now).action).toBe('resolve');
    expect(decideCaptureSave(2, [rt('idle'), rt('firing', now - 5)], now).action).toBe('resolve');
  });
});

describe('buildEvent', () => {
  const session = { clientId: 's1', rods: [rod()], anchorLat: 44.4, anchorLng: 26.1 };
  it('snapshots the rod and lets the detail override it', () => {
    const e = buildEvent(session, rod(), { type: 'emitEvent', outcome: 'capture', occurredAt: 500 }, { weightKg: 4.2, species: 'Crap', bait: 'Porumb' }, 'ev-1', 600);
    expect(e).toMatchObject({
      clientId: 'ev-1',
      sessionClientId: 's1',
      outcome: 'capture',
      rodIndex: 1,
      rodLabel: 'L1',
      bait: 'Porumb',
      baitType: 'boilies',
      lane: 'center',
      distance: 65,
      weightKg: 4.2,
      species: 'Crap',
      occurredAt: 500,
      clientUpdatedAt: 600,
      photoUploadStatus: 'none',
    });
  });
  it('an explicit time and a photo win', () => {
    const e = buildEvent(session, rod(), { type: 'emitEvent', outcome: 'capture', occurredAt: 500 }, { occurredAt: 400, photoLocalUri: 'blob:x' }, 'ev-2', 600);
    expect(e.occurredAt).toBe(400);
    expect(e.photoUploadStatus).toBe('pending');
  });
});

describe('buildRuntimeMetaPatch', () => {
  const s = { rods: [rod({ index: 1 }), rod({ index: 2 })], rodRuntimes: [{ phase: 'fishing' as const, endEpoch: 10 }, { phase: 'idle' as const, endEpoch: null }] };
  it('patches only the changed rod', () => {
    expect(buildRuntimeMetaPatch(s, 1, { phase: 'ready', endEpoch: null })).toEqual({
      rods: s.rods,
      rodRuntimes: [{ phase: 'ready', endEpoch: null }, { phase: 'idle', endEpoch: null }],
      changedRodIndex: 1,
    });
  });
  it('null for firing, an unchanged runtime or an unknown rod', () => {
    expect(buildRuntimeMetaPatch(s, 1, { phase: 'firing', endEpoch: 10 })).toBeNull();
    expect(buildRuntimeMetaPatch(s, 2, { phase: 'idle', endEpoch: null })).toBeNull();
    expect(buildRuntimeMetaPatch(s, 9, { phase: 'ready', endEpoch: null })).toBeNull();
  });
});

describe('weight and time helpers', () => {
  it('clampWeight: 0,1 … 60 kg, three decimals', () => {
    expect(clampWeight(0)).toBe(0.1);
    expect(clampWeight(-3)).toBe(0.1);
    expect(clampWeight(61)).toBe(MAX_WEIGHT_KG);
    expect(clampWeight(3.12345)).toBe(3.123);
  });

  it('applyTimePick sets HH:MM on the base day and rolls a future result back 24 h', () => {
    const base = new Date(2026, 9, 7, 1, 0).getTime(); // 01:00
    const now = base;
    expect(new Date(applyTimePick(base, { hours: 0, minutes: 30 }, now))).toEqual(new Date(2026, 9, 7, 0, 30));
    // 23:40 picked at 01:00 → yesterday
    expect(new Date(applyTimePick(base, { hours: 23, minutes: 40 }, now))).toEqual(new Date(2026, 9, 6, 23, 40));
  });
});
