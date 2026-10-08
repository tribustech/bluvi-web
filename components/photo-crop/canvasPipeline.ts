'use client';

import { applyCropPlan, encodeWithinLimit, type CropOps, type CropPlan } from '@/core/partide/domain/photoCropPipeline';
import type { Size } from '@/core/partide/domain/cropGeometry';
import { MAX_UPLOAD_BYTES, QUALITY_STEPS } from '@/lib/client/compress-image';

/*
 * The browser half of fish's photo pipeline (expo-image-manipulator in fish): decode, rotate, flip,
 * crop and encode on ONE canvas (the crop's size), the photo bounded to WORKING_MAX_EDGE first. The
 * ORDER and the crop rect are core's (applyCropPlan / computeCropPlan); this file only knows how to draw. Browser only — the dialog is a client island.
 */

/** fish `RNImage.getSize`: the photo's displayed pixel size (EXIF orientation applied). Throws on a file that is not an image. */
export async function measurePhoto(blob: Blob): Promise<Size> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

/**
 * The long edge the crop works at. iOS Safari caps a canvas at ~16.7 MP (4096²) and a phone photo is
 * 24–200 MP, so the photo is never drawn at full size: the sent photo is reduced to ≤ 1280 px anyway
 * (compressChatPhoto), and 2560² is 6.5 MP — every canvas here stays well under the cap.
 */
export const WORKING_MAX_EDGE = 2560;

/** The size the crop works at: the photo's own size, or scaled down to WORKING_MAX_EDGE on its long edge. Plan the crop (computeCropPlan) on THIS size. */
export function workingSize(size: Size, maxEdge = WORKING_MAX_EDGE): Size {
  const long = Math.max(size.width, size.height);
  if (long <= maxEdge) return size;
  const k = maxEdge / long;
  return { width: Math.max(1, Math.round(size.width * k)), height: Math.max(1, Math.round(size.height * k)) };
}

/**
 * The pipeline image, lazily: where each source pixel lands (a matrix) and the image's size so far.
 * core's applyCropPlan still dictates the ORDER (rotate → flip → crop); the ops only compose, and the
 * pixels are drawn once, straight from the decoded photo into a canvas of the crop's size — no
 * intermediate full-size canvases.
 */
type Placed = { m: DOMMatrix; width: number; height: number };

const placedOps: CropOps<Placed> = {
  rotate(src, degrees) {
    // clockwise, as the manipulator's rotate: (x, y) → (h − y, x) for 90°, etc.
    const post = new DOMMatrix();
    if (degrees === 90) post.translateSelf(src.height, 0);
    else if (degrees === 180) post.translateSelf(src.width, src.height);
    else post.translateSelf(0, src.width);
    post.rotateSelf(degrees);
    const quarter = degrees === 90 || degrees === 270;
    return { m: post.multiply(src.m), width: quarter ? src.height : src.width, height: quarter ? src.width : src.height };
  },
  flipHorizontal(src) {
    return { ...src, m: new DOMMatrix().translateSelf(src.width, 0).scaleSelf(-1, 1).multiply(src.m) };
  },
  crop(src, r) {
    return { m: new DOMMatrix().translateSelf(-r.originX, -r.originY).multiply(src.m), width: r.width, height: r.height };
  },
};

function encodeJpeg(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality));
}

/**
 * fish `applyCropPlan(uri, plan)`: a fresh pass from THIS working image every time (never
 * compounded), rotate → flip → crop (core), then JPEG under the upload cap (throws when it cannot fit).
 * `size` is the size `plan` was computed on (workingSize of the measured photo): the photo is decoded
 * straight to it (EXIF applied, then scaled — the browser never holds a full-size canvas). Resolves
 * the new working image and its size.
 */
export async function renderCropPlan(working: Blob, plan: CropPlan, size: Size): Promise<{ blob: Blob; size: Size }> {
  const bitmap = await createImageBitmap(working, {
    imageOrientation: 'from-image',
    resizeWidth: size.width,
    resizeHeight: size.height,
    resizeQuality: 'high',
  });
  let out: HTMLCanvasElement;
  try {
    const placed = await applyCropPlan<Placed>({ m: new DOMMatrix(), width: bitmap.width, height: bitmap.height }, plan, placedOps);
    out = document.createElement('canvas');
    out.width = placed.width;
    out.height = placed.height;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(placed.m);
    ctx.drawImage(bitmap, 0, 0);
  } finally {
    bitmap.close();
  }
  // fish saveAsync({ format: JPEG, compress: 0.9 }) — then stepped down until it fits the upload cap.
  const blob = await encodeWithinLimit(q => encodeJpeg(out, q), { qualitySteps: QUALITY_STEPS, maxBytes: MAX_UPLOAD_BYTES });
  return { blob, size: { width: out.width, height: out.height } };
}
