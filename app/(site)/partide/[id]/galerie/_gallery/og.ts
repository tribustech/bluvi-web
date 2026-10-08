import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { getCommunitySession, getSessionCatches } from '@/core/partide';
import { pluralNoun } from '@/core/realtime/chat/format';
import { createServerTransport } from '@/lib/server/transport';
import { brandImage, within } from '@/lib/server/og/images';
import { mediaWidth } from '@/lib/server/og/layout';
import { OG_ALT, type EntityCard } from '@/lib/server/og/model';
import { readPicture, renderCard } from '@/lib/server/og/render';
import { OG_SIZE } from '@/lib/server/og/tokens';
import { partidaCard } from '../../_spectator/og';
import { partidaPhoto } from '../../_spectator/seo';
import { galleryPhotos, GALLERY_QUERY } from './view';

/*
 * The gallery's share card (parity global.b.seo-og-images): the partidă's card (../../_spectator/og)
 * labelled «Partidă · Galerie», the photo count as its figure (the unit apart, rule 10) and the
 * gallery's FIRST photo — the first tile of the page — as its picture (else the partidă's top photo,
 * else the venue). Cached under `session-<id>`: an ended partidă's card is drawn once, a live one's
 * kept minutes. A partidă that cannot be read — unknown, PRIVATE (404, never drawn: invariant 15) or
 * a failed read — answers the brand card.
 */

const READ_MS = 4000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

type Model = { card: EntityCard | null; live: boolean };

async function galleryModel(id: string): Promise<Model> {
  'use cache';
  if (!ID.test(id)) {
    cacheLife('seconds');
    return { card: null, live: false };
  }
  cacheTag(`session-${id}`);
  const t = createServerTransport();
  const [read, photos] = await Promise.all([
    within(getCommunitySession(t, id), READ_MS),
    within(getSessionCatches(t, id, { ...GALLERY_QUERY }), READ_MS),
  ]);
  if (!read.ok) {
    if (read.transient) cacheLife('seconds');
    else cacheLife('minutes');
    return { card: null, live: false };
  }
  const d = read.value;
  const live = d.endedAt == null;
  if (live || !photos.ok) cacheLife('minutes');
  else cacheLife('days');
  const first = photos.ok ? galleryPhotos([photos.value])[0]?.full : null;
  const base = partidaCard(d, first ?? partidaPhoto(d));
  const card: EntityCard = {
    ...base,
    eyebrow: 'Partidă · Galerie',
    price: d.photoCount > 0 ? { amount: String(d.photoCount), unit: pluralNoun(d.photoCount, 'fotografie', 'fotografii') } : null,
  };
  return { card, live };
}

/** The card as PNG bytes (the brand card when the partidă cannot be read). */
export async function galleryImage(id: string): Promise<Uint8Array> {
  'use cache';
  if (ID.test(id)) cacheTag(`session-${id}`);
  const model = await galleryModel(id);
  if (!model.card) {
    cacheLife('seconds');
    return brandImage('home');
  }
  let card = model.card;
  let short = model.live;
  if (card.media.kind === 'photo') {
    const data = await readPicture(card.media.src, 'cover', mediaWidth(card));
    card = { ...card, media: data ? { kind: 'photo', src: data } : { kind: 'brand' } };
    if (!data) short = true;
  }
  if (short) cacheLife('minutes');
  else cacheLife('days');
  return renderCard(card);
}

/** The image's alt: what the card draws. */
export async function galleryAlt(id: string): Promise<string> {
  const { card } = await galleryModel(id);
  if (!card) return OG_ALT.home;
  const figure = card.price ? ` — ${card.price.amount} ${card.price.unit}` : '';
  return `Galeria partidei de la ${card.title}${figure}`;
}

export async function galleryImageMetadata(params: { id: string } | Promise<{ id: string }>) {
  const { id } = await params;
  return [{ id: 'card', alt: await galleryAlt(id), size: OG_SIZE, contentType: 'image/png' }];
}
