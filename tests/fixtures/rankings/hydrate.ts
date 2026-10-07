/*
 * The ranking fixtures (tests/fixtures/rankings/<rankingType>.json) are real payloads trimmed to the
 * podium: they keep what decides the ranking and drop what the page does not read for it (ids, the
 * catch lists, the metadata's biggest catch). `hydrateRanking` fills those back in deterministically,
 * so a fixture parses as a full `/competitions/:id/ranking` response (core rankingResponseSchema)
 * and an e2e can answer the browser's ranking read with it (page.route).
 *
 *  - every row: sectorId, a numeric standId (9001, 9002, …), penalties [];
 *  - the catch list fish draws as the 1…N columns: `min(catchCount, sectorMinNumberOfFish)` numbers
 *    for the quality types, `bestOfCount` objects for bestOf, `catchCount` objects for bestOfTiers —
 *    the row's biggest fish first, then 0.5 kg less each;
 *  - metadata: biggestFish and biggestCatch (the heaviest row's stand), bestOf's fish counts and
 *    numberOfWinners, bestOfTiers' tierWinners.
 *
 * Pure (no Node or Playwright import): the spec and a screenshot script both use it.
 */

type Json = Record<string, unknown>;
export type RankingFixture = { source?: string; metadata: Json; rankings: Json[] };

export const STAND_ID_BASE = 9001;

const weights = (biggest: number, n: number): number[] =>
  Array.from({ length: Math.max(0, n) }, (_, k) => Math.max(0.1, Math.round((biggest - k * 0.5) * 1000) / 1000));

export function hydrateRanking(fixture: RankingFixture, options: { numberOfWinners?: number; bestOfFishCount?: number } = {}): RankingFixture {
  const type = String(fixture.metadata.rankingType);
  const rankings = fixture.rankings.map((row, i): Json => {
    const biggest = Number(row.biggestFish ?? 0);
    const catchCount = Number(row.catchCount ?? 0);
    const out: Json = {
      sectorId: `sector-${String(row.sectorName)}`,
      standId: STAND_ID_BASE + i,
      penalties: [],
      participant: null,
      ...row,
    };
    if (type === 'bestOf') out.catches = weights(biggest, Number(row.bestOfCount ?? 0)).map(weight => ({ weight }));
    else if (type === 'bestOfTiers') out.catches = weights(biggest, catchCount).map(weight => ({ weight }));
    else if ('sectorMinNumberOfFish' in row) out.catches = weights(biggest, Math.min(catchCount, Number(row.sectorMinNumberOfFish)));
    if (type === 'calitateCalitate' && out.hasGrid === undefined) out.hasGrid = true;
    return out;
  });

  const heaviest = rankings.reduce<Json | null>((best, r) => (best === null || Number(r.biggestFish) > Number(best.biggestFish) ? r : best), null);
  const metadata: Json = {
    biggestFish: heaviest ? Number(heaviest.biggestFish) : 0,
    biggestCatch: heaviest
      ? {
          participants: [],
          sectorName: heaviest.sectorName,
          standId: heaviest.standId,
          standName: heaviest.standName,
          teamName: heaviest.teamName ?? null,
          guestName: heaviest.guestName ?? null,
          weight: Number(heaviest.biggestFish),
        }
      : null,
    ...fixture.metadata,
  };
  if (type === 'bestOf') {
    const most = Math.max(0, ...rankings.map(r => Number(r.bestOfCount ?? 0)));
    metadata.bestOfFishCount ??= options.bestOfFishCount ?? most;
    metadata.maxBestOfFishCount ??= options.bestOfFishCount ?? most;
    metadata.numberOfWinners ??= options.numberOfWinners ?? 1;
  }
  if (type === 'bestOfTiers') metadata.tierWinners ??= [];
  return { ...fixture, metadata, rankings };
}
