import { describe, expect, it } from 'vitest';
import { fillsFrame, ratioOf, readImageSize, stripRatio } from './imageSize';

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >> 8) & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

describe('home.stire.c2 home.sponsor.c2 — a picture size from the head of its file', () => {
  it('PNG (IHDR)', () => {
    expect(readImageSize(bytes([0x89], 'PNG\r\n\x1a\n', be32(13), 'IHDR', be32(750), be32(133), [8, 6, 0, 0, 0]))).toEqual({ width: 750, height: 133 });
  });

  it('JPEG: skips APPn segments to the SOF', () => {
    const app0 = [0xff, 0xe0, ...be16(16), ...new Array(14).fill(0)];
    const sof = [0xff, 0xc0, ...be16(17), 8, ...be16(1080), ...be16(1920), 3, ...new Array(9).fill(0)];
    expect(readImageSize(bytes([0xff, 0xd8], app0, sof))).toEqual({ width: 1920, height: 1080 });
  });

  it('WebP (VP8X, VP8L, VP8)', () => {
    const vp8x = bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8X', [10, 0, 0, 0], [0, 0, 0, 0], le24(1199), le24(799));
    expect(readImageSize(vp8x)).toEqual({ width: 1200, height: 800 });
    const bits = (400 - 1) | ((300 - 1) << 14);
    const vp8l = bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8L', [0, 0, 0, 0], [0x2f], [bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]);
    expect(readImageSize(vp8l)).toEqual({ width: 400, height: 300 });
    const vp8 = bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8 ', [0, 0, 0, 0], [0, 0, 0, 0x9d, 0x01, 0x2a], le16(640), le16(480));
    expect(readImageSize(vp8)).toEqual({ width: 640, height: 480 });
  });

  it('GIF; anything else (or too short) is unknown', () => {
    expect(readImageSize(bytes('GIF89a', le16(32), le16(16), new Array(8).fill(0)))).toEqual({ width: 32, height: 16 });
    expect(readImageSize(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(readImageSize(new Uint8Array(4))).toBeNull();
  });

  it('the article strip: the picture ratio clamped to 4:3 … 4:1, 16:9 when unknown', () => {
    expect(stripRatio(ratioOf({ width: 750, height: 133 }))).toBe(4);
    expect(stripRatio(3)).toBe(3);
    expect(stripRatio(ratioOf({ width: 500, height: 500 }))).toBeCloseTo(4 / 3);
    expect(stripRatio(1.6)).toBe(1.6);
    expect(stripRatio(ratioOf({}))).toBeCloseTo(16 / 9);
  });

  it('sponsor artwork fills its frame from 4:3 to 2:1 only (Acasă tile rule)', () => {
    expect(fillsFrame(1.6)).toBe(true);
    expect(fillsFrame(1)).toBe(false);
    expect(fillsFrame(5.6)).toBe(false);
    expect(fillsFrame(null)).toBe(false);
  });
});
