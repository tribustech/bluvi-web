import type { NextRequest } from 'next/server';
import { parseImageQuery, type RankingImageModel } from '../model';
import { planRankingImage, type ImagePlan } from '../plan';
import { imageTokens, sponsorLogos } from '../png/inputs';
import { imageDateTime, sheetSize } from '../png/sheet';
import type { ImageTokens } from '../png/tokens';

/*
 * GET /concursuri/<id>/clasament/imagine/data?sortare=&sector=&mansa= — what ../png draws, as JSON,
 * for the browser to draw the same sheet itself (DownloadRankingButton): drawing a large sheet with
 * Satori takes seconds on the server (tens on a cold function), the browser lays it out in about
 * one. Nothing is drawn here: the plan (../plan.ts, the PNG route's own reads and query rules), the
 * tokens and the sponsor logos (data URLs read on the server, so the browser's canvas is never
 * tainted by the CMS's host). Answers as ../png does:
 *  - 200 RankingImageData;
 *  - 200 JSON { reason: EmptyReason } — nothing to draw;
 *  - 404 JSON { reason: 'missing' }; 500 JSON { reason: 'failed' }.
 */

export type RankingImageData = {
  model: RankingImageModel;
  tokens: ImageTokens;
  /** Sponsor logos as data URLs (one that could not be read is left out). */
  sponsors: string[];
  /** The PNG's size in pixels (png/sheet.tsx sheetSize, SCALE× the 1× layout). */
  width: number;
  height: number;
  /** Without the extension (the PNG route's `filename`). */
  fileName: string;
  /** «Exportat la data …»: the moment of this answer, at the minute, Bucharest. */
  now: string;
};

const json = (status: number, reason: string) =>
  new Response(JSON.stringify({ reason }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requested = parseImageQuery(request.nextUrl.searchParams);

  let plan: ImagePlan;
  try {
    plan = await planRankingImage(id, requested);
  } catch (e) {
    console.error('[imagine-clasament] data read failed', e);
    return json(500, 'failed');
  }
  if (plan.kind === 'missing') return json(404, 'missing');
  if (plan.kind === 'empty') return json(200, plan.reason);

  try {
    const sponsors = await sponsorLogos(plan.sponsorUrls);
    const { width, height } = sheetSize(plan.model, sponsors.length);
    const data: RankingImageData = {
      model: plan.model,
      tokens: await imageTokens,
      sponsors,
      width,
      height,
      fileName: plan.model.fileName,
      now: imageDateTime(new Date().toISOString()),
    };
    // The stamp is the moment of the answer, as a live PNG's: never kept.
    return Response.json(data, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    console.error('[imagine-clasament] data failed', e);
    return json(500, 'failed');
  }
}
