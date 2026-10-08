import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { loadImage, shareablePhotoSrc } from '@/components/partide/share/shareCard';
import { coverRect, type GifItem } from './model';

/*
 * fish features/partide/helpers/gifExport.ts on the web: each photo catch drawn into its own frame
 * on a 2D canvas (the web's offscreen Skia surface) — the photo cover-fit, a bottom scrim, the venue
 * (· stand), the big kg with its unit apart, the species chip, the date — and encoded client-side
 * with gifenc (fish's encoder), strictly one frame at a time (await between frames) so memory stays
 * flat and the «{done}/{total}» progress paints.
 *
 * The photos come same-origin (shareablePhotoSrc: the ape-publice foto proxy for a CMS URL, as the
 * share card), so the canvas stays readable; a tainted canvas throws — the caller's failure toast.
 * A photo that does not load leaves its frame on the dark ground with the lines (fish: an
 * undecodable photo draws nothing under the captions). The paint is fish's, fixed: an exported image
 * is not themed UI.
 */

const WIDTH = 720;
const HEIGHT = 900; // 4:5
const FRAME_DELAY_MS = 2000;

const VENUE_PX = 30;
const KG_PX = 66;
const KG_UNIT_PX = 30;
const CHIP_PX = 26;
const DATE_PX = 24;
const LEFT = 36;
const DATE_BASELINE_FROM_BOTTOM = 36;
const KG_BASELINE_FROM_BOTTOM = 86;
const VENUE_BASELINE_FROM_BOTTOM = 168;
const CHIP_PAD_X = 18;
const CHIP_PAD_Y = 12;
const SCRIM_RATIO = 0.38;

const PAINT = {
  ground: '#0E2530',
  white: '#FFFFFF',
  dimmed: 'rgba(255,255,255,0.85)',
  chip: 'rgba(28,28,30,0.85)',
};

export type GifProgress = (done: number, total: number) => void;

/** Renders `items` into an animated GIF (a Blob, image/gif). Throws when a frame cannot be read. */
export async function exportGalleryGif(items: GifItem[], { onProgress, family = 'sans-serif' }: { onProgress?: GifProgress; family?: string } = {}): Promise<Blob> {
  if (!items.length) throw new Error('exportGalleryGif: no items');
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('exportGalleryGif: no 2d context');
  const gif = GIFEncoder();
  const origin = window.location.origin;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const photo = await loadImage(shareablePhotoSrc(item.photoUri, origin));
    drawFrame(ctx, item, photo, family);
    const { data } = ctx.getImageData(0, 0, WIDTH, HEIGHT);
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, WIDTH, HEIGHT, { palette, delay: FRAME_DELAY_MS, repeat: 0, first: i === 0 });
    onProgress?.(i + 1, items.length);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  gif.finish();
  return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
}

const font = (family: string, px: number, weight: number) => `${weight} ${px}px ${family}`;

/** Clip `text` with «…» to `max` px in the current font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function drawFrame(ctx: CanvasRenderingContext2D, item: GifItem, photo: HTMLImageElement | null, family: string) {
  ctx.fillStyle = PAINT.ground;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (photo) {
    const src = coverRect(photo.naturalWidth, photo.naturalHeight, WIDTH, HEIGHT);
    ctx.drawImage(photo, src.x, src.y, src.width, src.height, 0, 0, WIDTH, HEIGHT);
  }

  // fish drawBottomScrim: the fade to 78% black over the bottom 38%.
  const top = HEIGHT * (1 - SCRIM_RATIO);
  const scrim = ctx.createLinearGradient(0, top, 0, HEIGHT);
  scrim.addColorStop(0, 'rgba(0,0,0,0)');
  scrim.addColorStop(0.5, 'rgba(0,0,0,0.2)');
  scrim.addColorStop(1, 'rgba(0,0,0,0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, top, WIDTH, HEIGHT - top);

  ctx.textBaseline = 'alphabetic';
  const max = WIDTH - LEFT * 2;
  if (item.venue) {
    ctx.font = font(family, VENUE_PX, 700);
    ctx.fillStyle = PAINT.white;
    ctx.fillText(fit(ctx, item.venue, max), LEFT, HEIGHT - VENUE_BASELINE_FROM_BOTTOM);
  }

  const kgBaseline = HEIGHT - KG_BASELINE_FROM_BOTTOM;
  let x = LEFT;
  if (item.kgText) {
    ctx.font = font(family, KG_PX, 800);
    ctx.fillStyle = PAINT.white;
    ctx.fillText(item.kgText, x, kgBaseline);
    x += ctx.measureText(item.kgText).width + 10;
    ctx.font = font(family, KG_UNIT_PX, 700);
    ctx.fillStyle = PAINT.dimmed;
    ctx.fillText('kg', x, kgBaseline);
    x += ctx.measureText('kg').width + 22;
  }

  if (item.species) {
    ctx.font = font(family, CHIP_PX, 700);
    const label = fit(ctx, item.species, Math.max(80, WIDTH - LEFT - x - CHIP_PAD_X * 2));
    const w = ctx.measureText(label).width + CHIP_PAD_X * 2;
    const h = CHIP_PX + CHIP_PAD_Y * 2;
    const chipTop = kgBaseline - KG_PX / 2 - h / 2 + 6;
    ctx.fillStyle = PAINT.chip;
    ctx.beginPath();
    ctx.roundRect(x, chipTop, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = PAINT.white;
    ctx.fillText(label, x + CHIP_PAD_X, chipTop + CHIP_PAD_Y + CHIP_PX - 4);
  }

  if (item.dateLabel) {
    ctx.font = font(family, DATE_PX, 600);
    ctx.fillStyle = PAINT.dimmed;
    ctx.fillText(item.dateLabel, LEFT, HEIGHT - DATE_BASELINE_FROM_BOTTOM);
  }
}
