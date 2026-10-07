/*
 * Explorează's place in the URL (partide.exploreaza; T1 rule: a reload, the browser's back from a
 * partidă and a shared link bring the same view back). fish keeps it in local state; the web
 * mirrors it into the query string:
 *   ?live=1                       live-only mode (the LIVE chip / «Vezi toate»)
 *   ?filtru=notificari|prieteni   the «Cu notificări» / «Prieteni» chip (fish chip urmarite / prieteni)
 *   ?loc=lake:<documentId>|water:<linkCode>   the venue filter (the community venue key)
 * Defaults are left out, so the unfiltered page has a clean URL. A hand-edited value that is not
 * one of these is ignored, never an error. Pure: the server page and the client read the same way.
 */

export type ExploreChip = 'active' | 'urmarite' | 'prieteni';

export type ExplorePlace = { liveOnly: boolean; chip: ExploreChip; venueKey: string | null };

export const DEFAULT_PLACE: ExplorePlace = { liveOnly: false, chip: 'active', venueKey: null };

type Params = { get(key: string): string | null };

/** A community venue key with a non-empty id / code («lake:» alone matches nothing). */
export function isVenueKey(value: string | null | undefined): value is string {
  if (!value) return false;
  const m = /^(lake|water):(.+)$/.exec(value);
  return !!m && m[2].trim().length > 0;
}

export function placeFromParams(params: Params): ExplorePlace {
  const filtru = params.get('filtru');
  const loc = params.get('loc');
  return {
    liveOnly: params.get('live') === '1',
    chip: filtru === 'notificari' ? 'urmarite' : filtru === 'prieteni' ? 'prieteni' : 'active',
    venueKey: isVenueKey(loc) ? loc : null,
  };
}

/** The query values for useListUrlState (null = removed). */
export function placeToParams(place: ExplorePlace): Record<string, string | null> {
  return {
    live: place.liveOnly ? '1' : null,
    filtru: place.chip === 'urmarite' ? 'notificari' : place.chip === 'prieteni' ? 'prieteni' : null,
    loc: place.venueKey,
  };
}

export const isDefaultPlace = (p: ExplorePlace) => !p.liveOnly && p.chip === 'active' && p.venueKey === null;

/** fish onEndReached streak guard (c10): auto-loading stops after this many fetches that add no visible row. */
export const EMPTY_FETCH_LIMIT = 3;
