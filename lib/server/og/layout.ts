import type { EntityCard, Figure, MetaLine, PodiumLine } from './model';
import { textWidth } from './metrics';
import { OG_SIZE, s, textStyle, type OgTokens, type OgTypeStep } from './tokens';

/*
 * The entity card's geometry, decided before Satori draws (cards.tsx draws it, model.ts entityAlt
 * reads it so the alt names only the facts drawn). Pure: the card's words + the tokens in, the
 * column widths, the title's step and lines, the meta lines that fit and the podium's rows out.
 *
 *  - Width: the picture panel is MEDIA_W; with a podium a photo yields to the names
 *    (PODIUM_MEDIA_W); with no picture the brand panel is a narrow band (BAND_W) and the facts take
 *    the width — the facts column's left edge, logo, eyebrow and title lines are the same either way.
 *  - Height: the facts are fitted to the space left over (not to a row count), by priority: the
 *    title whole (≤ 2 lines), then the lake and the dates (two lines, else one «Lac · 10–11 oct.
 *    2026» line), then the «la egalitate» legend; spacing tightens before a fact is dropped.
 * Text is measured with Nunito's advance widths (metrics.ts) plus MEASURE_SLACK.
 */

export const MEDIA_W = 520;
/** A podium card's photo: narrower, so team names (often two anglers) are read whole. */
export const PODIUM_MEDIA_W = 380;
/** No picture: the brand band (gradient + fish) beside the facts. */
export const BAND_W = 220;
export const PAD = s(28);
export const LOGO_H = s(16);
export const LOGO_GAP = s(10);
/** Kerning and rounding: a measured line is taken this much wider than the table says. */
export const MEASURE_SLACK = 1.04;

const H = OG_SIZE.height;

/** Within this of the panel's aspect a picture is cropped, never drawn whole on its blurred copy. */
export const NEAR_PANEL = 0.15;

/** Whether a `w`×`h` picture is drawn whole in a `panelW`×630 panel (PictureFit). */
export function drawnWhole(fit: 'cover' | 'whole' | 'auto', w: number, h: number, panelW: number = MEDIA_W): boolean {
  if (fit === 'cover' || !w || !h) return false;
  const ratio = w / h / (panelW / OG_SIZE.height);
  const near = Math.abs(ratio - 1) <= NEAR_PANEL;
  if (fit === 'whole') return !near;
  return ratio > 1 + NEAR_PANEL;
}

/** The picture panel's width for this card. */
export function mediaWidth(card: Pick<EntityCard, 'media' | 'podium'>): number {
  if (card.media.kind === 'brand') return BAND_W;
  return card.media.kind === 'photo' && card.podium.length ? PODIUM_MEDIA_W : MEDIA_W;
}

/** The facts column's inner width (its padding off). */
export const factsWidth = (card: Pick<EntityCard, 'media' | 'podium'>) => OG_SIZE.width - mediaWidth(card) - 2 * PAD;

const lh = (t: OgTokens, step: OgTypeStep) => parseFloat(textStyle(t, step).lineHeight);

/** `text`'s width at a type step, with the slack. */
export function measure(t: OgTokens, text: string, step: OgTypeStep): number {
  const st = textStyle(t, step);
  return textWidth(text, st.fontSize, st.fontWeight) * MEASURE_SLACK;
}

/** How many lines `text` takes at `step` in `width` (greedy at the spaces; a no-break space binds). */
export function lineCount(t: OgTokens, text: string, step: OgTypeStep, width: number): number {
  const space = measure(t, ' ', step);
  let lines = 1;
  let x = 0;
  for (const word of text.split(' ').filter(Boolean)) {
    const w = measure(t, word, step);
    if (x === 0) x = w;
    else if (x + space + w <= width) x += space + w;
    else {
      lines++;
      x = w;
    }
    while (x > width) {
      lines++;
      x -= width;
    }
  }
  return lines;
}

/** The title's step: «hero» only when the name fits two hero lines at the column's measure. */
export function titleStep(t: OgTokens, title: string, width: number): 'hero' | 'display' {
  return lineCount(t, title, 'hero', width) <= 2 ? 'hero' : 'display';
}

/* ---------------------------------------------------------------- podium geometry */

/** Three places at full height; four, then five or six on more compact rows. */
export const podiumRowHeight = (rows: number) => (rows <= 3 ? s(28) : rows === 4 ? s(24) : s(22));
export const PODIUM_PAD_Y = s(4);
export const PODIUM_PAD_X = s(10);
export const PODIUM_GAP = s(7);
/** The place badge's slot: wider when a place is shared («=1»). */
export const placeSlot = (lines: PodiumLine[]) => (lines.some(l => l.tied) ? s(26) : s(20));
export const LEGEND_GAP = s(3);

/** The figure's drawn width («52,8» + «kg»). */
export function figureWidth(t: OgTokens, figure: Figure): number {
  return measure(t, figure.value, 'heading') + (figure.unit ? s(3) + measure(t, figure.unit, 'caption') : 0);
}

/** The width a podium name has on its row (the row less the badge, the figure and the gaps). */
export function podiumNameRoom(t: OgTokens, card: Pick<EntityCard, 'media' | 'podium'>, line: PodiumLine): number {
  return factsWidth(card) - 2 * PODIUM_PAD_X - placeSlot(card.podium) - 2 * PODIUM_GAP - figureWidth(t, line.figure);
}

/* ---------------------------------------------------------------- the layout */

export type Spacing = { padTop: number; gap: number };
const SPACINGS: Spacing[] = [
  { padTop: s(6), gap: s(8) },
  { padTop: 0, gap: s(8) },
  { padTop: 0, gap: s(6) },
];

export type EntityLayout = {
  mediaW: number;
  titleStep: 'hero' | 'display';
  titleLines: number;
  /**
   * The title wraps over 2+ lines and is drawn whole: its lines are balanced (cards.tsx textWrap).
   * Not when clamped — Satori balances the whole text before the clamp, which would cut it early.
   */
  balance: boolean;
  /** The meta lines drawn (a combined «Lac · date» line carries the date as `tail`). */
  meta: MetaLine[];
  /** Figures or a podium at the bottom; else the facts are centred. */
  bottom: boolean;
  spacing: Spacing;
  /** The «= la egalitate» legend under the podium (a shared place's badge reads «=1»). */
  legend: boolean;
};

/** The meta lines in a mode: both, one combined («Lac · 10–11 oct. 2026»), or none. */
function metaIn(card: EntityCard, mode: 'all' | 'combined' | 'none'): MetaLine[] {
  if (mode === 'none' || !card.meta.length) return [];
  const all = card.meta.slice(0, 2);
  if (mode === 'all' || all.length < 2) return all;
  const date = all.find(m => m.icon === 'calendar');
  const place = all.find(m => m.icon !== 'calendar');
  if (!date || !place) return all.slice(0, 1);
  return [{ icon: place.icon, text: place.text, tail: date.short ?? date.text }];
}

export function entityLayout(t: OgTokens, card: EntityCard): EntityLayout {
  const mediaW = mediaWidth(card);
  const width = factsWidth(card);
  const rows = card.podium.length;
  const blocks = (card.rating ? 1 : 0) + (card.price ? 1 : 0);
  const bottom = rows > 0 || blocks > 0;
  const step = rows ? 'display' : titleStep(t, card.title, width);
  const needed = lineCount(t, card.title, step, width);

  if (!bottom) {
    // Nothing at the bottom: the facts centred, room for three title lines and both meta lines.
    const titleLines = Math.min(3, needed);
    return { mediaW, titleStep: step, titleLines, balance: needed > 1 && needed <= titleLines, meta: metaIn(card, 'all'), bottom, spacing: SPACINGS[0], legend: false };
  }

  const room = H - 2 * PAD - LOGO_H - LOGO_GAP;
  const eyebrowH = card.pill ? lh(t, 'label') + 2 * s(3) : lh(t, 'label');
  const tie = card.podium.some(l => l.tied);
  const podiumH = (legend: boolean) =>
    rows ? rows * podiumRowHeight(rows) + 2 * PODIUM_PAD_Y + (legend ? LEGEND_GAP + lh(t, 'caption') : 0) : blocks * lh(t, 'stat') + (blocks - 1) * s(4);
  const metaH = (n: number) => (n ? n * lh(t, 'body') + (n - 1) * s(2) : 0);
  const fits = (titleLines: number, meta: MetaLine[], legend: boolean, sp: Spacing) =>
    sp.padTop + eyebrowH + sp.gap + titleLines * lh(t, step) + (meta.length ? sp.gap + metaH(meta.length) : 0) + sp.gap + podiumH(legend) <= room;

  const full = Math.min(2, needed);
  // By priority: the title whole, then the lake and the dates (one line if need be), then the tie
  // legend — each spacing tried before a fact is given up.
  const tries: [number, 'all' | 'combined' | 'none', boolean][] = [
    [full, 'all', tie],
    [full, 'combined', tie],
    [full, 'combined', false],
    [1, 'all', tie],
    [1, 'combined', tie],
    [1, 'combined', false],
    [1, 'none', tie],
    [1, 'none', false],
  ];
  for (const [titleLines, mode, legend] of tries) {
    const meta = metaIn(card, mode);
    for (const spacing of SPACINGS) {
      if (fits(titleLines, meta, legend, spacing))
        return { mediaW, titleStep: step, titleLines, balance: needed > 1 && needed <= titleLines, meta, bottom, spacing, legend };
    }
  }
  return { mediaW, titleStep: step, titleLines: 1, balance: false, meta: [], bottom, spacing: SPACINGS[SPACINGS.length - 1], legend: false };
}
