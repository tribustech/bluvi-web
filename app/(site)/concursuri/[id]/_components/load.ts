import 'server-only';
import { cache } from 'react';
import * as z from 'zod';
import {
  COMPETITION_CARDS_PAGE_SIZE,
  competitionDetailSchema,
  DEFAULT_COMPETITION_FILTERS,
  getCompetition,
  getCompetitionCards,
  rankingTypeSchema,
  type CompetitionDetail,
} from '@/core/competitions';
import { ApiError, call, isApiError, type Transport } from '@/core/transport';
import { absoluteUrl, routes } from '@/lib/routes';
import { createServerTransport } from '@/lib/server/transport';
import { competitionDateProse } from './dates';

/** The competition core with a ranking type core does not parse (one added to the CMS after this build). */
export type LooseCompetitionDetail = Omit<CompetitionDetail, 'rankingType'> & { rankingType: string };

export type CompetitionLoad =
  | { kind: 'ok'; competition: CompetitionDetail }
  | { kind: 'missing' }
  /**
   * The core parses except for `rankingType` (a type added to the CMS after this build): the web
   * renders the header, the preview and an explicit «not available» ranking state (parity
   * clasament.c2, b.supported-ranking-types).
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
      z.object({ data: competitionDetailSchema.extend({ rankingType: z.string() }) }),
    );
    return res.data;
  } catch (e) {
    // Only «the shape is still wrong» means invalid; a network failure or a timeout is transient and
    // goes to error.tsx (with its retry), never to the dead-end «invalid» state.
    if (isApiError(e) && e.code === 'INVALID_RESPONSE') return null;
    throw e;
  }
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
      const competition = await bounded(getCompetitionLoose(createServerTransport(), id), what);
      return competition ? { kind: 'unsupported', competition } : { kind: 'invalid' };
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

/** Plain-text summary for meta description / JSON-LD. */
export function competitionSummary(c: LooseCompetitionDetail): string {
  const where = c.lake?.name ? ` pe ${c.lake.name}` : '';
  const when = competitionDateProse(c.startDate, c.endDate);
  const by = c.author?.username ? ` Organizat de ${c.author.username}.` : '';
  return `Concurs de pescuit${where}, ${when}.${by} Clasament, cântare și statistici pe Bluvi.`;
}

/** schema.org SportsEvent for the competition page. */
export function competitionJsonLd(c: LooseCompetitionDetail): Record<string, unknown> {
  const image = c.banner?.formats.large?.url ?? c.banner?.url;
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: c.name,
    description: competitionSummary(c),
    sport: 'Pescuit',
    startDate: c.startDate,
    endDate: c.endDate,
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
          },
        }
      : {}),
    ...(c.author ? { organizer: { '@type': 'Person', name: c.author.username } } : {}),
  };
}
