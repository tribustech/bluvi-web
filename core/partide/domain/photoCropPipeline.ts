/**
 * fish features/partide/helpers/photoCropPipeline.ts — turns the crop overlay's «Salvează» into
 * the plan for an image pipeline (fish: expo-image-manipulator `rotate().flip().crop()`; web: a
 * canvas in the photo-preview dialog).
 *
 * THE load-bearing contract this module exists to get right: `screenRectToImagePixels`'s `image`
 * must be the photo's size AFTER rotation — 90/270 swaps width and height — not the raw source
 * size. The overlay computes `displayed`/`frame` against that same rotated size, so feeding the raw
 * size would map the on-screen frame onto a different region of the source pixels. The pipeline must
 * also apply rotate (and flip) BEFORE crop for the identical reason: crop coordinates are only
 * meaningful against the image as it was when the frame was drawn — after rotation.
 */
import { rotatedSize, screenRectToImagePixels, type CropPresetId, type CropRotation, type ImageTransform, type PixelRect, type Rect, type Size } from './cropGeometry';

/** fish `PhotoCropOverlayChange`: what the overlay reports on «Salvează». */
export interface CropChange {
  preset: CropPresetId;
  /** Screen-space crop frame, relative to the overlay's crop-stage box. */
  frame: Rect;
  /** The crop-stage box size the frame/displayed rects are measured in. */
  boxSize: Size;
  /** Base contain-fit rect of the (rotation-adjusted) image within the box, at the identity transform. */
  displayed: Rect;
  /** The pan/zoom of the image beneath the frame — identity for `free`/`original`. */
  imageTransform: ImageTransform;
  rotation: CropRotation;
  flipHorizontal: boolean;
}

export interface CropPlan {
  /** Degrees to rotate BEFORE crop (0 = no-op), clockwise. */
  rotate: CropRotation;
  /** Whether to flip horizontally BEFORE crop, after rotate. */
  flipHorizontal: boolean;
  /** Pixel-space crop rect, computed against the ROTATED image size. */
  crop: PixelRect;
}

export function computeCropPlan(sourceSize: Size, change: CropChange): CropPlan {
  const crop = screenRectToImagePixels(change.frame, change.displayed, rotatedSize(sourceSize, change.rotation), change.imageTransform);
  return { rotate: change.rotation, flipHorizontal: change.flipHorizontal, crop };
}

/** The image operations a platform provides (fish: the manipulator context; web: canvases). */
export interface CropOps<I> {
  rotate(image: I, degrees: Exclude<CropRotation, 0>): I | Promise<I>;
  flipHorizontal(image: I): I | Promise<I>;
  crop(image: I, rect: PixelRect): I | Promise<I>;
}

/**
 * fish `applyCropPlan`: runs the plan in its one valid ORDER — rotate, then flip, then crop. Kept
 * here so the order is asserted by a test rather than readable-and-hoped-correct in a component;
 * `plan.crop` was computed against the image as it exists AFTER rotate+flip, so crop never runs
 * first. Encoding the result is the caller's (fish `saveAsync` JPEG 0.9).
 */
export async function applyCropPlan<I>(source: I, plan: CropPlan, ops: CropOps<I>): Promise<I> {
  let image = source;
  if (plan.rotate !== 0) image = await ops.rotate(image, plan.rotate);
  if (plan.flipHorizontal) image = await ops.flipHorizontal(image);
  return ops.crop(image, plan.crop);
}

/**
 * Encodes a saved crop under the upload cap. fish re-encodes at a fixed 0.9, but on the web every
 * upload goes through a proxy with a hard body limit, and the source may already have been stepped
 * down in quality just to fit (lib/client/compress-image) — so a crop that cuts little (or only
 * rotates) could come back over it at 0.9. Walks the same quality ladder and keeps the first
 * encoding that fits; throws when even the last step is too big (the dialog shows its crop error,
 * never a catch silently saved without its photo).
 */
export async function encodeWithinLimit<B extends { size: number }>(
  encode: (quality: number) => Promise<B>,
  { qualitySteps, maxBytes }: { qualitySteps: readonly number[]; maxBytes: number },
): Promise<B> {
  for (const q of qualitySteps) {
    const blob = await encode(q);
    if (blob.size <= maxBytes) return blob;
  }
  throw new Error('crop encoding over the upload limit');
}
