import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/*
 * A minimal TrueType reader for the OG tests: the advance width of each character (cmap format 4 +
 * hmtx), per 1000 units of em. Used to check lib/server/og/metrics.ts against the bundled Nunito
 * files (the card's layout measures with that table) and to print a fresh table when they differ.
 */

const FONT_DIR = join(process.cwd(), 'app/(site)/concursuri/[id]/clasament/imagine/_assets');
export const FONT_FILES = { 600: 'Nunito-SemiBold.ttf', 700: 'Nunito-Bold.ttf', 800: 'Nunito-ExtraBold.ttf' } as const;

export function advanceWidths(weight: keyof typeof FONT_FILES, chars: string): Record<string, number> {
  const buf = readFileSync(join(FONT_DIR, FONT_FILES[weight]));
  const tables = new Map<string, number>();
  const count = buf.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const rec = 12 + i * 16;
    tables.set(buf.toString('latin1', rec, rec + 4), buf.readUInt32BE(rec + 8));
  }
  const head = tables.get('head')!;
  const unitsPerEm = buf.readUInt16BE(head + 18);
  const hhea = tables.get('hhea')!;
  const longMetrics = buf.readUInt16BE(hhea + 34);
  const hmtx = tables.get('hmtx')!;
  const advance = (glyph: number) => buf.readUInt16BE(hmtx + Math.min(glyph, longMetrics - 1) * 4);

  // cmap: the Unicode BMP subtable (format 4).
  const cmap = tables.get('cmap')!;
  const subtables = buf.readUInt16BE(cmap + 2);
  let sub = -1;
  for (let i = 0; i < subtables; i++) {
    const rec = cmap + 4 + i * 8;
    const offset = cmap + buf.readUInt32BE(rec + 4);
    if (buf.readUInt16BE(offset) === 4) {
      sub = offset;
      break;
    }
  }
  if (sub < 0) throw new Error('no cmap format 4');
  const segX2 = buf.readUInt16BE(sub + 6);
  const ends = sub + 14;
  const starts = ends + segX2 + 2;
  const deltas = starts + segX2;
  const ranges = deltas + segX2;
  const glyphOf = (code: number): number => {
    for (let i = 0; i < segX2 / 2; i++) {
      const end = buf.readUInt16BE(ends + i * 2);
      if (code > end) continue;
      const start = buf.readUInt16BE(starts + i * 2);
      if (code < start) return 0;
      const delta = buf.readInt16BE(deltas + i * 2);
      const rangeOffset = buf.readUInt16BE(ranges + i * 2);
      if (rangeOffset === 0) return (code + delta) & 0xffff;
      const g = buf.readUInt16BE(ranges + i * 2 + rangeOffset + (code - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
  const out: Record<string, number> = {};
  for (const ch of chars) out[ch] = Math.round((advance(glyphOf(ch.codePointAt(0)!)) * 1000) / unitsPerEm);
  return out;
}
