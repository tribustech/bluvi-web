import { describe, expect, it } from 'vitest';
import { IDENTITY_TRANSFORM, screenRectToImagePixels, type Size } from '../cropGeometry';
import { applyCropPlan, computeCropPlan, encodeWithinLimit, type CropChange, type CropOps, type CropPlan } from '../photoCropPipeline';

// fish features/partide/helpers/__tests__/photoCropPipeline.test.ts, ported: the manipulator mock
// becomes a recording CropOps.

function recorder() {
  const calls: string[] = [];
  const ops: CropOps<string> = {
    rotate: (img, d) => (calls.push(`rotate:${d}`), `${img}>r${d}`),
    flipHorizontal: img => (calls.push('flip'), `${img}>f`),
    crop: async (img, r) => (calls.push(`crop:${r.width}x${r.height}`), `${img}>c`),
  };
  return { calls, ops };
}
const crop = { originX: 0, originY: 0, width: 10, height: 10 };

describe('applyCropPlan — call order (rotate → flip → crop)', () => {
  it('rotates, then flips, then crops', async () => {
    const { calls, ops } = recorder();
    const out = await applyCropPlan('src', { rotate: 90, flipHorizontal: true, crop }, ops);
    expect(calls).toEqual(['rotate:90', 'flip', 'crop:10x10']);
    expect(out).toBe('src>r90>f>c');
  });
  it('skips rotate at 0 but still flips before the crop', async () => {
    const { calls, ops } = recorder();
    await applyCropPlan('src', { rotate: 0, flipHorizontal: true, crop }, ops);
    expect(calls).toEqual(['flip', 'crop:10x10']);
  });
  it('skips flip when not set', async () => {
    const { calls, ops } = recorder();
    await applyCropPlan('src', { rotate: 270, flipHorizontal: false, crop }, ops);
    expect(calls).toEqual(['rotate:270', 'crop:10x10']);
  });
  it('always crops, even with no rotate and no flip', async () => {
    const { calls, ops } = recorder();
    await applyCropPlan('src', { rotate: 0, flipHorizontal: false, crop } satisfies CropPlan, ops);
    expect(calls).toEqual(['crop:10x10']);
  });
});

const baseChange = (o: Partial<CropChange>): CropChange => ({
  preset: 'original',
  frame: { x: 0, y: 0, width: 400, height: 300 },
  boxSize: { width: 400, height: 300 },
  displayed: { x: 0, y: 0, width: 400, height: 300 },
  imageTransform: IDENTITY_TRANSFORM,
  rotation: 0,
  flipHorizontal: false,
  ...o,
});

describe('computeCropPlan — rotate-before-crop / rotated-size contract', () => {
  it('rotation 0 passes the source size straight through', () => {
    const size: Size = { width: 4000, height: 3000 };
    const c = baseChange({});
    expect(computeCropPlan(size, c).crop).toEqual(screenRectToImagePixels(c.frame, c.displayed, size, c.imageTransform));
  });
  it('rotation 180 does not swap the size', () => {
    const size: Size = { width: 3000, height: 4000 };
    const c = baseChange({ rotation: 180 });
    const plan = computeCropPlan(size, c);
    expect(plan.rotate).toBe(180);
    expect(plan.crop).toEqual(screenRectToImagePixels(c.frame, c.displayed, size, c.imageTransform));
  });
  it('rotation 90: a full-frame crop maps to the ROTATED dimensions, not the raw ones', () => {
    const size: Size = { width: 3000, height: 4000 };
    const c = baseChange({ rotation: 90 });
    const plan = computeCropPlan(size, c);
    expect(plan.crop).toEqual({ originX: 0, originY: 0, width: 4000, height: 3000 });
    expect(screenRectToImagePixels(c.frame, c.displayed, size, c.imageTransform)).toEqual({ originX: 0, originY: 0, width: 3000, height: 4000 });
  });
  it('rotation 90: the on-screen top-left corner is the top-left of the rotated image', () => {
    const c = baseChange({ rotation: 90, frame: { x: 0, y: 0, width: 100, height: 75 } });
    expect(computeCropPlan({ width: 3000, height: 4000 }, c).crop).toEqual({ originX: 0, originY: 0, width: 1000, height: 750 });
  });
  it('rotation 270 swaps like 90', () => {
    expect(computeCropPlan({ width: 3000, height: 4000 }, baseChange({ rotation: 270 })).crop).toEqual({ originX: 0, originY: 0, width: 4000, height: 3000 });
  });
  it('carries rotate and flip through for the pipeline to apply before crop', () => {
    const p = computeCropPlan({ width: 4000, height: 3000 }, baseChange({ rotation: 90, flipHorizontal: true }));
    expect([p.rotate, p.flipHorizontal]).toEqual([90, true]);
  });
});

describe('encodeWithinLimit — a saved crop never exceeds the upload cap', () => {
  const STEPS = [0.9, 0.8, 0.7, 0.6] as const;
  const MAX = 4 * 1024 * 1024;
  // A detailed photo: the size an encoder returns at each quality (bytes ≈ quality-driven).
  const sized = (bytesAt: Record<number, number>) => {
    const tried: number[] = [];
    return { tried, encode: async (q: number) => (tried.push(q), { size: bytesAt[q], q }) };
  };

  it('keeps 0.9 (fish) when it already fits — one encode', async () => {
    const { tried, encode } = sized({ 0.9: 1_200_000 });
    expect(await encodeWithinLimit(encode, { qualitySteps: STEPS, maxBytes: MAX })).toEqual({ size: 1_200_000, q: 0.9 });
    expect(tried).toEqual([0.9]);
  });
  it('steps quality down until the encoding fits (a source compressImage already squeezed)', async () => {
    const { tried, encode } = sized({ 0.9: 5_600_000, 0.8: 4_300_000, 0.7: 3_700_000, 0.6: 3_100_000 });
    expect(await encodeWithinLimit(encode, { qualitySteps: STEPS, maxBytes: MAX })).toEqual({ size: 3_700_000, q: 0.7 });
    expect(tried).toEqual([0.9, 0.8, 0.7]);
  });
  it('exactly at the cap fits', async () => {
    const { encode } = sized({ 0.9: MAX });
    expect((await encodeWithinLimit(encode, { qualitySteps: STEPS, maxBytes: MAX })).size).toBe(MAX);
  });
  it('throws when even the last step is over the cap (the dialog shows its crop error)', async () => {
    const { tried, encode } = sized({ 0.9: 9e6, 0.8: 8e6, 0.7: 7e6, 0.6: MAX + 1 });
    await expect(encodeWithinLimit(encode, { qualitySteps: STEPS, maxBytes: MAX })).rejects.toThrow();
    expect(tried).toEqual([0.9, 0.8, 0.7, 0.6]);
  });
  it('an encoder failure propagates', async () => {
    await expect(encodeWithinLimit(async () => Promise.reject(new Error('encode failed')), { qualitySteps: STEPS, maxBytes: MAX })).rejects.toThrow('encode failed');
  });
});
