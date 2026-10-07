/**
 * fish features/partide/helpers/cropGeometry.ts — pure crop geometry for the catch-photo crop
 * overlay. No React, no I/O, no clock: arithmetic on plain rects so it is unit-tested without
 * rendering anything.
 *
 * The crop frame lives in screen coordinates (the overlay's own layout box); the crop step wants
 * integer *image pixel* coordinates. Two things sit between those spaces:
 *  - the image is `contain`-fitted into its box, which letterboxes/pillarboxes it
 *    (`displayedImageRect`);
 *  - with a ratio preset selected, the frame is the fixed viewport and the *image* pans/zooms
 *    beneath it (fish's TikTok interaction model), so the conversion also undoes that transform
 *    (`screenRectToImagePixels`'s `transform`). Freeform is the simpler case: the image stays at its
 *    identity transform and the frame itself resizes.
 *
 * Below the fish port: the pure pieces fish keeps inline in PhotoCropOverlay.tsx (the presets, the
 * rotated size, the pan bounds, the "just covers the frame" scale, the freeform corner resize), so
 * the web overlay computes nothing of its own.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

/** The crop step's shape: integer pixels, origin-named (expo-image-manipulator's in fish). */
export interface PixelRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * A pan/zoom applied to the base `displayed` (contain-fit) rect, about its own centre — how the
 * overlay's image container is transformed beneath the fixed frame. `scale` 1 / `translate` 0 is
 * the identity (the static, untransformed contain fit).
 */
export interface ImageTransform {
  translateX: number;
  translateY: number;
  scale: number;
}

export const IDENTITY_TRANSFORM: ImageTransform = { translateX: 0, translateY: 0, scale: 1 };

/** A degenerate crop (zero/negative side) is rejected by the crop step — clamp to this instead. */
const MIN_CROP_PX = 1;

export function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Where a `contain`-fitted image actually sits inside its box (letterbox/pillarbox offsets). */
export function displayedImageRect(image: Size, box: Size): Rect {
  const imageRatio = image.width / image.height;
  const boxRatio = box.width / box.height;

  if (imageRatio > boxRatio) {
    // Image is relatively wider than the box → fills the box's width, letterboxed above and below.
    const width = box.width;
    const height = width / imageRatio;
    return { x: 0, y: (box.height - height) / 2, width, height };
  }

  // Image is relatively taller than (or exactly matches) the box → fills the box's height,
  // pillarboxed (or exactly fitted) left/right.
  const height = box.height;
  const width = height * imageRatio;
  return { x: (box.width - width) / 2, y: 0, width, height };
}

/**
 * Screen-space crop frame → integer image-pixel rect, clamped to the image bounds. Fractional
 * pixels and out-of-bounds rects are handled here rather than at the call site; a degenerate frame
 * clamps to a minimum 1×1.
 *
 * `transform` accounts for the pan/zoom the overlay applies to the image beneath a fixed-ratio
 * frame. Omit it (or pass `IDENTITY_TRANSFORM`) for the static case — a moving frame over a static
 * image, as in the freeform preset.
 */
export function screenRectToImagePixels(
  frame: Rect,
  displayed: Rect,
  image: Size,
  transform: ImageTransform = IDENTITY_TRANSFORM,
): PixelRect {
  const { translateX, translateY, scale } = transform;

  // Where the (possibly panned/zoomed) image renders on screen: `displayed` scaled about its own
  // centre, then translated — mirroring how the overlay moves the image beneath the fixed frame.
  const centerX = displayed.x + displayed.width / 2;
  const centerY = displayed.y + displayed.height / 2;
  const renderedWidth = displayed.width * scale;
  const renderedHeight = displayed.height * scale;
  const renderedX = centerX - renderedWidth / 2 + translateX;
  const renderedY = centerY - renderedHeight / 2 + translateY;

  // A 0 scale would otherwise divide by zero below.
  const safeWidth = renderedWidth || MIN_CROP_PX;
  const safeHeight = renderedHeight || MIN_CROP_PX;

  // Intersect the frame with the rendered image bounds in SCREEN space first — this clamps a frame
  // dragged past an edge, in either direction, before any conversion to image pixels.
  const left = clamp(frame.x, renderedX, renderedX + safeWidth);
  const top = clamp(frame.y, renderedY, renderedY + safeHeight);
  const right = clamp(frame.x + frame.width, renderedX, renderedX + safeWidth);
  const bottom = clamp(frame.y + frame.height, renderedY, renderedY + safeHeight);

  const relLeft = (left - renderedX) / safeWidth;
  const relTop = (top - renderedY) / safeHeight;
  const relRight = (right - renderedX) / safeWidth;
  const relBottom = (bottom - renderedY) / safeHeight;

  let originX = Math.round(relLeft * image.width);
  let originY = Math.round(relTop * image.height);
  let width = Math.round((relRight - relLeft) * image.width);
  let height = Math.round((relBottom - relTop) * image.height);

  if (width < MIN_CROP_PX) {
    width = MIN_CROP_PX;
    originX = Math.min(originX, image.width - MIN_CROP_PX);
  }
  if (height < MIN_CROP_PX) {
    height = MIN_CROP_PX;
    originY = Math.min(originY, image.height - MIN_CROP_PX);
  }

  return { originX, originY, width, height };
}

// ── fish PhotoCropOverlay.tsx, the pure parts ────────────────────────────────────────────────────

export type CropRotation = 0 | 90 | 180 | 270;

export type CropPresetId = 'original' | 'free' | '4:3' | '1:1' | '3:4' | '16:9';

export interface CropPreset {
  id: CropPresetId;
  label: string;
  /** width/height. `null` for `original` (the photo's own ratio) and `free` (no fixed ratio). */
  ratio: number | null;
}

/**
 * fish PRESETS. 9:16 is deliberately excluded: it isn't what a phone camera shoots by default
 * (that's 3:4) and it letterboxes on every surface catch photos are rendered on.
 */
export const CROP_PRESETS: readonly CropPreset[] = [
  { id: 'original', label: 'Original', ratio: null },
  { id: 'free', label: 'Liber', ratio: null },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

/** fish's overlay opens on 4:3. */
export const DEFAULT_CROP_PRESET: CropPresetId = '4:3';

/** How far past the "just covers the frame" scale a zoom can go. */
export const MAX_ZOOM_MULTIPLIER = 4;
/** Smallest a freeform frame's side can be dragged to, in screen px. */
export const MIN_FREE_FRAME = 60;

/** The image's pixel size after a quarter-turn rotation: 90/270 swap width and height. */
export function rotatedSize(size: Size, rotation: CropRotation): Size {
  return rotation === 90 || rotation === 270 ? { width: size.height, height: size.width } : size;
}

export function nextRotation(rotation: CropRotation): CropRotation {
  return ((rotation + 90) % 360) as CropRotation;
}

/** The preset's width/height ratio; `original` is the (rotated) image's own, `free` has none. */
export function presetRatio(preset: CropPresetId, image: Size): number | null {
  if (preset === 'original') return image.width / image.height;
  return CROP_PRESETS.find(p => p.id === preset)?.ratio ?? null;
}

/**
 * The fixed viewport of a ratio preset: a virtual image of that ratio contain-fitted (maximised and
 * centred) into the box. fish reuses `displayedImageRect` for it rather than duplicating the maths.
 */
export function ratioFrameRect(ratio: number, box: Size): Rect {
  return displayedImageRect({ width: ratio, height: 1 }, box);
}

/** The smallest zoom at which the contain-fitted image still covers the whole frame (≥ 1). */
export function coverScale(contain: Rect, frame: Rect): number {
  if (contain.width === 0 || contain.height === 0) return 1;
  return Math.max(frame.width / contain.width, frame.height / contain.height, 1);
}

/**
 * Translate bounds (screen px) that keep `container` (scaled about its own centre by `scale`)
 * fully covering `frame` — no empty gap inside the fixed viewport.
 */
export function translateBounds(container: Rect, frame: Rect, scale: number) {
  const centerX = container.x + container.width / 2;
  const centerY = container.y + container.height / 2;
  const halfW = (container.width * scale) / 2;
  const halfH = (container.height * scale) / 2;
  return {
    minTX: frame.x + frame.width - centerX - halfW,
    maxTX: frame.x - centerX + halfW,
    minTY: frame.y + frame.height - centerY - halfH,
    maxTY: frame.y - centerY + halfH,
  };
}

/** A pan/zoom clamped so the image keeps covering the frame (fish's pan and pinch handlers). */
export function clampTransform(t: ImageTransform, container: Rect, frame: Rect, minScale: number, maxScale: number): ImageTransform {
  const scale = clamp(t.scale, minScale, maxScale);
  const b = translateBounds(container, frame, scale);
  return { scale, translateX: clamp(t.translateX, b.minTX, b.maxTX), translateY: clamp(t.translateY, b.minTY, b.maxTY) };
}

export type CropCorner = 'tl' | 'tr' | 'bl' | 'br';

/**
 * fish `resizeFromCorner`: a freeform corner drag. `dx`/`dy` are CUMULATIVE since the drag began
 * and always apply to the frame as it was at the start (`start`), never to the latest one — or the
 * frame resizes faster than the pointer moves. Each side stays ≥ MIN_FREE_FRAME and inside the box.
 */
export function resizeFreeFrame(start: Rect, corner: CropCorner, dx: number, dy: number, box: Size): Rect {
  let { x, y, width, height } = start;
  if (corner === 'tl' || corner === 'bl') {
    const newX = clamp(start.x + dx, 0, start.x + start.width - MIN_FREE_FRAME);
    width = start.width + (start.x - newX);
    x = newX;
  } else {
    width = clamp(start.width + dx, MIN_FREE_FRAME, box.width - start.x);
  }
  if (corner === 'tl' || corner === 'tr') {
    const newY = clamp(start.y + dy, 0, start.y + start.height - MIN_FREE_FRAME);
    height = start.height + (start.y - newY);
    y = newY;
  } else {
    height = clamp(start.height + dy, MIN_FREE_FRAME, box.height - start.y);
  }
  return { x, y, width, height };
}
