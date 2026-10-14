import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { cacheLife, cacheTag } from 'next/cache';
import type { NextRequest } from 'next/server';
import { imageQueryString, parseImageQuery } from '../model';
import { planRankingImage, type ImagePlan } from '../plan';
import { imageDateTime, RankingSheet, sheetSize } from './sheet';
import { imageTokens, sponsorLogos } from './inputs';

/*
 * GET /concursuri/<id>/clasament/imagine/png?sortare=&sector=&mansa= — the ranking as a PNG
 * (parity competition-page.imagine-clasament; fish captures RankingTableForScreenshot with
 * react-native-view-shot, the web draws the same sheet with next/og). The query names the table
 * (model.ts), so the file is reproducible from its URL: the viewer page fetches it, and the same URL
 * is what «Descarcă» saves and «Distribuie» shares.
 *
 * Reads: the competition core and its ranking (../plan.ts), both public cached GETs (purged by the
 * CMS's `competition-<id>` tag), each bounded in time; a completed competition's PNG itself is kept
 * on the server under the same tag (drawCompleted). Answers:
 *  - 200 image/png (`x-ranking-image: standard | cn`);
 *  - 200 JSON { reason: EmptyReason } (model.ts) — nothing to draw (fish disables «Vezi full»; the
 *    page normally knows this first and never asks — a 200, so a browser that does logs no error);
 *  - 404 JSON { reason: 'missing' } — no such competition;
 *  - 500 JSON { reason: 'failed' } — a read or the generation failed (the viewer's «Am întâmpinat o eroare!»).
 */

const ASSETS = join(process.cwd(), 'app/(site)/concursuri/[id]/clasament/imagine/_assets');

// Nunito, the site's face, as static instances (Satori reads ttf/otf, not the variable woff2).
const fonts = Promise.all(
  (
    [
      ['Nunito-Regular.ttf', 400],
      ['Nunito-SemiBold.ttf', 600],
      ['Nunito-Bold.ttf', 700],
      ['Nunito-ExtraBold.ttf', 800],
    ] as const
  ).map(async ([file, weight]) => ({ name: 'Nunito', data: await readFile(join(ASSETS, file)), weight, style: 'normal' as const })),
);

const json = (status: number, reason: string) =>
  new Response(JSON.stringify({ reason }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

type Drawn = { ok: true; png: Uint8Array; fileName: string; nc: boolean } | { ok: false };

/** Draws the planned sheet (sponsor logos read now; one that cannot be read is left out). */
async function draw(plan: Extract<ImagePlan, { kind: 'ok' }>, now: string): Promise<Drawn> {
  const { model } = plan;
  try {
    const sponsors = await sponsorLogos(plan.sponsorUrls);
    const { width, height } = sheetSize(model, sponsors.length);
    const response = new ImageResponse(
      <RankingSheet model={model} tokens={await imageTokens} now={now} sponsors={sponsors} width={width} height={height} />,
      { width, height, fonts: await fonts },
    );
    // ImageResponse renders lazily: read it here so a Satori / resvg failure answers 500, not a broken stream.
    return { ok: true, png: new Uint8Array(await response.arrayBuffer()), fileName: model.fileName, nc: model.nc };
  } catch (e) {
    console.error('[imagine-clasament] generation failed', e);
    return { ok: false };
  }
}

/**
 * A completed competition's image, kept on the server until the CMS changes it: drawing a large
 * sheet takes seconds (tens on a cold, busy function), and a completed ranking only changes when the
 * organizer corrects it — the CMS's purge of `competition-<id>` then drops the drawing with the
 * reads it was drawn from, and the next request draws it again. «Exportat la data» (c1, fish stamps
 * the capture moment) is the moment of that drawing: taken inside the cache scope, so it is kept
 * with the image and is not part of the key (a stamp in the key made every minute a new drawing).
 * Keyed by the competition and the normalised query (model.ts imageQueryString of the effective
 * view), so «?sector=Z» and the bare URL share one entry. Failures are returned, never thrown (a
 * thrown error is redacted in production builds), and are not kept.
 */
async function drawCompleted(id: string, query: string): Promise<Drawn> {
  'use cache';
  cacheTag(`competition-${id}`);
  const plan = await planRankingImage(id, parseImageQuery(new URLSearchParams(query)), { faults: false }).catch(() => null);
  const drawn = plan?.kind === 'ok' ? await draw(plan, imageDateTime(new Date().toISOString())) : ({ ok: false } as const);
  if (drawn.ok) cacheLife('weeks');
  else cacheLife('seconds');
  return drawn;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = parseImageQuery(request.nextUrl.searchParams);

  let plan: ImagePlan;
  try {
    plan = await planRankingImage(id, requested);
  } catch (e) {
    // A CMS read failed or timed out (bounded): the viewer's «Am întâmpinat o eroare!» + retry.
    console.error('[imagine-clasament] read failed', e);
    return json(500, 'failed');
  }
  if (plan.kind === 'missing') return json(404, 'missing');
  // Nothing to draw is an answer, not an error: 200 JSON, so a browser that asks logs nothing.
  if (plan.kind === 'empty') return json(200, plan.reason);

  const completed = plan.competition.competitionStatus === 'completed';
  // A live ranking is drawn per request, stamped now (fish «dd MMMM yyyy HH:mm», Bucharest); a completed one is kept.
  const drawn = completed
    ? await drawCompleted(id, imageQueryString(plan.query))
    : await draw(plan, imageDateTime(new Date().toISOString()));
  if (!drawn.ok) return json(500, 'failed');
  return new Response(drawn.png as BodyInit, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      // «Exportat la data …» is the moment it was drawn: a crawler or a reload within a minute shares one drawing.
      'cache-control': 'public, max-age=60',
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(`${drawn.fileName}.png`)}`,
      // The viewer's analytics: fish ranking-image-cn (the club table) logs its own events.
      'x-ranking-image': drawn.nc ? 'cn' : 'standard',
    },
  });
}
