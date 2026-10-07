import { aleMeleRows } from './partide-ale-mele.fixtures';

/*
 * The QA user's own-sessions list for «Istoric partide» (/partide/istoric), served at /api/cms by
 * the Ale mele mocks (./partide-ale-mele.fixtures mockMine: /feed/sessions/mine, the hub probe, the
 * Firestore fake). Absolute dates, so the months read the same on every run and every clock; rows
 * in the toSessionListItemDTO shape. Nothing is created or written anywhere.
 */

const base = aleMeleRows().F1;

type RowOpts = {
  start: string;
  hours?: number | null;
  captures: number;
  recordKg: number | null;
  totalKg?: number | null;
  lake?: string | null;
  water?: string | null;
  locality?: string | null;
  img?: boolean;
};

/** One /feed/sessions/mine row (finished unless `hours` is null). */
export function historyRow(id: string, { start, hours = 5, captures, recordKg, totalKg = recordKg, lake = null, water = null, locality = null, img = true }: RowOpts) {
  const startedAt = new Date(start);
  return {
    ...base,
    documentId: id,
    clientId: `client-${id}`,
    venueType: water ? 'publicWater' : 'lake',
    lakeId: lake ? `lake-${lake}` : null,
    lakeName: lake,
    lakeImageUrl: lake && img ? base.lakeImageUrl : null,
    publicWaterCode: water ? 'DUN-1' : null,
    publicWaterName: water,
    locality,
    standName: null,
    startedAt: startedAt.toISOString(),
    endedAt: hours == null ? null : new Date(startedAt.getTime() + hours * 3_600_000).toISOString(),
    status: hours == null ? 'active' : 'finished',
    visibleOnProfile: true,
    captures,
    recordKg,
    totalKg,
  };
}

/**
 * Four months (Sep, Aug, Jul, May 2026), five venues (one a public water, one starting with «Ă» for
 * the ro collation), two partide without a capture and one still open (never listed).
 */
export function historyRows() {
  const SEP_20 = historyRow('sep-20', { start: '2026-09-20T05:00:00Z', captures: 6, recordKg: 12.35, totalKg: 41.2, lake: 'Balta Chita', locality: 'Ilfov' });
  const SEP_05 = historyRow('sep-05', { start: '2026-09-05T05:00:00Z', captures: 3, recordKg: 8.4, totalKg: 19.1, lake: 'Lacul Snagov' });
  const AUG_14 = historyRow('aug-14', { start: '2026-08-14T05:00:00Z', captures: 0, recordKg: null, totalKg: null, lake: 'Balta Dridu', img: false });
  const AUG_02 = historyRow('aug-02', { start: '2026-08-02T05:00:00Z', captures: 2, recordKg: 4, totalKg: 5, lake: 'Balta Chita', locality: 'Ilfov' });
  const JUL_18 = historyRow('jul-18', { start: '2026-07-18T05:00:00Z', captures: 1, recordKg: 15.6, totalKg: 15.6, water: 'Dunărea' });
  const MAY_30 = historyRow('may-30', { start: '2026-05-30T05:00:00Z', captures: 0, recordKg: null, totalKg: null, lake: 'Ălești' });
  /** Still open (no end): never in the history (c2). */
  const OPEN = historyRow('open', { start: '2026-09-28T05:00:00Z', hours: null, captures: 1, recordKg: 2, lake: 'Balta Deschisă' });
  // The list's own order is not the page's (the page sorts): shuffled on purpose.
  const ALL = [AUG_14, SEP_05, OPEN, MAY_30, SEP_20, JUL_18, AUG_02];
  return { SEP_20, SEP_05, AUG_14, AUG_02, JUL_18, MAY_30, OPEN, ALL };
}

/** `n` finished partide, one a day back from 30 September 2026 (the window, c6). */
export function manyRows(n: number) {
  return Array.from({ length: n }, (_, i) =>
    historyRow(`many-${i}`, {
      start: new Date(Date.UTC(2026, 8, 30, 5) - i * 86_400_000).toISOString(),
      captures: i % 3 === 0 ? 0 : 2,
      recordKg: i % 3 === 0 ? null : 3 + (i % 7),
      lake: i % 2 ? 'Balta Chita' : 'Lacul Snagov',
    }),
  );
}
