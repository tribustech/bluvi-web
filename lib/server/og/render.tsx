import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { cmsUrl } from '@/lib/server/env';
import { BrandCardView, EntityCardView } from './cards';
import { drawnWhole, MEDIA_W } from './layout';
import type { OgCard } from './model';
import { OG_SIZE, parseOgTokens, type OgTokens } from './tokens';

/*
 * Draws a card (cards.tsx) to PNG bytes — the body every opengraph-image / twitter-image route
 * answers with. Reads, once per server: Nunito (the ranking image's static instances: Satori reads
 * ttf, not the variable woff2), the tokens (app/globals.css), Acasă's share image.
 *
 * Size: a 1200×630 PNG with a photo is ~0.5–1 MB straight out of resvg; the links are fetched by
 * every chat app and crawler, so the bytes are re-encoded (sharp, next's own image dependency): in
 * full colour when that is small enough, else as a 256-colour palette PNG — under 300 KB and visually
 * the same at preview sizes. Pictures are read through sharp
 * too: resized to the panel before Satori sees them (a 4000 px phone photo would cost seconds) and
 * converted from WebP (which Satori cannot decode). Without sharp (it is optional) the card is still
 * drawn: PNG / JPEG pictures as they are, other formats left out, the PNG not re-encoded.
 */

const FONT_DIR = join(process.cwd(), 'app/(site)/concursuri/[id]/clasament/imagine/_assets');

const fonts = Promise.all(
  (
    [
      ['Nunito-Regular.ttf', 400],
      ['Nunito-SemiBold.ttf', 600],
      ['Nunito-Bold.ttf', 700],
      ['Nunito-ExtraBold.ttf', 800],
    ] as const
  ).map(async ([file, weight]) => ({ name: 'Nunito', data: await readFile(join(FONT_DIR, file)), weight, style: 'normal' as const })),
);

const tokens = readFile(join(process.cwd(), 'app/globals.css'), 'utf8').then(parseOgTokens);

/** The card tokens (app/globals.css), read once per server — the layout and the alt measure with them. */
export const ogTokens = (): Promise<OgTokens> => tokens;

const HOME_IMAGE = join(process.cwd(), 'app/(site)/_home/assets/og-home.jpg');

type Sharp = Awaited<typeof import('sharp')>['default'];
const sharpModule: Promise<Sharp | null> = import('sharp').then(
  m => m.default,
  () => null,
);

const PICTURE_TIMEOUT_MS = 3000;
const MAX_PICTURE_BYTES = 12 * 1024 * 1024;
const DRAWABLE = /^image\/(png|jpe?g)$/;

/**
 * How a picture fills the portrait panel (`width`×630, layout.ts mediaWidth):
 *  - `cover`: cropped to it (a lake's photo, a portrait poster);
 *  - `whole`: never cut — drawn whole across the panel over a blurred, dimmed copy of itself (a news
 *    cover: it often carries designed text a crop would cut) — unless its shape is within
 *    layout.ts NEAR_PANEL of the panel's: then it is cropped (the few pixels lost beat two dark slivers);
 *  - `auto`: `whole` for a clearly landscape picture (wider than the panel by more than
 *    NEAR_PANEL), else `cover` (competition banners);
 *  - `contain`: a sponsor logo, whole, transparent, on the panel's white.
 */
export type PictureFit = 'cover' | 'whole' | 'auto' | 'contain';

/**
 * A CMS picture as a data URL sized for its panel (PictureFit); null when it cannot be read or
 * drawn — the card then shows the brand panel.
 */
export async function readPicture(url: string, fit: PictureFit, width: number = MEDIA_W): Promise<string | null> {
  try {
    const absolute = /^https?:\/\//.test(url) ? url : new URL(url, cmsUrl()).toString();
    const res = await fetch(absolute, { signal: AbortSignal.timeout(PICTURE_TIMEOUT_MS) });
    const type = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!res.ok || !type.startsWith('image/')) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_PICTURE_BYTES) return null;
    const sharp = await sharpModule;
    if (!sharp) return DRAWABLE.test(type) ? `data:${type};base64,${bytes.toString('base64')}` : null;
    if (fit === 'contain') {
      const png = await sharp(bytes, { failOn: 'none' }).rotate().resize(width, OG_SIZE.height, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    }
    // Upright first (EXIF), so the shape is what the reader sees.
    const upright = await sharp(bytes, { failOn: 'none' }).rotate().toBuffer({ resolveWithObject: true });
    const whole = drawnWhole(fit, upright.info.width, upright.info.height, width);
    let jpeg: Buffer;
    if (!whole) {
      jpeg = await sharp(upright.data).resize(width, OG_SIZE.height, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
    } else {
      const ground = await sharp(upright.data).resize(width, OG_SIZE.height, { fit: 'cover' }).blur(28).modulate({ brightness: 0.72 }).toBuffer();
      const picture = await sharp(upright.data).resize(width, OG_SIZE.height, { fit: 'inside' }).toBuffer();
      jpeg = await sharp(ground).composite([{ input: picture, gravity: 'center' }]).jpeg({ quality: 82 }).toBuffer();
    }
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return null;
  }
}

/** The card as PNG bytes (≤ ~300 KB with sharp). Throws only when Satori / resvg fail. */
export async function renderCard(card: OgCard): Promise<Uint8Array> {
  let raw: Uint8Array;
  if (card.kind === 'home') {
    // Acasă's share image is already the designed card (1200×630): served as PNG, as every card.
    raw = new Uint8Array(await readFile(HOME_IMAGE));
    const sharp = await sharpModule;
    if (!sharp) {
      const t = await tokens;
      const src = `data:image/jpeg;base64,${Buffer.from(raw).toString('base64')}`;
      const res = new ImageResponse(
        (
          // eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>
          <img src={src} width={OG_SIZE.width} height={OG_SIZE.height} style={{ backgroundColor: t.color.surface }} alt="" />
        ),
        { ...OG_SIZE },
      );
      return new Uint8Array(await res.arrayBuffer());
    }
    return compress(sharp, raw);
  }
  const t = await tokens;
  const element = card.kind === 'brand' ? <BrandCardView t={t} card={card} /> : <EntityCardView t={t} card={card} />;
  const res = new ImageResponse(element, { ...OG_SIZE, fonts: await fonts });
  // ImageResponse renders lazily: reading it here makes a Satori / resvg failure throw here.
  raw = new Uint8Array(await res.arrayBuffer());
  const sharp = await sharpModule;
  if (!sharp) return raw;
  return compress(sharp, raw);
}

/** Under this a card is kept in full colour (no banding in the brand gradient); over it, a palette PNG. */
export const TRUECOLOR_BUDGET = 260 * 1024;

/** The smallest faithful PNG: full colour when it fits the budget, else 256 colours (dithered). */
async function compress(sharp: Sharp, raw: Uint8Array): Promise<Uint8Array> {
  const full = await sharp(raw).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  if (full.length <= TRUECOLOR_BUDGET) return new Uint8Array(full);
  return new Uint8Array(await sharp(raw).png({ palette: true, quality: 100, colours: 256, dither: 1, effort: 8, compressionLevel: 9 }).toBuffer());
}
