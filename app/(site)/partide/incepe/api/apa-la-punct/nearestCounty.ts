import { countyDisplayName } from '../../../../ape-publice/_server/countyNames';

/*
 * fish features/public-waters/queries.ts#nearestCountyTo, verbatim: the county of the nearest water
 * centre over the WHOLE table (`WHERE county IS NOT NULL`, plain degree distance, no cosLat weight),
 * so a pin gets the same «Jud. {county}» — and stores the same locality — as in the app. Not
 * `nearestWatersTo` (that one keeps only linked waters and weights longitude), which can miss a
 * county the app finds or pick the neighbour near a border. The name leaves through
 * `countyDisplayName`, like every county the web shows (diacritics).
 */

export const NEAREST_COUNTY_SQL = `SELECT county FROM fishing_waters
 WHERE county IS NOT NULL
 ORDER BY (center_lat - ?) * (center_lat - ?) + (center_lng - ?) * (center_lng - ?)
 LIMIT 1`;

/** The slice of node:sqlite's DatabaseSync this needs (a test passes an in-memory one). */
export interface CountyDb {
  prepare(sql: string): { get(...params: number[]): unknown };
}

export function nearestCountyTo(db: CountyDb, lat: number, lng: number): string | null {
  const row = db.prepare(NEAREST_COUNTY_SQL).get(lat, lat, lng, lng) as { county: string | null } | undefined;
  return countyDisplayName(row?.county ?? null);
}
