/**
 * Browser-side photo compression before upload. Uploads travel through the /api/cms proxy,
 * and Vercel refuses request bodies over 4.5 MB; a phone photo straight from the camera can
 * be 5–12 MB. JPEG at fish's quality (0.9, `features/chat/hooks/useChatAttachments.ts`) with the
 * long edge capped at 2048 px lands around 0.5–1.5 MB.
 */
export const MAX_LONG_EDGE_PX = 2048;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // headroom under Vercel's 4.5 MB
/** JPEG qualities tried in order until the encoding fits MAX_UPLOAD_BYTES (also used by the catch-photo crop). */
export const QUALITY_STEPS = [0.9, 0.8, 0.7, 0.6] as const;

/** Scales (w, h) so the long edge is at most `max`; never upscales. */
export function targetSize(width: number, height: number, max = MAX_LONG_EDGE_PX): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const k = max / long;
  return { width: Math.round(width * k), height: Math.round(height * k) };
}

async function encode(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Image encoding failed');
  return blob;
}

/**
 * Returns a JPEG File ready for FormData. EXIF orientation is applied by createImageBitmap
 * (`imageOrientation: 'from-image'`), so the pixels are upright and the EXIF block is dropped.
 */
export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = targetSize(bitmap.width, bitmap.height);
    let blob: Blob | undefined;
    for (const q of QUALITY_STEPS) {
      blob = await encode(bitmap, width, height, q);
      if (blob.size <= MAX_UPLOAD_BYTES) break;
    }
    if (!blob || blob.size > MAX_UPLOAD_BYTES) throw new Error('Fotografia este prea mare chiar și după comprimare.');
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } finally {
    bitmap.close();
  }
}
