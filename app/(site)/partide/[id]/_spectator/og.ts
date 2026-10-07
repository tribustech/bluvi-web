import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { deriveSessionView, fmtKg, getCommunitySession, type CommunitySessionDetailDTO } from '@/core/partide';
import { createServerTransport } from '@/lib/server/transport';
import { brandImage, within } from '@/lib/server/og/images';
import { mediaWidth } from '@/lib/server/og/layout';
import { clampText, OG_ALT, TITLE_MAX, type EntityCard } from '@/lib/server/og/model';
import { readPicture, renderCard } from '@/lib/server/og/render';
import { OG_SIZE } from '@/lib/server/og/tokens';
import { dayMonthRo, longDateRo } from '@/components/partide/session/format';
import { partidaPhoto } from './seo';

/*
 * The partidă's share card (parity global.b.seo-og-images), on the site's OG card system
 * (lib/server/og): «Partidă · Live», the venue as the title, the place and the date, the total
 * weighed kg as the big figure (unit apart, rule 10; none when nothing was weighed, rule 4) and the
 * top catch photo (else the venue image). Cached under the partidă's CMS tag `session-<id>`: an
 * ended partidă's card is drawn once, a live one's is kept minutes. A partidă that cannot be read —
 * unknown, PRIVATE (404, never drawn: invariant 15) or a failed read — answers the brand card.
 */

const READ_MS = 4000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

type Model = { card: EntityCard | null; live: boolean };

export function partidaCard(d: CommunitySessionDetailDTO, photo: string | null): EntityCard {
  const live = d.endedAt == null;
  const total = deriveSessionView(d).totalKg;
  const place = d.locality && d.locality !== d.venueName ? d.locality : null;
  return {
    kind: 'entity',
    eyebrow: 'Partidă',
    title: clampText(d.venueName, TITLE_MAX),
    pill: live ? { text: 'Live', tone: 'live' } : null,
    meta: [
      ...(place ? [{ icon: 'pin' as const, text: clampText(place, 60) }] : []),
      { icon: 'calendar' as const, text: longDateRo(d.startedAt), short: dayMonthRo(d.startedAt) },
    ],
    rating: null,
    price: total != null ? { amount: fmtKg(total), unit: 'kg' } : null,
    podium: [],
    media: photo ? { kind: 'photo', src: photo } : { kind: 'brand' },
  };
}

async function partidaModel(id: string): Promise<Model> {
  'use cache';
  if (!ID.test(id)) {
    cacheLife('seconds');
    return { card: null, live: false };
  }
  cacheTag(`session-${id}`);
  const read = await within(getCommunitySession(createServerTransport(), id), READ_MS);
  if (!read.ok) {
    if (read.transient) cacheLife('seconds');
    else cacheLife('minutes');
    return { card: null, live: false };
  }
  const live = read.value.endedAt == null;
  if (live) cacheLife('minutes');
  else cacheLife('days');
  return { card: partidaCard(read.value, partidaPhoto(read.value)), live };
}

/** The card as PNG bytes (the brand card when the partidă cannot be read). */
export async function partidaImage(id: string): Promise<Uint8Array> {
  'use cache';
  if (ID.test(id)) cacheTag(`session-${id}`);
  const model = await partidaModel(id);
  if (!model.card) {
    cacheLife('seconds');
    return brandImage('home');
  }
  let card = model.card;
  // A live partidă's card changes with every catch; a picture that could not be read is retried soon.
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
export async function partidaAlt(id: string): Promise<string> {
  const { card } = await partidaModel(id);
  if (!card) return OG_ALT.home;
  const figure = card.price ? ` — ${card.price.amount} kg cântărite` : '';
  const when = card.meta.find(m => m.icon === 'calendar')?.text;
  const place = card.meta.find(m => m.icon === 'pin')?.text;
  return `Partidă la ${card.title}${place ? `, ${place}` : ''}${when ? `, ${when}` : ''}${card.pill ? ' (live)' : ''}${figure}`;
}

export async function partidaImageMetadata(params: { id: string } | Promise<{ id: string }>) {
  const { id } = await params;
  return [{ id: 'card', alt: await partidaAlt(id), size: OG_SIZE, contentType: 'image/png' }];
}
