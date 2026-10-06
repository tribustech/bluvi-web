import { fmtKg } from '@/core/partide';

/*
 * The Bluvi share card for a catch on a public water — fish CatchCard variant="share" as
 * ShareCatchSheet composes it (features/partide/components/CatchCard.tsx, lakeCatchToShareEvent):
 * the photo full-bleed under a dark foot, the Bluvi wordmark top-right, and over the foot the
 * water's name, the big kg + species chip, and the date pill. With no photo the card switches to
 * the brand composition (indigo gradient, waves, kg + species centred).
 *
 * Drawn on a canvas (the web's react-native-view-shot), so the preview IS the exported PNG. The
 * paint is fish's, fixed: an exported image is not themed UI, it must read the same for whoever
 * receives it, in either theme.
 */

export type ShareField = 'kg' | 'balta' | 'specie' | 'date';
export type ShareFields = Record<ShareField, boolean>;

export const SHARE_FIELD_LABEL: Record<ShareField, string> = {
  kg: 'Greutate',
  balta: 'Baltă',
  specie: 'Specie',
  date: 'Data',
};

export const ALL_FIELDS: ShareFields = { kg: true, balta: true, specie: true, date: true };

export type ShareCatch = {
  weightKg: number | null;
  species: string | null;
  occurredAt: string;
};

/**
 * fish ShareCatchSheet `fieldKeys`: a switch only for something the catch has (no «Greutate» on a
 * weightless catch, no «Baltă» without a name); the date always. Fewer than two left: no switches.
 */
export function shareFieldKeys(c: ShareCatch, waterName: string): ShareField[] {
  const keys: ShareField[] = [];
  if (c.weightKg != null) keys.push('kg');
  if (waterName) keys.push('balta');
  if (c.species) keys.push('specie');
  keys.push('date');
  return keys;
}

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** fish CatchCard `dmy`: «20 sep 2026», on the Romanian calendar day. */
export function dmy(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return `${get('day')} ${MONTHS[get('month') - 1]} ${get('year')}`;
}

/** What the card shows, in reading order — the preview's accessible name. */
export function shareCardLines(c: ShareCatch, waterName: string, f: ShareFields): string[] {
  return [
    f.balta && waterName ? waterName : null,
    f.kg && c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null,
    f.specie && c.species ? c.species : null,
    f.date ? dmy(c.occurredAt) : null,
  ].filter((s): s is string => !!s);
}

/**
 * The photo as the canvas may export it: a data/blob URL or a same-origin one as is, anything
 * else through the water pages' same-origin proxy (_server/photoProxy.ts) — the CMS buckets send
 * no CORS headers, and a canvas that drew a cross-origin photo cannot be exported.
 */
export function shareablePhotoSrc(src: string, origin: string): string {
  if (/^(data|blob):/i.test(src)) return src;
  try {
    if (new URL(src, origin).origin === origin) return src;
  } catch {
    return src;
  }
  return `/ape-publice/api/foto?src=${encodeURIComponent(src)}`;
}

/* ------------------------------------------------------------------------------------------------
 * Drawing — fish dp × S. The preview in the sheet is 339dp wide (a phone less 18dp each side) and
 * the card 430dp tall; the export is that at 1080px wide.
 * ---------------------------------------------------------------------------------------------- */

export const CARD_W = 1080;
const S = CARD_W / 339;
export const CARD_H = Math.round(430 * S);

const PAINT = {
  plate: '#0E2530',
  brand: ['#5357E0', '#6366F1', '#818CF8'] as const,
  footTop: 'rgba(10,14,22,0.05)',
  footMid: 'rgba(10,14,22,0)',
  footEnd: 'rgba(10,14,22,0.85)',
  white: '#FFFFFF',
  white92: 'rgba(255,255,255,0.92)',
  white85: 'rgba(255,255,255,0.85)',
  chip: 'rgba(255,255,255,0.22)',
  pill: 'rgba(0,0,0,0.34)',
};

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const font = (family: string, px: number, weight: number) => `${weight} ${Math.round(px * S)}px ${family}`;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** Clip `text` with «…» to `max` px in the current font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** The species chip / date pill: caption text on a rounded fill; returns its width. */
function chip(ctx: CanvasRenderingContext2D, family: string, text: string, x: number, bottom: number, fill: string, padX: number, padY: number, max: number) {
  ctx.font = font(family, 12, 600);
  const label = fit(ctx, text, max - padX * 2 * S);
  const w = ctx.measureText(label).width + padX * 2 * S;
  const h = (16 + padY * 2) * S;
  ctx.fillStyle = fill;
  roundRect(ctx, x, bottom - h, w, h, h / 2);
  ctx.fillStyle = PAINT.white;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + padX * S, bottom - h / 2 + 0.5 * S);
  return w;
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  {
    c,
    waterName,
    fields: f,
    photo,
    logo,
    family,
  }: { c: ShareCatch; waterName: string; fields: ShareFields; photo: HTMLImageElement | null; logo: HTMLImageElement | null; family: string },
) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = CARD_W;
  const H = CARD_H;
  ctx.textAlign = 'left';
  ctx.fillStyle = PAINT.plate;
  ctx.fillRect(0, 0, W, H);

  const brand = !photo;
  if (photo) {
    // contentFit cover
    const k = Math.max(W / photo.naturalWidth, H / photo.naturalHeight);
    const pw = photo.naturalWidth * k;
    const ph = photo.naturalHeight * k;
    ctx.drawImage(photo, (W - pw) / 2, (H - ph) / 2, pw, ph);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, PAINT.footTop);
    g.addColorStop(0.35, PAINT.footMid);
    g.addColorStop(1, PAINT.footEnd);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0.1 * H, W, 0.9 * H);
    g.addColorStop(0, PAINT.brand[0]);
    g.addColorStop(0.45, PAINT.brand[1]);
    g.addColorStop(1, PAINT.brand[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // The waves (300×240 at viewBox 200×160, right/bottom −40, 30%).
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = PAINT.white;
    ctx.lineCap = 'round';
    const u = (300 / 200) * S;
    const ox = W - (300 - 40) * S;
    const oy = H - (240 - 40) * S;
    ctx.lineWidth = 7 * u;
    for (const y of [40, 80, 120]) {
      ctx.beginPath();
      ctx.moveTo(ox + 10 * u, oy + y * u);
      for (let i = 0; i < 3; i++) {
        const x0 = ox + (10 + i * 50) * u;
        ctx.quadraticCurveTo(x0 + 25 * u, oy + (y - 18 * (i % 2 === 0 ? 1 : -1)) * u, x0 + 50 * u, oy + y * u);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // The wordmark, top 12 / right 14, 74×22 contain, white at 92%.
  if (logo && logo.naturalWidth) {
    const boxW = 74 * S;
    const boxH = 22 * S;
    const k = Math.min(boxW / logo.naturalWidth, boxH / logo.naturalHeight);
    const lw = logo.naturalWidth * k;
    const lh = logo.naturalHeight * k;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logo, W - 14 * S - boxW + (boxW - lw) / 2, 12 * S + (boxH - lh) / 2, lw, lh);
    ctx.restore();
  }

  const kg = f.kg && c.weightKg != null ? fmtKg(c.weightKg) : null;
  const species = f.specie && c.species ? c.species : null;

  if (brand && (kg || species)) {
    // Centred headline: «12,5 kg» (hero + heading) over the species (title2).
    const kgH = kg ? 44 * S : 0;
    const spH = species ? 22 * S : 0;
    const total = kgH + spH + (kg && species ? 2 * S : 0);
    let y = (H - total) / 2;
    ctx.textBaseline = 'alphabetic';
    if (kg) {
      ctx.font = font(family, 40, 800);
      const a = ctx.measureText(kg).width;
      ctx.font = font(family, 16, 800);
      const b = ctx.measureText('kg').width;
      const x = (W - (a + 6 * S + b)) / 2;
      const base = y + 34 * S;
      ctx.font = font(family, 40, 800);
      ctx.fillStyle = PAINT.white;
      ctx.fillText(kg, x, base);
      ctx.font = font(family, 16, 800);
      ctx.fillStyle = PAINT.white85;
      ctx.fillText('kg', x + a + 6 * S, base);
      y += kgH + 2 * S;
    }
    if (species) {
      ctx.font = font(family, 17, 700);
      ctx.fillStyle = PAINT.white;
      ctx.textAlign = 'center';
      ctx.fillText(fit(ctx, species, W - 32 * S), W / 2, y + 17 * S);
      ctx.textAlign = 'left';
    }
  }

  // The foot, from the bottom up: left 16, bottom 14, rows 8 apart.
  const left = 16 * S;
  const maxW = W - 32 * S;
  let bottom = H - 14 * S;
  if (f.date) {
    chip(ctx, family, dmy(c.occurredAt), left, bottom, PAINT.pill, 9, 4, maxW);
    bottom -= 24 * S + 8 * S;
  }
  if (!brand && (kg || species)) {
    let x = left;
    const rowH = kg ? 44 * S : 20 * S;
    const base = bottom - 9 * S;
    ctx.textBaseline = 'alphabetic';
    if (kg) {
      ctx.font = font(family, 40, 800);
      ctx.fillStyle = PAINT.white;
      ctx.fillText(kg, x, base);
      x += ctx.measureText(kg).width + 6 * S;
      ctx.font = font(family, 16, 800);
      ctx.fillStyle = PAINT.white85;
      ctx.fillText('kg', x, base);
      x += ctx.measureText('kg').width + 6 * S;
    }
    if (species) {
      x += kg ? 2 * S : 0;
      // Baseline-aligned with the kg: the chip's text sits on the row's baseline.
      const chipBottom = kg ? base + 5 * S : bottom;
      chip(ctx, family, species, x, chipBottom, PAINT.chip, 9, 2, left + maxW - x);
    }
    bottom -= rowH + 8 * S;
  }
  if (f.balta && waterName) {
    ctx.font = font(family, 14, 600);
    ctx.fillStyle = PAINT.white92;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(fit(ctx, waterName, maxW), left, bottom - 5 * S);
  }
}

/** The canvas as a PNG file to hand to the system share sheet / a download. */
export function cardFile(canvas: HTMLCanvasElement): Promise<File | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob ? new File([blob], 'bluvi-captura.png', { type: 'image/png' }) : null), 'image/png');
    } catch {
      // A tainted canvas (a photo that did not come through the proxy) cannot be exported.
      resolve(null);
    }
  });
}
