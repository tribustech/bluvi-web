import { uploadImageTarget } from '@/core/social';

/**
 * The generated avatar (fish helpers/buildAvatarUrl.ts): a DiceBear «personas» SVG URL from a seed,
 * same options as fish so a web-made avatar looks like an app-made one. Previews are plain <img>
 * (api.dicebear.com is not in next/image remotePatterns, on purpose); the upload is the SVG
 * rasterised to JPEG (rasteriseGeneratedAvatar) — the CMS stores a jpg like every other avatar.
 */
const AVATAR_CONFIG = {
  hair: ['beanie', 'buzzcut', 'cap', 'curlyHighTop', 'fade', 'mohawk', 'shortCombover'],
  mood: ['superHappy', 'happy'],
  body: ['squared'],
  skinColor: ['ffd6c0'],
  facialHairProbability: 25,
  mouth: ['smile', 'bigSmile', 'smirk'],
  nose: ['smallRound'],
  backgroundColor: [
    '93c5fd',
    '60a5fa',
    '3b82f6',
    '2563eb',
    'fcd34d',
    'f97316',
    '84cc16',
    '22c55e',
    '14b8a6',
    '06b6d4',
    '6366f1',
    '8b5cf6',
    'a855f7',
    'd946ef',
    'ec4899',
    'f43f5e',
  ],
  radius: [15],
} as const;

export const DICEBEAR_PERSONAS = 'https://api.dicebear.com/9.x/personas/svg';

/** fish buildAvatarUrl(seed). */
export function buildAvatarUrl(seed: number): string {
  const params = new URLSearchParams({
    seed: seed.toString(),
    ...Object.fromEntries(Object.entries(AVATAR_CONFIG).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)])),
  });
  return `${DICEBEAR_PERSONAS}?${params.toString()}`;
}

/** fish `buildAvatarUrl(Math.random())`: a new random generated avatar. */
export const randomAvatarUrl = () => buildAvatarUrl(Math.random());

/** The SVG is vector: drawn at this size (under the upload cap, so uploadImageTarget keeps it). */
const GENERATED_SIZE_PX = 512;

/**
 * The generated avatar as a JPEG Blob for the upload. DiceBear answers with
 * `access-control-allow-origin: *`, so the image is loaded with CORS and the canvas stays
 * exportable. The SVG's rounded corners are transparent: the canvas is filled white first (JPEG has
 * no alpha; the avatar is always shown in a circle, so the corners never show).
 */
export async function rasteriseGeneratedAvatar(url: string): Promise<Blob> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const target = uploadImageTarget({ width: GENERATED_SIZE_PX, height: GENERATED_SIZE_PX });
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(img, 0, 0, target.width, target.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, target.mime, target.quality));
  if (!blob) throw new Error('Image encoding failed');
  return blob;
}
