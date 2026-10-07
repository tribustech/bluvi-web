'use client';

import { applyCropPlan, encodeWithinLimit, type CropOps, type CropPlan } from '@/core/partide/domain/photoCropPipeline';
import type { Size } from '@/core/partide/domain/cropGeometry';
import { MAX_UPLOAD_BYTES, QUALITY_STEPS } from '@/lib/client/compress-image';

/*
 * The browser half of fish's photo pipeline (expo-image-manipulator in fish): decode, rotate, flip,
 * crop and encode on canvases. The ORDER and the crop rect are core's (applyCropPlan /
 * computeCropPlan); this file only knows how to draw. Browser only — the dialog is a client island.
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

type Surface = HTMLCanvasElement;

function canvas(width: number, height: number): [Surface, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  return [c, ctx];
}

const canvasOps: CropOps<Surface> = {
  rotate(src, degrees) {
    const quarter = degrees === 90 || degrees === 270;
    const [c, ctx] = canvas(quarter ? src.height : src.width, quarter ? src.width : src.height);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((degrees * Math.PI) / 180); // clockwise, as the manipulator's rotate
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  },
  flipHorizontal(src) {
    const [c, ctx] = canvas(src.width, src.height);
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return c;
  },
  crop(src, r) {
    const [c, ctx] = canvas(r.width, r.height);
    ctx.drawImage(src, r.originX, r.originY, r.width, r.height, 0, 0, r.width, r.height);
    return c;
  },
};

function encodeJpeg(c: Surface, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality));
}

/**
 * fish `applyCropPlan(uri, plan)`: a fresh pass from THIS working image every time (never
 * compounded), rotate → flip → crop (core), then JPEG under the upload cap (throws when it cannot fit). Resolves the new working image and its size.
 */
export async function renderCropPlan(working: Blob, plan: CropPlan): Promise<{ blob: Blob; size: Size }> {
  const bitmap = await createImageBitmap(working, { imageOrientation: 'from-image' });
  let source: Surface;
  try {
    const [c, ctx] = canvas(bitmap.width, bitmap.height);
    ctx.drawImage(bitmap, 0, 0);
    source = c;
  } finally {
    bitmap.close();
  }
  const out = await applyCropPlan(source, plan, canvasOps);
  // fish saveAsync({ format: JPEG, compress: 0.9 }) — then stepped down until it fits the upload cap.
  const blob = await encodeWithinLimit(q => encodeJpeg(out, q), { qualitySteps: QUALITY_STEPS, maxBytes: MAX_UPLOAD_BYTES });
  return { blob, size: { width: out.width, height: out.height } };
}
