import 'server-only';
import { getRankings, type CompetitionDetail, type RankingResponse } from '@/core/competitions';
import { isApiError } from '@/core/transport';
import { createServerTransport } from '@/lib/server/transport';
import { bounded, loadCompetition } from '../../_components/load';
import { e2eFault } from './e2e-faults';
import { buildRankingImage, effectiveImageQuery, type EmptyReason, type ImageQuery, type RankingImageModel } from './model';
import { sheetGeometry, type SheetGeometry } from './png/sheet';

/*
 * What the ranking image of a view is, decided once on the server — shared by the page (which then
 * renders «nothing to draw» without ever requesting the PNG, and reserves the sheet's shape for the
 * skeleton), its metadata (the Open Graph image only when there is one) and png/route.tsx (which
 * draws it).
 *
 *  - `missing`: no such competition;
 *  - `empty`: nothing to draw (model.ts EmptyReason); fish keeps «Vezi full» disabled then;
 *  - `ok`: the model and the sponsor logos to read.
 * Every answer but `missing` carries the EFFECTIVE query (model.ts effectiveImageQuery): what is
 * drawn, so the band, the canonical and the PNG's URL never name a view the image does not show.
 * A transient failure (a CMS read that fails or times out) throws: the caller decides.
 */

export type { EmptyReason };

export type ImagePlan =
  | { kind: 'missing' }
  | { kind: 'empty'; reason: EmptyReason; query: ImageQuery }
  | { kind: 'ok'; competition: CompetitionDetail; model: RankingImageModel; sponsorUrls: string[]; query: ImageQuery };

/** `faults: false` inside a `'use cache'` scope (png/route.tsx): a dev-only e2e fault must never fill the cache. */
export async function planRankingImage(id: string, requested: ImageQuery, { faults = true } = {}): Promise<ImagePlan> {
  const load = await loadCompetition(id);
  if (load.kind === 'missing') return { kind: 'missing' };
  if (load.kind !== 'ok') {
    const query = load.kind === 'unsupported' ? effectiveImageQuery(load.competition, requested) : requested;
    return { kind: 'empty', reason: 'unsupported', query };
  }
  const competition = load.competition;
  const query = effectiveImageQuery(competition, requested);

  let ranking: RankingResponse | null = null;
  if (competition.competitionStatus !== 'notStarted') {
    try {
      if (faults) await e2eFault(id, 'ranking');
      // Bounded as the competition read: a hung CMS must end in «failed» (with its retry), never an endless skeleton.
      ranking = await bounded(getRankings(createServerTransport(), id), `/feed/competitions/${id}/rankings`);
    } catch (e) {
      if (isApiError(e) && e.code === 'INVALID_RESPONSE') return { kind: 'empty', reason: 'unsupported', query };
      throw e;
    }
  }

  const built = buildRankingImage(
    { ...competition, sponsors: competition.sponsors.map(s => ({ documentId: s.documentId, name: s.name, image: s.image })) },
    ranking,
    query,
  );
  if (!built.ok) return { kind: 'empty', reason: built.reason, query };
  return {
    kind: 'ok',
    competition,
    model: built.model,
    sponsorUrls: competition.sponsors.flatMap(s => (s.image?.url ? [s.image.url] : [])),
    query,
  };
}

/** The PNG's size and blocks before it is drawn (a logo that cannot be read is left out, so the height is the upper bound). */
export function plannedSheet(plan: Extract<ImagePlan, { kind: 'ok' }>): SheetGeometry {
  return sheetGeometry(plan.model, plan.sponsorUrls.length);
}
