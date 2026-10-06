import 'server-only';
import { connection } from 'next/server';
import * as z from 'zod';
import { competitionListItemSchema } from '@/core/competitions';
import { getLake, type LakeDetail } from '@/core/lakes';
import { paginatedSchema } from '@/core/shared';
import { ApiError, call } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';
import { loadCompetition, type LooseCompetitionDetail } from '../../../(site)/concursuri/[id]/_components/load';
import { loadLakeSections, type LakeSections } from '../../../(site)/balti/[id]/_components/load';

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
 *  - the lake's secondary sections are the real route's (loadLakeSections): settled, bounded
 *    promises that stream behind their own Suspense (lakes.detail.c32).
 */

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

/**
 * Core gap (same as app/(site)/concursuri/[id]/_components/load.ts): `rankingType` is a strict enum,
 * so one feeder competition on the lake fails the whole list. The demo reads the same public GET
 * with that field loosened; the lake page port should get a tolerant list schema in core.
 */
const looseCompetitionItemSchema = competitionListItemSchema.extend({ rankingType: z.string() });
/**
 * The lake (awaited, bounded) and the REAL route's section reads (/balti/[id] loadLakeSections:
 * settled promises, streamed) — the demo renders the route's own LakeScreen, so what the owner
 * reviews here is what ships.
 */
export type LakeScreenData = { lake: LakeDetail; sections: LakeSections };

/** Throws when the lake itself cannot be read (the page-level error). */
export async function loadLakeScreen(id = DEMO_LAKE_ID): Promise<LakeScreenData> {
  const t = createServerTransport();
  const sections = loadLakeSections(id);
  const lake = await mainRead(getLake(t, id), `/feed/lakes/${id}`);
  return { lake, sections };
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
