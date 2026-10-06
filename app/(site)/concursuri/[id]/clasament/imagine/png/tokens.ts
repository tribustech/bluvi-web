/*
 * The image's colours, type steps and badge radius, read from the design tokens (app/globals.css) —
 * the PNG is drawn by Satori, which cannot resolve CSS custom properties, so the route reads the
 * light palette's values and the t-* steps (their base, phone-first sizes) from the stylesheet
 * itself: the tokens stay the only source of visual values (ROADMAP §1.4, §5 «Lint»). The sheet
 * draws them at SCALE× like every other 1× size. `parseTokens` is pure (unit-tested against the
 * real stylesheet); png/route.tsx reads the file.
 */

/** The t-* steps the sheet uses (globals.css `--t-<step>` or a fixed `@utility t-<step>`). */
export const TYPE_STEPS = [
  'count',
  'page-title',
  'display',
  'stat',
  'title1',
  'heading',
  'table',
  'body-strong',
  'control',
  'label',
  'caption',
  'eyebrow',
  'nano',
] as const;
export type TypeStep = (typeof TYPE_STEPS)[number];
/** A type step at 1× (px): size, line height, weight and its letter spacing (0 when it has none). */
export type TypeToken = { size: number; lineHeight: number; weight: number; letterSpacing: number };

export type ImageTokens = {
  surface: string;
  page: string;
  softFill: string;
  hairline: string;
  shimmer: string;
  handle: string;
  ink: string;
  ink2: string;
  muted: string;
  faint: string;
  accent: string;
  accentInk: string;
  accentTint: string;
  accentTint2: string;
  accentTint3: string;
  onAccent: string;
  success: string;
  rating: string;
  indigo4: string;
  /** --color-sector-a … x, by upper-case letter. */
  sectors: Record<string, string>;
  type: Record<TypeStep, TypeToken>;
  /** --radius-badge (px at 1×). */
  radiusBadge: number;
};

const SEMANTIC: Record<Exclude<keyof ImageTokens, 'sectors' | 'indigo4' | 'type' | 'radiusBadge'>, string> = {
  surface: 'surface',
  page: 'page',
  softFill: 'soft-fill',
  hairline: 'hairline',
  shimmer: 'shimmer',
  handle: 'handle',
  ink: 'ink',
  ink2: 'ink-2',
  muted: 'muted',
  faint: 'faint',
  accent: 'accent',
  accentInk: 'accent-ink',
  accentTint: 'accent-tint',
  accentTint2: 'accent-tint-2',
  accentTint3: 'accent-tint-3',
  onAccent: 'on-accent',
  success: 'success',
  rating: 'rating',
};

/** Reads the light theme (`:root`, the first block) and the fixed ramps (sectors, indigo-4). */
export function parseTokens(css: string): ImageTokens {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const value = (block: string, name: string): string | undefined =>
    new RegExp(`--${name}:\\s*([^;]+);`).exec(block)?.[1]?.trim();
  const out = {} as ImageTokens;
  for (const [key, name] of Object.entries(SEMANTIC) as [keyof typeof SEMANTIC, string][]) {
    const v = value(root, `bluvi-${name}`);
    if (!v) throw new Error(`globals.css: --bluvi-${name} not found`);
    out[key] = v;
  }
  const indigo4 = value(css, 'color-indigo-4');
  if (!indigo4) throw new Error('globals.css: --color-indigo-4 not found');
  out.indigo4 = indigo4;
  out.sectors = {};
  for (const m of css.matchAll(/--color-sector-([a-x]):\s*([^;]+);/g)) out.sectors[m[1].toUpperCase()] = m[2].trim();
  out.type = {} as ImageTokens['type'];
  for (const step of TYPE_STEPS) out.type[step] = typeStep(css, step);
  const radius = /--radius-badge:\s*([\d.]+)px;/.exec(css)?.[1];
  if (!radius) throw new Error('globals.css: --radius-badge not found');
  out.radiusBadge = Number(radius);
  return out;
}

const FONT = /^(\d{3})\s+([\d.]+)px\/([\d.]+)px\b/;

/**
 * A step's base values: `--t-<step>` (its first declaration, the phone-first one, before the 1280
 * media query) or the font of a fixed `@utility t-<step>`; the letter spacing is the utility's
 * (a `var(--t-<step>-ls)` resolved the same way).
 */
function typeStep(css: string, step: TypeStep): TypeToken {
  const utility = new RegExp(`@utility t-${step} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
  const variable = new RegExp(`--t-${step}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
  const font = variable ?? /font:\s*([^;]+);/.exec(utility)?.[1]?.trim() ?? '';
  const m = FONT.exec(font);
  if (!m) throw new Error(`globals.css: t-${step} has no «weight size/line-height» font`);
  let ls = /letter-spacing:\s*([^;]+);/.exec(utility)?.[1]?.trim() ?? '0px';
  const ref = /^var\(--([\w-]+)\)$/.exec(ls);
  if (ref) ls = new RegExp(`--${ref[1]}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? '0px';
  return { weight: Number(m[1]), size: Number(m[2]), lineHeight: Number(m[3]), letterSpacing: parseFloat(ls) || 0 };
}

/** «#1976d2» at `alpha` → «rgba(25, 118, 210, 0.4)» (fish hexColorToRgbWithOpacity). */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, c => c + c) : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, c => c + c) : h.slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG 2 relative luminance of an sRGB colour (0 black … 1 white). */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** `fill` at `alpha` over the opaque `ground`: the colour the reader actually sees. */
function composite(fill: string, alpha: number, ground: string): [number, number, number] {
  const f = channels(fill);
  const g = channels(ground);
  return [0, 1, 2].map(i => Math.round(f[i] * alpha + g[i] * (1 - alpha))) as [number, number, number];
}

/** WCAG contrast ratio between text `ink` and `fill` at `alpha` over `ground` (1 … 21). */
export function contrastOn(ink: string, fill: string, alpha: number, ground: string): number {
  const a = luminance(channels(ink));
  const b = luminance(composite(fill, alpha, ground));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * The text colour for a tinted cell (a winner's sector fill): `light` (the white on-accent) when
 * it reaches AA for small text (4.5:1) on `fill` at `alpha` over `ground`, else whichever of the two
 * reads better (the ink on the orange / green sectors) — the image is printed and shared.
 */
export function inkOn(fill: string, alpha: number, ground: string, light: string, dark: string): string {
  const onLight = contrastOn(light, fill, alpha, ground);
  if (onLight >= 4.5) return light;
  return contrastOn(dark, fill, alpha, ground) > onLight ? dark : light;
}
