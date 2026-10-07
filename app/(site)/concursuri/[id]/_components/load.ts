import 'server-only';
import { cache } from 'react';
import * as z from 'zod';
import {
  COMPETITION_CARDS_PAGE_SIZE,
  COMPETITION_CATCHES_PAGE_SIZE,
  competitionDetailSchema,
  DEFAULT_COMPETITION_FILTERS,
  formatKg,
  getCompetition,
  getCompetitionCards,
  getCompetitionCatches,
  getCompetitionWeighingStatistics,
  rankingTypeSchema,
  type CompetitionCatch,
  type CompetitionDetail,
  type WeighingStatisticsItem,
} from '@/core/competitions';
import { getLake } from '@/core/lakes';
import { formatCount } from '@/core/realtime/chat/format';
import { ApiError, call, isApiError, type Transport } from '@/core/transport';
import { richTextToPlain } from '@/components/templates/T3/prose';
import { collectionPageJsonLd } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { createServerTransport } from '@/lib/server/transport';
import { competitionDateProse, displayEnd } from './dates';
import type { RankingViewKey } from './views';

/**
 * The competition core with a ranking type core does not parse: one added to the CMS after this
 * build, or none at all (`''` — fish CompetitionRankingWrapper renders no ranking then).
 */
export type LooseCompetitionDetail = Omit<CompetitionDetail, 'rankingType'> & { rankingType: string };

export type CompetitionLoad =
  | { kind: 'ok'; competition: CompetitionDetail }
  | { kind: 'missing' }
  /**
   * The core parses except for `rankingType`: a type added to the CMS after this build — the web
   * renders the header, the preview and an explicit «not available» ranking state (parity
   * clasament.c2, b.supported-ranking-types) — or no type at all (`rankingType: ''`): no ranking
   * area, as fish (CompetitionRankingWrapper returns null).
   */
  | { kind: 'unsupported'; competition: LooseCompetitionDetail }
  /** The CMS answered with a shape core does not know at all. */
  | { kind: 'invalid' };

/**
 * Core gap: `competitionDetailSchema.rankingType` is the strict enum (it drives the table
 * builders), so one new ranking type fails the whole detail read. Until core is tolerant, the
 * same request is re-read with only that field loosened (same cached public GET).
 */
async function getCompetitionLoose(t: Transport, id: string): Promise<LooseCompetitionDetail | null> {
  try {
    const res = await call(
      t,
      { method: 'GET', path: `/feed/competitions/${encodeURIComponent(id)}`, auth: 'none' },
      z.object({ data: competitionDetailSchema.extend({ rankingType: z.string().nullish() }) }),
    );
    return { ...res.data, rankingType: res.data.rankingType ?? '' };
  } catch (e) {
    // Only «the shape is still wrong» means invalid; a network failure or a timeout is transient and
    // goes to error.tsx (with its retry), never to the dead-end «invalid» state.
    if (isApiError(e) && e.code === 'INVALID_RESPONSE') return null;
    throw e;
  }
}

/**
 * What a strict read that failed means, decided on `rankingType` alone (fish
 * CompetitionRankingWrapper): the loose read (only `rankingType` relaxed) failing too means another
 * field drifted → invalid; no ranking type → the page without a ranking; a type core knows → the
 * strict failure was elsewhere after all → invalid (never «this ranking type is not available»);
 * any other type → unsupported.
 */
export function classifyLoose(loose: LooseCompetitionDetail | null): CompetitionLoad {
  if (!loose) return { kind: 'invalid' };
  if (loose.rankingType === '') return { kind: 'unsupported', competition: loose };
  if (rankingTypeSchema.safeParse(loose.rankingType).success) return { kind: 'invalid' };
  return { kind: 'unsupported', competition: loose };
}

/** How long the competition read may take before the page shows its error («Încearcă din nou»). */
const READ_TIMEOUT_MS = 8000;

/**
 * The read, bounded: the public GET goes through the cached public-get, which takes no
 * AbortSignal, so a hung CMS would never reach error.tsx. It rejects with a retryable network
 * error instead (T3 data-loading contract; the demo's mainRead). A cached / prerendered read
 * answers long before the timer.
 */
export async function bounded<T>(p: Promise<T>, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ApiError({ message: `${what}: timeout`, status: 0, code: 'NETWORK', path: what })),
      READ_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The shared competition core (`/feed/competitions/:id`, public, cached by the CMS's own headers
 * and purged by the `competition-<id>` tag). One read per request for metadata + page.
 */
export const loadCompetition = cache(async (id: string): Promise<CompetitionLoad> => {
  const what = `/feed/competitions/${id}`;
  try {
    const competition = await bounded(getCompetition(createServerTransport(), id), what);
    return { kind: 'ok', competition };
  } catch (e) {
    if (isApiError(e) && (e.status === 404 || e.status === 400)) return { kind: 'missing' };
    if (isApiError(e) && e.code === 'INVALID_RESPONSE') {
      return classifyLoose(await bounded(getCompetitionLoose(createServerTransport(), id), what));
    }
    throw e;
  }
});

/**
 * Completed competitions to prerender. The competition-cards list is used rather than
 * `/feed/competitions` because its `rankingType` is free text: one row with a ranking type core
 * does not know must not fail the whole build. Only types core can parse are returned.
 */
export async function completedCompetitionIds(): Promise<string[]> {
  try {
    const page = await getCompetitionCards(createServerTransport(), {
      scope: 'all',
      status: 'completed',
      search: null,
      filters: DEFAULT_COMPETITION_FILTERS,
      sort: 'date',
      page: 1,
      pageSize: COMPETITION_CARDS_PAGE_SIZE,
    });
    return page.data.filter(c => rankingTypeSchema.safeParse(c.rankingType).success).map(c => c.documentId);
  } catch (e) {
    console.error('[concurs] generateStaticParams: completed list failed', e);
    return [];
  }
}

/**
 * What the page offers at this stage, for the summary (rule 4: never promise what is not there yet):
 * before the start the registration (and the regulation, when there is one); once started the
 * ranking and the weighings. Never «statistici»: signed-in only, and noindex.
 */
function competitionOffer(c: LooseCompetitionDetail): string {
  switch (c.competitionStatus) {
    case 'draft':
    case 'notStarted':
      return richTextToPlain(c.regulation) ? ' Înscrieri și regulament pe Bluvi.' : ' Înscrieri pe Bluvi.';
    case 'started':
    case 'completed':
      return ' Clasament și cântare pe Bluvi.';
    default:
      return '';
  }
}

/** Plain-text summary for meta description / JSON-LD (the end clamped as the page shows it: displayEnd). */
export function competitionSummary(c: LooseCompetitionDetail): string {
  const where = c.lake?.name ? ` pe ${c.lake.name}` : '';
  const when = competitionDateProse(c.startDate, displayEnd(c));
  const by = c.author?.username ? ` Organizat de ${c.author.username}.` : '';
  return `Concurs de pescuit${where}, ${when}.${by}${competitionOffer(c)}`;
}

/** The lake's locality and county, for the event's PostalAddress (null: not known). */
export type CompetitionPlace = { locality: string | null; region: string | null } | null;

/**
 * schema.org SportsEvent for the competition page. `place`: the lake's locality / county
 * (competitionPlace) — the address Google requires for an Event is set only when known (rule 4).
 * The organiser is the account that organises it, a club as often as a person: an Organization.
 */
export function competitionJsonLd(c: LooseCompetitionDetail, place: CompetitionPlace = null): Record<string, unknown> {
  const image = c.banner?.formats.large?.url ?? c.banner?.url;
  const address =
    place && (place.locality || place.region)
      ? {
          '@type': 'PostalAddress',
          ...(place.locality ? { addressLocality: place.locality } : {}),
          ...(place.region ? { addressRegion: place.region } : {}),
          addressCountry: 'RO',
        }
      : null;
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: c.name,
    description: competitionSummary(c),
    sport: 'Pescuit',
    startDate: c.startDate,
    endDate: displayEnd(c),
    url: absoluteUrl(routes.competition(c.documentId)),
    eventStatus:
      c.competitionStatus === 'cancelled' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(image ? { image: [image] } : {}),
    ...(c.lake
      ? {
          location: {
            '@type': 'Place',
            name: c.lake.name,
            url: absoluteUrl(routes.lake(c.lake.documentId)),
            ...(address ? { address } : {}),
          },
        }
      : {}),
    ...(c.author ? { organizer: { '@type': 'Organization', name: c.author.username } } : {}),
  };
}

/** How long a JSON-LD-only read may take before the block is emitted without it. */
const JSON_LD_BUDGET_MS = 2500;

/** A read for the JSON-LD alone: its value, or null when it fails or is slow (the block then says less, never something wrong). */
async function optional<T>(p: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<null>(resolve => (timer = setTimeout(() => resolve(null), JSON_LD_BUDGET_MS)))]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The competition lake's locality and county (its cached public detail), or null. */
export async function competitionPlace(c: LooseCompetitionDetail, t: Transport = createServerTransport()): Promise<CompetitionPlace> {
  if (!c.lake) return null;
  const lake = await optional(getLake(t, c.lake.documentId));
  return lake ? { locality: lake.cityRef?.name ?? null, region: lake.countyRef?.name ?? lake.county ?? null } : null;
}

const kg = (n: number) => `${formatKg(n)} kg`;
const who = (x: CompetitionCatch) => x.teamName ?? x.participantUsername ?? x.guestName ?? null;

/** Cântare rows (weighing statistics, in weighing order — ascending by time): the stand, the kilograms and the fish — «fără captură», never «capot». */
export function weighingItems(rows: readonly WeighingStatisticsItem[]) {
  return [...rows]
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate) || a.sequenceIndex - b.sequenceIndex)
    .map(w => ({
      name: w.standName ? `Standul ${w.standName}` : 'Cântar',
      description: `${kg(w.totalWeightKg)}, ${w.catchCount > 0 ? formatCount(w.catchCount, 'pește', 'pești') : 'fără captură'}`,
    }));
}

/** Toți peștii rows (the first page, heaviest first — the view's default sort): the species, the kilograms, the stand and the angler. */
export function catchItems(rows: readonly CompetitionCatch[]) {
  return rows.map(x => ({
    name: x.fishName ?? 'Pește',
    description: [kg(x.weight), x.standName ? `standul ${x.standName}` : null, who(x)].filter(Boolean).join(', '),
  }));
}

/** At most this many rows go into a view's ItemList. */
const MAX_LIST_ITEMS = 100;

/**
 * The page's JSON-LD: the SportsEvent on the competition page and its route tabs; on /cantare and
 * /capturi (their own content — global.b.seo-json-ld) a CollectionPage `about` the event with the
 * view's rows as an ItemList when there are any (like the lake rankings), instead of repeating the
 * whole event. A failed / slow read leaves its part out.
 */
export async function competitionPageJsonLd(c: LooseCompetitionDetail, view: RankingViewKey | null): Promise<Record<string, unknown>> {
  const t = createServerTransport();
  const started = c.competitionStatus === 'started' || c.competitionStatus === 'completed';
  // Before the start the views show the preview (canonicalised to the page): the event itself.
  if ((view !== 'cantare' && view !== 'allFish') || !started) return competitionJsonLd(c, await competitionPlace(c, t));
  const about = { type: 'SportsEvent', name: c.name, path: routes.competition(c.documentId) };
  if (view === 'cantare') {
    const res = await optional(getCompetitionWeighingStatistics(t, c.documentId));
    const name = `Cântare · ${c.name}`;
    return collectionPageJsonLd({
      name,
      path: routes.competitionWeighings(c.documentId),
      about,
      list: res ? { name, items: weighingItems(res.data).slice(0, MAX_LIST_ITEMS), order: 'ascending' } : undefined,
    });
  }
  const res = await optional(getCompetitionCatches(t, c.documentId, 'weight_desc', 1, COMPETITION_CATCHES_PAGE_SIZE));
  const name = `Toți peștii · ${c.name}`;
  return collectionPageJsonLd({
    name,
    path: routes.competitionCatches(c.documentId),
    about,
    list: res ? { name, items: catchItems(res.data) } : undefined,
  });
}
