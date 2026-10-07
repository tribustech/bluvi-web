import { shouldKeepOriginal, uploadImageTarget, UPLOAD_MIME } from '@/core/social';

/**
 * A picked photo, ready for the avatar upload (fish hooks/useCamera.ts pickImage → react-native-
 * compressor «auto»): EXIF orientation applied, long edge capped at 1280, JPEG 0.8, and the
 * original kept when it is already a JPEG that needs no resize and the re-encode is not smaller
 * (core social.domain uploadImageTarget / shouldKeepOriginal). Throws when the browser cannot decode
 * the file (HEIC on a desktop browser, a non-image): the caller says so.
 */
export async function prepareAvatarFile(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const target = uploadImageTarget({ width: bitmap.width, height: bitmap.height });
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    // JPEG has no alpha: a transparent PNG would turn black where it is see-through.
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, target.width, target.height);
    ctx.drawImage(bitmap, 0, 0, target.width, target.height);
    const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, target.mime, target.quality));
    if (!encoded) throw new Error('Image encoding failed');
    if (file.type === UPLOAD_MIME && !target.resized && shouldKeepOriginal(file.size, encoded.size)) return file;
    return encoded;
  } finally {
    bitmap.close();
  }
}
