/*
 * The pixel size of a picture from the first bytes of its file (PNG, JPEG, WebP, GIF) — pure, no
 * I/O. The CMS's feed DTOs carry a banner's / sponsor logo's URL but not its size, and the
 * article's header strip and the sponsor's band are sized from the picture itself (so a 750×133
 * banner is not boxed in 16:9 and a logo is never cropped). The server reads the head of the file
 * once per URL (probe.ts) and the page lands with the right box: nothing moves when it loads.
 */

export type ImageSize = { width: number; height: number };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

const ok = (width: number, height: number): ImageSize | null => (width > 0 && height > 0 ? { width, height } : null);

/** JPEG start-of-frame markers (SOF0–SOF15 less DHT C4, JPG C8, DAC CC). */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpeg(b: Uint8Array): ImageSize | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    // Standalone markers (RSTn, TEM) carry no length.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    if (SOF.has(marker)) return ok(u16be(b, i + 7), u16be(b, i + 5));
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function webp(b: Uint8Array): ImageSize | null {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8 ' && b.length >= 30) return ok(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  if (chunk === 'VP8L' && b.length >= 25) {
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return ok((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  if (chunk === 'VP8X' && b.length >= 30) return ok(u24le(b, 24) + 1, u24le(b, 27) + 1);
  return null;
}

/** The size, or null for a format it does not read / a head too short to hold it. */
export function readImageSize(b: Uint8Array): ImageSize | null {
  if (b.length < 16) return null;
  // PNG: the signature, then IHDR (width, height big-endian at 16 / 20).
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return b.length >= 24 ? ok(u32be(b, 16), u32be(b, 20)) : null;
  if (b[0] === 0xff && b[1] === 0xd8) return jpeg(b);
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return webp(b);
  if (ascii(b, 0, 4) === 'GIF8') return ok(u16le(b, 6), u16le(b, 8));
  return null;
}

/** The width / height ratio, or null without a size. */
export function ratioOf(size: { width?: number; height?: number } | null | undefined): number | null {
  return size?.width && size.height ? size.width / size.height : null;
}

/**
 * Landscape artwork from 4:3 to 2:1 fills its frame (a few px of crop on a banner are fine) — the
 * rule of Acasă's sponsor tiles; a square or tall logo, or a very wide strip, is contained.
 */
export const FILL_MIN = 4 / 3;
export const FILL_MAX = 2;

export function fillsFrame(ratio: number | null): boolean {
  return ratio !== null && ratio >= FILL_MIN && ratio <= FILL_MAX;
}

/** Wider than this, a banner is shown whole on the phone too (a cover crop would cut its text). */
export const WIDE_RATIO = 2;

/**
 * The article strip's ratio: the first picture's own ratio, clamped to 4:3 … 4:1 so a portrait
 * photo never makes a tower and the strip hugs a wide banner instead of padding it with letterbox
 * (hero.ts keeps it at least 240 high from 768, 200 on the phone). No size known: 16:9.
 */
export function stripRatio(ratio: number | null): number {
  if (ratio === null) return 16 / 9;
  return Math.min(4, Math.max(4 / 3, ratio));
}
