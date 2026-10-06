import 'server-only';
import { connection } from 'next/server';
import * as z from 'zod';
import { competitionListItemSchema } from '@/core/competitions';
import { getLake, getReviewsForLake, type LakeDetail, type Review } from '@/core/lakes';
import { getCommunityVenueSection, type CommunityLakeSectionDTO } from '@/core/partide';
import { paginatedSchema } from '@/core/shared';
import { ApiError, call, type Transport } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';
import { loadCompetition, type LooseCompetitionDetail } from '../../../(site)/concursuri/[id]/_components/load';

/*
 * Real data for the T3 demo, read through core/ from the local CMS (all public, cached reads):
 * the lake page's first screen (fish lakes/[lakeId].tsx) for the QA lake Chita, and a completed
 * Chita competition for the route-tabs variant.
 *
 * Every read is BOUNDED (the server fetches have no timeout of their own — public GETs go through
 * the cached public-get, which takes no AbortSignal):
 *  - the main read (the lake; the competition list + the competition) rejects after
 *    PAGE_TIMEOUT_MS with a timeout error, so a hung CMS ends in the page error with «Încearcă din nou»
 *    instead of an endless skeleton (parity lakes.detail.c2, competition-page «request failed»);
 *  - a 404 from the main read stays an ApiError with status 404: the page turns it into
 *    `notFound()` (isNotFound below), never into the retryable error;
 *  - the secondary sections (Partide, Concursuri, Recenzii) start with the main read but are NOT
 *    awaited with it: they are handed to the page as promises and stream behind their own Suspense
 *    (lakes.detail.c32 — they never block the hero). Each is settled and resolves to «failed»
 *    after SECTION_TIMEOUT_MS, showing its own error with «Încearcă din nou» (fish keeps each
 *    section's query independent); the section nav takes its final list when they land.
 */

/** How long a secondary section may take before it shows its error instead. */
const SECTION_TIMEOUT_MS = 3000;

/** How long the main read may take before the page shows its error (with «Încearcă din nou»). */
export const PAGE_TIMEOUT_MS = 8000;

const TIMEOUT = Symbol('timeout');

/** The main read, bounded: it rejects (a retryable error, not a 404) when the CMS does not answer in time. */
async function mainRead<T>(p: Promise<T>, what: string): Promise<T> {
  const r = await bounded<T | typeof TIMEOUT>(p, PAGE_TIMEOUT_MS, TIMEOUT);
  if (r === TIMEOUT) throw new ApiError({ message: `${what}: timeout`, status: 0, code: 'NETWORK', path: what });
  return r;
}

/** The main read said «no such id»: the page is a not-found, not an error. */
export function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}

/**
 * The main read failed because the session is dead (an authed read answered 401 / SESSION_DEAD):
 * a retry can never succeed — the page offers «Intră din nou» instead (parity competition-page.shell).
 */
export function isSessionDead(e: unknown): boolean {
  return e instanceof ApiError && (e.code === 'SESSION_DEAD' || e.status === 401);
}

/** The QA account's lake (core/README.md «Contract»). */
export const DEMO_LAKE_ID = 's84u55lo4n9z0emngozttt6e';

export type Settled<T> = { ok: true; value: T } | { ok: false };

const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then(
    value => ({ ok: true as const, value }),
    () => ({ ok: false as const }),
  );

/**
 * `p`, or `fallback` if it has not answered within `ms`. `connection()` first (as the site layout's
 * `bounded`): the timer only runs for a real request, never while prerendering.
 */
export async function bounded<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  await connection();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>(resolve => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const section = <T>(p: Promise<T>): Promise<Settled<T>> => bounded(settle(p), SECTION_TIMEOUT_MS, { ok: false });

/**
 * Core gap (same as app/(site)/concursuri/[id]/_components/load.ts): `rankingType` is a strict enum,
 * so one feeder competition on the lake fails the whole list. The demo reads the same public GET
 * with that field loosened; the lake page port should get a tolerant list schema in core.
 */
const looseCompetitionItemSchema = competitionListItemSchema.extend({ rankingType: z.string() });
export type LakeCompetition = z.infer<typeof looseCompetitionItemSchema>;

function lakeCompetitions(t: Transport, lakeId: string, status: 'started' | 'notStarted') {
  // fish LakeCompetitionsSection: useFilteredCompetitions({ status, pagination: { pageSize: 5 }, lakeId }).
  return call(
    t,
    { method: 'GET', path: '/feed/competitions', query: { status, lakeId, page: 1, pageSize: 5 }, auth: 'none' },
    paginatedSchema(looseCompetitionItemSchema),
  ).then(r => r.data);
}

export type LakeCompetitions = { live: LakeCompetition[]; upcoming: LakeCompetition[] };

/** The lake (awaited) and its secondary sections (streamed: settled promises, never rejecting). */
export type LakeScreenData = {
  lake: LakeDetail;
  community: Promise<Settled<CommunityLakeSectionDTO>>;
  /** fish LakeReviewsPreview: the latest two. */
  reviews: Promise<Settled<Review[]>>;
  competitions: Promise<Settled<LakeCompetitions>>;
};

/**
 * Throws when the lake itself cannot be read (the page-level error). Resolves as soon as the lake
 * is read: the sections' reads start at the same time but are returned as promises.
 */
export async function loadLakeScreen(id = DEMO_LAKE_ID): Promise<LakeScreenData> {
  const t = createServerTransport();
  const community = section(getCommunityVenueSection(t, { kind: 'lake', id }));
  const reviews = section(getReviewsForLake(t, id, { page: 1, pageSize: 2 }).then(r => r.data));
  const competitions = section(
    Promise.all([lakeCompetitions(t, id, 'started'), lakeCompetitions(t, id, 'notStarted')]).then(([live, upcoming]) => ({ live, upcoming })),
  );
  const lake = await mainRead(getLake(t, id), `/feed/lakes/${id}`);
  return { lake, community, reviews, competitions };
}

/**
 * The route-tabs variant: the completed Chita competition with the most anglers. Read through the
 * competition page's own loader, which tolerates a ranking type core does not parse yet (every
 * completed local Chita competition is a feeder one): the participants tab does not need it.
 */
export function loadCompetitionScreen(lakeId = DEMO_LAKE_ID): Promise<LooseCompetitionDetail> {
  return mainRead(readCompetitionScreen(lakeId), '/feed/competitions');
}

async function readCompetitionScreen(lakeId: string): Promise<LooseCompetitionDetail> {
  const t = createServerTransport();
  const list = await call(
    t,
    { method: 'GET', path: '/feed/competitions', query: { status: 'completed', lakeId, page: 1, pageSize: 10 }, auth: 'none' },
    paginatedSchema(looseCompetitionItemSchema),
  );
  const pick = [...list.data].sort((a, b) => b.registrations.length - a.registrations.length)[0];
  if (!pick) throw new Error('Nicio competiție încheiată pe balta demo.');
  const load = await loadCompetition(pick.documentId);
  if (load.kind === 'missing') throw new ApiError({ message: 'Not Found', status: 404, code: 'HTTP', path: `/feed/competitions/${pick.documentId}` });
  if (load.kind !== 'ok' && load.kind !== 'unsupported') throw new Error(`Competiția ${pick.documentId}: ${load.kind}`);
  return load.competition;
}
