import { describe, expect, it } from 'vitest';
import { averageColor, blurDataUrl, decodeBlurhash } from './blurhash';

describe('blurhash', () => {
  // A real DTO hash (local CMS, «Rezervări direct din aplicație» banner).
  const hash = 'L4Bz760002M}?2Ic9jM@0ZIR~qoi';

  it('decodes to the requested number of RGB pixels', () => {
    const px = decodeBlurhash(hash, 8, 6);
    expect(px).not.toBeNull();
    expect(px!.length).toBe(8 * 6 * 3);
  });

  it('encodes a BMP data URL (header + 6 rows of 24 bytes)', () => {
    const url = blurDataUrl(hash)!;
    expect(url.startsWith('data:image/bmp;base64,Qk')).toBe(true);
    const bytes = (url.length - 'data:image/bmp;base64,'.length) * 0.75;
    expect(bytes).toBe(54 + 24 * 6);
  });

  it('gives nothing for a missing or malformed hash', () => {
    expect(blurDataUrl(null)).toBeUndefined();
    expect(blurDataUrl('')).toBeUndefined();
    expect(blurDataUrl('L4Bz76')).toBeUndefined();
    expect(blurDataUrl('L4Bz760002M}?2Ic9jM@0ZIR~qo"')).toBeUndefined();
  });
});

describe('home.stire.c2 — the letterbox ground', () => {
  it('a photo: its average colour; a logo on white: none (the card white stays)', () => {
    expect(averageColor('L4Bz760002M}?2Ic9jM@0ZIR~qoi')).toMatch(/^rgb\(\d+ \d+ \d+\)$/);
    expect(averageColor('LKSF-Kt8~n-:-:fQM|az~mt69IRk')).toBeUndefined();
    expect(averageColor(null)).toBeUndefined();
  });
});
