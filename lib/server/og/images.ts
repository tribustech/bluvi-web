import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { getRankings } from '@/core/competitions';
import { getLake } from '@/core/lakes';
import { isApiError } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';
import { miniRanking, type MiniRanking } from '@/app/(site)/concursuri/_list/desktop/model';
import { loadCompetition } from '@/app/(site)/concursuri/[id]/_components/load';
import { lakePriceFrom } from '@/app/(site)/balti/[id]/_components/priceFrom';
import { loadPublicWater } from '@/app/(site)/ape-publice/_server/load';
import { waterOutline } from '@/app/(site)/ape-publice/_components/map/outline';
import { loadNews, loadSponsor } from '@/app/(site)/stiri/_content/load';
import { sponsorImage } from '@/app/(site)/stiri/_content/content';
import {
  brandCard,
  competitionCard,
  competitionPhoto,
  entityAlt,
  FALLBACK,
  lakeCard,
  lakePhoto,
  newsCard,
  podiumNames,
  sponsorCard,
  waterCard,
  type BrandKey,
  type EntityCard,
  type EntityKind,
  type OgCard,
} from './model';
import { mediaWidth } from './layout';
import { ogTokens, readPicture, renderCard, type PictureFit } from './render';
import { OG_SIZE } from './tokens';

/*
 * The Open Graph images of the public pages (parity global.b.seo-og-images): per kind, one cached
 * model (the card's words, from the cached public CMS GETs — lib/server/public-get.ts) and one
 * cached drawing (the model + its picture, PNG bytes), both keyed by the entity (and the subpage's
 * label) and kept under the entity's CMS tag (`lake-<id>`, `competition-<id>`, `announcement-<id>`,
 * `sponsor-<id>`): drawn once, redrawn when the CMS purges the entity. The model also gives each
 * image its alt (`<kind>Alt`, the routes' generateImageMetadata), naming only what the card draws.
 *
 * A read that is slow (READ_MS) or fails for a transient reason (network, 5xx) never errors the
 * image: the card leaves that fact out and is kept for minutes only, so the next request reads
 * again. A read that answered — even «no price» (rule 4) or a ranking this build cannot parse — is
 * the answer, cached as long as the entity. An entity that cannot be read at all answers the
 * section's brand card, kept for seconds. The public-water dataset is bundled with the build.
 */

const READ_MS = 4000;
const PRICE_MS = 2500;

/** Strapi documentIds and dataset ids: anything else is answered with the brand card, unread. */
const ID = /^[A-Za-z0-9:%_.-]{1,80}$/;

/**
 * `p` within `ms`. `transient`: a timeout or an error worth retrying soon (network, 5xx); a 4xx or
 * a response this build cannot parse is settled (retrying gives the same answer).
 */
export type Read<T> = { ok: true; value: T } | { ok: false; transient: boolean };

export async function within<T>(p: Promise<T>, ms: number): Promise<Read<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Read<T>>(resolve => (timer = setTimeout(() => resolve({ ok: false, transient: true }), ms)));
  try {
    return await Promise.race([p.then(value => ({ ok: true as const, value })), timeout]);
  } catch (e) {
    const settled = isApiError(e) && (e.code === 'INVALID_RESPONSE' || (e.status >= 400 && e.status < 500));
    return { ok: false, transient: !settled };
  } finally {
    clearTimeout(timer);
  }
}

type Life = 'seconds' | 'minutes' | 'hours' | 'days' | 'max';
const ORDER: Life[] = ['seconds', 'minutes', 'hours', 'days', 'max'];
const shortest = (...lives: Life[]): Life => ORDER[Math.min(...lives.map(l => ORDER.indexOf(l)))];

/** cacheLife with a computed profile (its overloads take literals only). */
function keep(life: Life) {
  if (life === 'seconds') cacheLife('seconds');
  else if (life === 'minutes') cacheLife('minutes');
  else if (life === 'hours') cacheLife('hours');
  else if (life === 'days') cacheLife('days');
  else cacheLife('max');
}

/**
 * A card's words: `card: null` → the section's brand card. `life`: how long they hold (the drawing
 * takes the shortest of it and its picture's). `picture`: what to draw in the panel, read by the
 * drawing only (the alt never pays for it).
 */
type Model = { card: EntityCard | null; life: Life; picture: { url: string; fit: PictureFit } | null };

/** An entity that could not be read (or an id that is not one): the brand card, kept seconds. */
function unread(): Model {
  cacheLife('seconds');
  return { card: null, life: 'seconds', picture: null };
}

async function lakeModel(id: string, label: string | null): Promise<Model> {
  'use cache';
  if (!ID.test(id)) return unread();
  cacheTag(`lake-${id}`);
  const read = await within(getLake(createServerTransport(), id), READ_MS);
  if (!read.ok) return unread();
  const lake = read.value;
  const price = await within(lakePriceFrom(lake), PRICE_MS);
  // «No price» is the rule-4 answer, cached as the lake; only a slow / failed read is retried soon.
  const life: Life = !price.ok && price.transient ? 'minutes' : 'hours';
  keep(life);
  const url = lakePhoto(lake);
  return { card: lakeCard(lake, price.ok ? price.value : null, url, label), life, picture: url ? { url, fit: 'cover' } : null };
}

async function competitionModel(id: string, label: string | null): Promise<Model> {
  'use cache';
  if (!ID.test(id)) return unread();
  cacheTag(`competition-${id}`);
  const read = await within(loadCompetition(id), READ_MS);
  if (!read.ok || read.value.kind === 'missing' || read.value.kind === 'invalid') return unread();
  const load = read.value;
  const c = load.competition;
  const completed = c.competitionStatus === 'completed';
  let ranking: MiniRanking | null = null;
  let life: Life = completed ? 'days' : 'hours';
  // A ranking type this build does not know (or none, `''`): no podium, nothing to read or retry.
  if (completed && load.kind === 'ok') {
    const raw = await within(getRankings(createServerTransport(), id), READ_MS);
    // fish's card names the angler in an individual competition, never the team name typed (model.ts podiumNames).
    if (raw.ok) ranking = miniRanking(podiumNames(raw.value, c.competitionType));
    else if (raw.transient) life = 'minutes';
  }
  keep(life);
  const url = competitionPhoto(c);
  // A clearly landscape banner (often a designed poster with text) is drawn whole; else cropped (layout.ts drawnWhole).
  return { card: competitionCard(c, ranking, url, label), life, picture: url ? { url, fit: 'auto' } : null };
}

async function waterModel(id: string, label: string | null): Promise<Model> {
  'use cache';
  if (!ID.test(id)) return unread();
  const read = await within(loadPublicWater(id), READ_MS);
  if (!read.ok || read.value.kind === 'missing') return unread();
  cacheLife('max');
  const water = read.value.water;
  const outline = water.geometry ? waterOutline(water.geometry) : null;
  return { card: waterCard(water, outline, label), life: 'max', picture: null };
}

async function newsModel(id: string): Promise<Model> {
  'use cache';
  if (!ID.test(id)) return unread();
  cacheTag(`announcement-${id}`);
  const read = await within(loadNews(id), READ_MS);
  if (!read.ok || read.value.kind === 'missing') return unread();
  cacheLife('hours');
  const n = read.value.data;
  // The original upload (the feed's largest size; the medium one is soft at the panel's 520 px),
  // drawn whole: a news cover is a designed graphic, its own headline must not be cut — unless its
  // shape is near the panel's, then cropped (no dark slivers; layout.ts drawnWhole).
  const b = n.banner?.[0];
  const url = b ? b.url || b.mediumUrl || null : null;
  return { card: newsCard(n, url), life: 'hours', picture: url ? { url, fit: 'whole' } : null };
}

async function sponsorModel(id: string): Promise<Model> {
  'use cache';
  if (!ID.test(id)) return unread();
  cacheTag(`sponsor-${id}`);
  const read = await within(loadSponsor(id), READ_MS);
  if (!read.ok || read.value.kind === 'missing') return unread();
  cacheLife('days');
  const url = sponsorImage(read.value.data.image)?.src ?? null;
  return { card: sponsorCard(read.value.data, url), life: 'days', picture: url ? { url, fit: 'contain' } : null };
}

const MODELS: Record<EntityKind, (id: string, label: string | null) => Promise<Model>> = {
  lake: lakeModel,
  competition: competitionModel,
  water: waterModel,
  news: id => newsModel(id),
  sponsor: id => sponsorModel(id),
};

/** The section's brand card, for an entity that could not be read. */
function fallbackCard(kind: EntityKind): OgCard {
  const key = FALLBACK[kind];
  return key === 'home' ? { kind: 'home' } : brandCard(key);
}

/** A list page's (or Acasă's) card: no data, drawn once per build. */
export async function brandImage(key: BrandKey | 'home'): Promise<Uint8Array> {
  'use cache';
  cacheLife('max');
  return renderCard(key === 'home' ? { kind: 'home' } : brandCard(key));
}

/** An entity's card as PNG bytes: the model, its picture read and drawn into the panel. */
async function entityImage(kind: EntityKind, id: string, label: string | null): Promise<Uint8Array> {
  'use cache';
  if (ID.test(id)) {
    const tag = { lake: 'lake', competition: 'competition', news: 'announcement', sponsor: 'sponsor', water: null }[kind];
    if (tag) cacheTag(`${tag}-${id}`);
  }
  const model = await MODELS[kind](id, label);
  if (!model.card) {
    keep(model.life);
    return renderCard(fallbackCard(kind));
  }
  let card = model.card;
  let life = model.life;
  if (model.picture) {
    const data = await readPicture(model.picture.url, model.picture.fit, mediaWidth(card));
    // A picture that could not be read this time: the brand panel now, read again within minutes.
    if (!data) life = shortest(life, 'minutes');
    card = { ...card, media: data ? { ...card.media, src: data } as EntityCard['media'] : { kind: 'brand' } };
  }
  keep(life);
  return renderCard(card);
}

export const lakeImage = (id: string, label: string | null) => entityImage('lake', id, label);
export const competitionImage = (id: string, label: string | null) => entityImage('competition', id, label);
export const waterImage = (id: string, label: string | null) => entityImage('water', id, label);
export const newsImage = (id: string) => entityImage('news', id, null);
export const sponsorImageCard = (id: string) => entityImage('sponsor', id, null);

/** The image's alt, from the same cached model (never the picture). */
export async function ogAlt(kind: EntityKind, id: string, label: string | null = null): Promise<string> {
  const model = await MODELS[kind](id, label);
  return entityAlt(kind, model.card, await ogTokens());
}

/** The route's answer: the PNG (a failed drawing — Satori / resvg — falls back to the brand card). */
export async function ogResponse(draw: () => Promise<Uint8Array>, fallbackKey: BrandKey | 'home'): Promise<Response> {
  let png: Uint8Array;
  try {
    png = await draw();
  } catch (e) {
    console.error('[og] drawing failed', e);
    png = await brandImage(fallbackKey);
  }
  return new Response(png as BodyInit, { headers: { 'content-type': 'image/png' } });
}

/**
 * An entity route's generateImageMetadata: one image (`card`, the URL's last segment) whose alt
 * names the entity and only the facts its card draws. `params` is a plain object in Next 16 (the
 * image function's own is a promise); awaited either way.
 */
export async function ogImageMetadata(kind: EntityKind, params: { id: string } | Promise<{ id: string }>, label: string | null = null) {
  const { id } = await params;
  return [{ id: 'card', alt: await ogAlt(kind, id, label), size: OG_SIZE, contentType: 'image/png' }];
}
