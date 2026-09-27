/**
 * Upload constraints from fish, for the web's in-browser compression (no DOM here — the caller does
 * the canvas work with these numbers).
 *
 * fish re-encodes every photo it uploads with `react-native-compressor`'s "auto" mode
 * (`hooks/useCamera.ts`, `features/chat/media/compressChatPhoto.ts`): WhatsApp-like — long edge
 * capped at 1280 px, JPEG 0.8, and the ORIGINAL kept when the re-encode would not be smaller. A
 * full-resolution camera photo once blew the 45 s request timeout (upload + Strapi generating four
 * formats + S3), which is why the cap exists.
 */
export const UPLOAD_MAX_LONG_EDGE_PX = 1280;
export const UPLOAD_JPEG_QUALITY = 0.8;
export const UPLOAD_MIME = 'image/jpeg';

export type UploadImageTarget = { width: number; height: number; quality: number; mime: typeof UPLOAD_MIME; resized: boolean };

/** Target size for a source image: scaled down (never up) so the long edge fits the cap, aspect kept. */
export function uploadImageTarget(source: { width: number; height: number }): UploadImageTarget {
  const { width, height } = source;
  const longEdge = Math.max(width, height);
  if (!(longEdge > UPLOAD_MAX_LONG_EDGE_PX)) {
    return { width, height, quality: UPLOAD_JPEG_QUALITY, mime: UPLOAD_MIME, resized: false };
  }
  const scale = UPLOAD_MAX_LONG_EDGE_PX / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    quality: UPLOAD_JPEG_QUALITY,
    mime: UPLOAD_MIME,
    resized: true,
  };
}

/** "auto" mode: keep the original bytes when the re-encode is not smaller. */
export function shouldKeepOriginal(originalBytes: number, encodedBytes: number): boolean {
  return encodedBytes >= originalBytes;
}

/** `photo.png` → `photo.jpg` (the re-encode is always JPEG). */
export function toJpegFilename(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base || 'image'}.jpg`;
}

/** fish `components/EditProfileScreen.tsx` names the avatar upload `profile_id_<id>_<ms>.jpg`. */
export function profilePictureFilename(profileId: number, now: number): string {
  return `profile_id_${profileId}_${now}.jpg`;
}
