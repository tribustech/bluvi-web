/*
 * The Open Graph cards' colours, type steps and radii, read from the design tokens (app/globals.css).
 * The cards are drawn by Satori (next/og), which cannot resolve CSS custom properties, so the light
 * palette's values and the t-* steps are read from the stylesheet itself — the tokens stay the only
 * source of visual values (ROADMAP §1.4, §5 «Lint»), as the ranking image does
 * (app/(site)/concursuri/[id]/clasament/imagine/png/tokens.ts). `parseOgTokens` is pure
 * (unit-tested against the real stylesheet); fonts.ts reads the file.
 *
 * A card is 1200×630: twice a 600×315 layout. Every length is a token at OG_SCALE (the radii, the
 * spacing), so `s()` is the one place a 1× length becomes a pixel. Type is drawn larger: a chat
 * preview shows the card ~300–340 px wide (÷3.5), so the phone-first steps at 2× would read ~7 px.
 * The title steps stay at 2×; every secondary step (facts, units, pills, eyebrow) is drawn at
 * OG_TEXT_SCALE and never under OG_MIN_TEXT on the canvas (unit-tested for every step).
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_SCALE = 2;
/** A 1× length at the card's scale. */
export const s = (n: number) => Math.round(n * OG_SCALE * 100) / 100;

/** The --bluvi-* colours the cards draw with (light theme: a shared link has no theme). */
const COLORS = {
  page: 'page',
  surface: 'surface',
  softFill: 'soft-fill',
  hairline: 'hairline',
  ink: 'ink',
  ink2: 'ink-2',
  muted: 'muted',
  navy: 'navy',
  lavender: 'lavender',
  accent: 'accent',
  accentInk: 'accent-ink',
  accentTint: 'accent-tint',
  accentTint2: 'accent-tint-2',
  onAccent: 'on-accent',
  rating: 'rating',
  liveBg: 'status-live-bg',
  liveFg: 'status-live-fg',
  infoBg: 'status-info-bg',
  infoFg: 'status-info-fg',
  neutralBg: 'status-neutral-bg',
  neutralFg: 'status-neutral-fg',
  medalGold: 'medal-gold',
  medalSilver: 'medal-silver',
  medalBronze: 'medal-bronze',
  onMedal: 'on-medal',
  bentoIndigo: 'bento-indigo',
  bentoIndigo2: 'bento-indigo-2',
  onBentoIndigo: 'on-bento-indigo',
  onBentoIndigo2: 'on-bento-indigo-2',
  bentoLavender: 'bento-lavender',
  bentoLavender2: 'bento-lavender-2',
  onBentoLavender: 'on-bento-lavender',
} as const;

export type OgColor = keyof typeof COLORS;

/** The t-* steps the cards use. */
export const OG_TYPE_STEPS = ['hero', 'display', 'stat', 'title1', 'title2', 'heading', 'body', 'body-strong', 'label', 'caption'] as const;
export type OgTypeStep = (typeof OG_TYPE_STEPS)[number];
/** A type step at 1× (px). */
export type OgType = { size: number; lineHeight: number; weight: number };

const RADII = ['control', 'avatar', 'card', 'bento'] as const;
export type OgRadius = (typeof RADII)[number];

export type OgTokens = {
  color: Record<OgColor, string>;
  type: Record<OgTypeStep, OgType>;
  radius: Record<OgRadius, number>;
};

const FONT = /^(\d{3})\s+([\d.]+)px\/([\d.]+)px\b/;

/** Reads the light theme (`:root`, the first block), the t-* steps' base (phone-first) values and the radii. */
export function parseOgTokens(css: string): OgTokens {
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const color = {} as OgTokens['color'];
  for (const [key, name] of Object.entries(COLORS) as [OgColor, string][]) {
    const v = new RegExp(`--bluvi-${name}:\\s*([^;]+);`).exec(root)?.[1]?.trim();
    if (!v) throw new Error(`globals.css: --bluvi-${name} not found`);
    color[key] = v;
  }
  const type = {} as OgTokens['type'];
  for (const step of OG_TYPE_STEPS) {
    // The first declaration is the phone-first one (before the 1280 media query).
    const font = new RegExp(`--t-${step}:\\s*([^;]+);`).exec(css)?.[1]?.trim() ?? '';
    const m = FONT.exec(font);
    if (!m) throw new Error(`globals.css: --t-${step} has no «weight size/line-height» font`);
    type[step] = { weight: Number(m[1]), size: Number(m[2]), lineHeight: Number(m[3]) };
  }
  const radius = {} as OgTokens['radius'];
  for (const r of RADII) {
    const v = new RegExp(`--radius-${r}:\\s*([\\d.]+)px;`).exec(css)?.[1];
    if (!v) throw new Error(`globals.css: --radius-${r} not found`);
    radius[r] = Number(v);
  }
  return { color, type, radius };
}

/** The secondary steps' scale on the card (vs OG_SCALE for the titles). */
export const OG_TEXT_SCALE = 2.5;
/** No text on the card is smaller than this (canvas px): ~9 px in a 340 px wide chat preview. */
export const OG_MIN_TEXT = 30;
const TITLE_STEPS: ReadonlySet<OgTypeStep> = new Set(['hero', 'display', 'title1', 'title2']);

/** A type step as Satori style, at the card's scale (titles at 2×, the rest larger, ≥ OG_MIN_TEXT). */
export function textStyle(t: OgTokens, step: OgTypeStep) {
  const v = t.type[step];
  const k = TITLE_STEPS.has(step) ? OG_SCALE : OG_TEXT_SCALE;
  let size = v.size * k;
  let line = v.lineHeight * k;
  if (size < OG_MIN_TEXT) {
    line = (line * OG_MIN_TEXT) / size;
    size = OG_MIN_TEXT;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { fontSize: r(size), lineHeight: `${r(line)}px`, fontWeight: v.weight as 400 | 600 | 700 | 800 };
}

/** «#4338ca» at `alpha` → «rgba(67, 56, 202, 0.4)». */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, c => c + c) : h.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
