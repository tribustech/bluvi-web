/*
 * Blurhash → a tiny image data URL for next/image `placeholder="blur"` (fish shows every news and
 * sponsor photo over its DTO blurhash, expo-image `placeholder`). Pure: no canvas, no Buffer, no
 * btoa, so it runs the same on the server and in the browser. The decoded 8×6 bitmap is written as
 * a 24-bit BMP; next/image blurs and stretches it under the photo.
 * Shared by every photo with a DTO blurhash (news, sponsors, lakes, competition posters, the
 * kit CardPhoto's `blurDataURL`).
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

function decode83(s: string): number {
  let v = 0;
  for (const c of s) {
    const d = DIGITS.indexOf(c);
    if (d < 0) throw new Error('blurhash: bad digit');
    v = v * 83 + d;
  }
  return v;
}

const toLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const toSrgb = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return Math.round(x <= 0.0031308 ? x * 12.92 * 255 : (1.055 * x ** (1 / 2.4) - 0.055) * 255);
};
const signPow = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

/** RGB pixels (row-major, top-down) of a blurhash, or null when the hash is malformed. */
export function decodeBlurhash(hash: string, width: number, height: number): Uint8Array | null {
  if (!hash || hash.length < 6) return null;
  try {
    const size = decode83(hash[0]);
    const ny = Math.floor(size / 9) + 1;
    const nx = (size % 9) + 1;
    if (hash.length !== 4 + 2 * nx * ny) return null;
    const max = (decode83(hash[1]) + 1) / 166;
    const colors: [number, number, number][] = [];
    for (let i = 0; i < nx * ny; i++) {
      if (i === 0) {
        const v = decode83(hash.substring(2, 6));
        colors.push([toLinear(v >> 16), toLinear((v >> 8) & 255), toLinear(v & 255)]);
      } else {
        const v = decode83(hash.substring(4 + i * 2, 6 + i * 2));
        colors.push([
          signPow((Math.floor(v / 361) - 9) / 9, 2) * max,
          signPow(((Math.floor(v / 19) % 19) - 9) / 9, 2) * max,
          signPow(((v % 19) - 9) / 9, 2) * max,
        ]);
      }
    }
    const out = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let j = 0; j < ny; j++) {
          for (let i = 0; i < nx; i++) {
            const basis = Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height);
            const c = colors[i + j * nx];
            r += c[0] * basis;
            g += c[1] * basis;
            b += c[2] * basis;
          }
        }
        const o = (y * width + x) * 3;
        out[o] = toSrgb(r);
        out[o + 1] = toSrgb(g);
        out[o + 2] = toSrgb(b);
      }
    }
    return out;
  } catch {
    return null;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    s += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    s += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return s;
}

/** A 24-bit BMP (bottom-up rows, 4-byte aligned) of top-down RGB pixels. */
function bmp(rgb: Uint8Array, width: number, height: number): Uint8Array {
  const row = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + row * height;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  buf[0] = 0x42;
  buf[1] = 0x4d;
  view.setUint32(2, size, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, row * height, true);
  for (let y = 0; y < height; y++) {
    const dst = 54 + (height - 1 - y) * row;
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 3;
      buf[dst + x * 3] = rgb[src + 2];
      buf[dst + x * 3 + 1] = rgb[src + 1];
      buf[dst + x * 3 + 2] = rgb[src];
    }
  }
  return buf;
}

/**
 * The picture's average colour (the blurhash DC component, already sRGB) as `rgb(r g b)`, or
 * undefined (no / bad hash, or a near-white average): the flat ground a contained picture sits on, so a letterbox takes the
 * picture's own tone instead of a blur of a white logo.
 */
export function averageColor(hash: string | null | undefined): string | undefined {
  if (!hash || hash.length < 6) return undefined;
  try {
    const v = decode83(hash.substring(2, 6));
    const [r, g, b] = [v >> 16, (v >> 8) & 255, v & 255];
    // A near-white average (a logo or screenshot on white) would only be a grey that melts into the
    // page around the card: the caller keeps the card's own white instead.
    if (Math.min(r, g, b) >= NEAR_WHITE) return undefined;
    return `rgb(${r} ${g} ${b})`;
  } catch {
    return undefined;
  }
}

const NEAR_WHITE = 232;

/** `data:image/bmp;base64,…` for next/image `blurDataURL`, or undefined (no / bad hash). */
export function blurDataUrl(hash: string | null | undefined, width = 8, height = 6): string | undefined {
  if (!hash) return undefined;
  const px = decodeBlurhash(hash, width, height);
  return px ? `data:image/bmp;base64,${base64(bmp(px, width, height))}` : undefined;
}
