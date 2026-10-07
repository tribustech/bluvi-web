/*
 * Nunito's advance widths (per 1000 units of em) for the characters the cards print, per weight —
 * read from the bundled static fonts (app/(site)/concursuri/[id]/clasament/imagine/_assets), so the
 * layout (layout.ts) can tell, before Satori draws, how many lines a title takes and whether a
 * podium name fits. Checked against the font files by tests/unit/og-layout.test.ts (which prints a
 * fresh table when a font changes). Kerning is ignored: the measure errs a few px either way, so
 * every decision keeps a margin (MEASURE_SLACK).
 */

export const MEASURED_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ăâîșțĂÂÎȘȚşţŞŢéèáöüóíÉ«»–—…·²„”’\u00a0";

export const ADVANCE: Record<600 | 700 | 800, readonly number[]> = {
  600: [264,237,417,600,600,937,708,231,336,336,452,600,237,429,237,297,600,600,600,600,600,600,600,600,600,600,237,237,600,600,600,450,948,736,682,676,751,589,554,731,767,268,338,643,552,861,743,775,642,775,677,622,611,733,700,1107,660,606,596,333,297,333,600,500,366,537,591,467,591,537,347,594,576,243,246,516,306,866,576,565,591,591,373,484,365,569,520,846,534,520,468,370,275,370,600,537,537,243,484,365,736,736,268,622,611,484,365,622,611,537,537,537,565,569,565,243,589,465,465,500,1000,713,237,380,416,416,237,264],
  700: [271,248,448,600,600,945,726,243,358,358,453,600,248,434,248,313,600,600,600,600,600,600,600,600,600,600,248,248,600,600,600,459,950,744,688,680,762,597,562,736,773,282,354,665,562,868,748,785,652,785,686,631,621,738,713,1113,672,618,605,354,313,354,600,500,377,547,600,472,600,542,364,604,585,255,259,536,319,877,585,576,600,600,392,488,384,579,527,853,546,526,474,391,288,391,600,547,547,255,488,384,744,744,282,631,621,488,384,631,621,542,542,547,576,579,576,255,597,494,494,500,1000,745,248,380,443,443,248,271],
  800: [279,260,481,600,600,954,745,256,382,382,454,600,260,440,260,331,600,600,600,600,600,600,600,600,600,600,260,260,600,600,600,468,952,753,695,684,774,605,570,742,780,297,372,688,573,876,753,796,664,796,696,641,632,743,727,1120,685,631,615,377,331,377,600,500,388,557,610,478,610,549,382,615,595,268,273,558,333,889,595,589,610,610,412,492,404,590,534,861,559,533,480,414,302,414,600,557,557,268,492,404,753,753,297,641,632,492,404,641,632,549,549,557,589,590,589,268,605,525,525,500,1000,780,260,380,472,472,260,279],
};

/** An unknown character (another script, an emoji) is measured wide, so a decision errs on the safe side. */
const FALLBACK = 700;
const INDEX = new Map([...MEASURED_CHARS].map((c, i) => [c, i] as const));

/** The width of `text` in px at `size` px and `weight` (600 for 400 / 600 text, 700, 800). */
export function textWidth(text: string, size: number, weight: number): number {
  const table = ADVANCE[weight >= 800 ? 800 : weight >= 700 ? 700 : 600];
  let units = 0;
  for (const ch of text) {
    const i = INDEX.get(ch);
    units += i == null ? FALLBACK : table[i];
  }
  return (units * size) / 1000;
}
