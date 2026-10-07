import { describe, expect, it } from 'vitest';
import {
  clampTransform,
  coverScale,
  displayedImageRect,
  MIN_FREE_FRAME,
  nextRotation,
  presetRatio,
  ratioFrameRect,
  resizeFreeFrame,
  rotatedSize,
  screenRectToImagePixels,
  translateBounds,
} from '../cropGeometry';

// fish features/partide/helpers/__tests__/cropGeometry.test.ts, ported 1:1, plus the overlay's pure parts.

describe('displayedImageRect (contain fit)', () => {
  it('letterboxes vertically when the image is wider than the box', () => {
    expect(displayedImageRect({ width: 4000, height: 3000 }, { width: 400, height: 400 })).toEqual({ x: 0, y: 50, width: 400, height: 300 });
  });
  it('pillarboxes horizontally when the image is taller than the box', () => {
    expect(displayedImageRect({ width: 3000, height: 4000 }, { width: 400, height: 400 })).toEqual({ x: 50, y: 0, width: 300, height: 400 });
  });
  it('fills exactly when aspect ratios match', () => {
    expect(displayedImageRect({ width: 1000, height: 1000 }, { width: 400, height: 400 })).toEqual({ x: 0, y: 0, width: 400, height: 400 });
  });
});

describe('screenRectToImagePixels (static contain fit, no pan/zoom)', () => {
  const image = { width: 4000, height: 3000 };
  const displayed = { x: 0, y: 50, width: 400, height: 300 };

  it('maps a centred frame to image pixels', () => {
    expect(screenRectToImagePixels({ x: 100, y: 125, width: 200, height: 150 }, displayed, image)).toEqual({ originX: 1000, originY: 750, width: 2000, height: 1500 });
  });
  it('maps the full displayed area to the whole image', () => {
    expect(screenRectToImagePixels({ x: 0, y: 50, width: 400, height: 300 }, displayed, image)).toEqual({ originX: 0, originY: 0, width: 4000, height: 3000 });
  });
  it('clamps a frame dragged past the top-left edge', () => {
    expect(screenRectToImagePixels({ x: -40, y: 10, width: 200, height: 150 }, displayed, image)).toEqual({ originX: 0, originY: 0, width: 1600, height: 1100 });
  });
  it('clamps a frame dragged past the bottom-right edge', () => {
    const r = screenRectToImagePixels({ x: 300, y: 250, width: 200, height: 150 }, displayed, image);
    expect(r.originX + r.width).toBeLessThanOrEqual(4000);
    expect(r.originY + r.height).toBeLessThanOrEqual(3000);
  });
  it('returns integer pixels', () => {
    const r = screenRectToImagePixels({ x: 33.7, y: 71.2, width: 101.4, height: 77.9 }, displayed, image);
    Object.values(r).forEach(v => expect(Number.isInteger(v)).toBe(true));
  });
  it('never returns a zero-or-negative dimension', () => {
    const r = screenRectToImagePixels({ x: 0, y: 0, width: 0, height: 0 }, displayed, image);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});

describe('screenRectToImagePixels (zoomed + panned image beneath a fixed frame)', () => {
  const image = { width: 4000, height: 3000 };
  const displayed = { x: 0, y: 0, width: 400, height: 300 };
  const frame = { x: 0, y: 0, width: 400, height: 300 };
  const transform = { translateX: -100, translateY: -50, scale: 2 };

  it('crops the visually-selected region of a zoomed-in, panned image', () => {
    expect(screenRectToImagePixels(frame, displayed, image, transform)).toEqual({ originX: 1500, originY: 1000, width: 2000, height: 1500 });
  });
  it('still clamps to the image bounds past the rendered edge', () => {
    expect(screenRectToImagePixels({ x: -350, y: -250, width: 200, height: 150 }, displayed, image, transform)).toEqual({ originX: 0, originY: 0, width: 750, height: 500 });
  });
  it('an identity transform reproduces the static result exactly', () => {
    const f = { x: 100, y: 50, width: 200, height: 150 };
    expect(screenRectToImagePixels(f, displayed, image, { translateX: 0, translateY: 0, scale: 1 })).toEqual(screenRectToImagePixels(f, displayed, image));
  });
});

describe('overlay geometry (fish PhotoCropOverlay inline maths)', () => {
  it('swaps the size for a quarter turn only', () => {
    expect(rotatedSize({ width: 3000, height: 4000 }, 90)).toEqual({ width: 4000, height: 3000 });
    expect(rotatedSize({ width: 3000, height: 4000 }, 270)).toEqual({ width: 4000, height: 3000 });
    expect(rotatedSize({ width: 3000, height: 4000 }, 180)).toEqual({ width: 3000, height: 4000 });
  });
  it('rotates clockwise in quarter turns, wrapping at 360', () => {
    expect([nextRotation(0), nextRotation(90), nextRotation(180), nextRotation(270)]).toEqual([90, 180, 270, 0]);
  });
  it('reads the preset ratio; original = the image, free = none', () => {
    expect(presetRatio('original', { width: 4000, height: 3000 })).toBeCloseTo(4 / 3);
    expect(presetRatio('free', { width: 4000, height: 3000 })).toBeNull();
    expect(presetRatio('1:1', { width: 4000, height: 3000 })).toBe(1);
  });
  it('maximises and centres a ratio frame in the box', () => {
    expect(ratioFrameRect(1, { width: 400, height: 300 })).toEqual({ x: 50, y: 0, width: 300, height: 300 });
  });
  it('the cover scale makes the contained image cover the frame, never below 1', () => {
    const contain = { x: 0, y: 50, width: 400, height: 300 };
    expect(coverScale(contain, { x: 0, y: 0, width: 400, height: 400 })).toBeCloseTo(4 / 3);
    expect(coverScale(contain, { x: 50, y: 50, width: 300, height: 300 })).toBe(1);
  });
  it('clamps a pan so the image keeps covering the frame', () => {
    const contain = { x: 0, y: 0, width: 400, height: 300 };
    const frame = { x: 50, y: 0, width: 300, height: 300 };
    const b = translateBounds(contain, frame, 1);
    expect(b).toEqual({ minTX: -50, maxTX: 50, minTY: 0, maxTY: 0 });
    expect(clampTransform({ translateX: 500, translateY: -9, scale: 0.2 }, contain, frame, 1, 4)).toEqual({ translateX: 50, translateY: 0, scale: 1 });
  });
  it('resizes a freeform frame from the start snapshot, within the box and the minimum side', () => {
    const start = { x: 100, y: 100, width: 200, height: 200 };
    const box = { width: 400, height: 400 };
    expect(resizeFreeFrame(start, 'br', 50, 20, box)).toEqual({ x: 100, y: 100, width: 250, height: 220 });
    expect(resizeFreeFrame(start, 'tl', -500, -500, box)).toEqual({ x: 0, y: 0, width: 300, height: 300 });
    expect(resizeFreeFrame(start, 'tr', -1000, 1000, box)).toEqual({ x: 100, y: 240, width: MIN_FREE_FRAME, height: MIN_FREE_FRAME });
    expect(resizeFreeFrame(start, 'br', 1000, 1000, box)).toEqual({ x: 100, y: 100, width: 300, height: 300 });
  });
});
