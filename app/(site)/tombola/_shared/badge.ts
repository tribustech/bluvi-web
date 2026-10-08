/*
 * The prize-type badge in the CMS's own colour (fish ExpandablePrizeRow paints `badgeColor` as is
 * with white text). The CMS value is any CSS colour («blue», «green», «#FFC107»), so white text is
 * not always readable (white on #FFC107 is 1.6:1). The web keeps the colour and picks the text
 * (white or black) with the higher WCAG contrast — the better of the two is ≥ 4.58:1 for any
 * colour, so the label is always AA.
 */

export type Rgb = readonly [number, number, number];

/** #rgb, #rrggbb (alpha ignored), rgb()/rgba() with commas or spaces. null for anything else (names). */
export function parseCssColor(value: string): Rgb | null {
  const v = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(v)?.[1];
  if (hex) {
    if (hex.length === 3 || hex.length === 4) {
      return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16)) as unknown as Rgb;
    }
    if (hex.length === 6 || hex.length === 8) {
      return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
    }
    return null;
  }
  const fn = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/.exec(v);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  return null;
}

/** sRGB relative luminance (WCAG 2.x). */
export function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: Rgb = [255, 255, 255];
/** Black, not the kit's ink: only pure black keeps the worst case (mid grey) at ≥ 4.58:1. */
const INK: Rgb = [0, 0, 0];

/** The badge label colour on `bg`: white unless black reads better. */
export function badgeTextOn(bg: Rgb): string {
  const fg = contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK;
  return `rgb(${fg[0]} ${fg[1]} ${fg[2]})`;
}

const resolved = new Map<string, Rgb | null>();

/**
 * Any CSS colour → RGB. Named colours need the browser: a canvas normalises `fillStyle` to hex.
 * null on the server, for an invalid value, or a transparent one.
 */
export function resolveCssColor(value: string | null | undefined): Rgb | null {
  if (!value?.trim()) return null;
  const direct = parseCssColor(value);
  if (direct) return direct;
  if (typeof document === 'undefined') return null;
  if (resolved.has(value)) return resolved.get(value) ?? null;
  let out: Rgb | null = null;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      // An invalid colour leaves fillStyle unchanged: probe from two different starting values.
      ctx.fillStyle = '#010203';
      ctx.fillStyle = value;
      const a = String(ctx.fillStyle);
      ctx.fillStyle = '#030201';
      ctx.fillStyle = value;
      const b = String(ctx.fillStyle);
      if (a === b && !/rgba\([^)]*,\s*0\)$/.test(a)) out = parseCssColor(a);
    }
  } catch {
    out = null;
  }
  resolved.set(value, out);
  return out;
}
