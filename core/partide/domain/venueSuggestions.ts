// Ported from fish `features/partide/helpers/venueSuggestions.ts` (pure).
// Pure builders for the "Începe o partidă" venue suggestions (the nearby → recent → random fallback
// chain). The mode choice and the data fetching live in the start screen (fish
// useVenueSuggestions).
import type { LakeCard, LakeIndexEntry } from '../../lakes/schemas';
import { getLakeLocationSubtitle } from '../../lakes/domain/search';
import type { PublicWaterListItem } from '../../lakes/domain/publicWaters';
import type { SessionListItemDTO } from '../schemas';
import { haversineMeters, type LatLng } from './castGeometry';
import { lakeCardThumb, publicWaterTypeLine, type VenueSelection } from './venueSearch';

/** Render-ready suggestion row: the selectable venue + presentation strings. */
export type VenueSuggestion = {
  key: string;
  selection: VenueSelection;
  subtitle: string | null;
  thumb: string | null;
};

export const MAX_SUGGESTIONS = 5;
const MAX_NEARBY_LAKES = 3;
/** «Folosite recent» shrinks to 3 when it renders below a non-empty «Aproape de tine». */
export const MAX_RECENT_WITH_NEARBY = 3;
/**
 * Past this, "Aproape de tine" is a lie. A coarse or wrong fix (cell tower, indoors, a default
 * position) otherwise fills the section with whatever happens to be least far. Beyond the cap the
 * section goes empty and the caller degrades to recent / random.
 */
export const MAX_NEARBY_KM = 150;
const MAX_NEARBY_M = MAX_NEARBY_KM * 1000;

/** "2,4 km" (Romanian decimal comma, one decimal); under 1 km reads "sub 1 km". */
export function formatDistanceLabel(km: number): string {
  if (km < 1) return 'sub 1 km';
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function joinSubtitle(parts: (string | null)[]): string | null {
  const s = parts.filter(Boolean).join(' · ');
  return s.length ? s : null;
}

/** Coordinate of an index row; null when the payload is stale/malformed. */
function lakeCoord(lake: LakeIndexEntry): LatLng | null {
  if (!Number.isFinite(lake.lat) || !Number.isFinite(lake.lng)) return null;
  return { lat: lake.lat, lng: lake.lng };
}

/**
 * Nearby mode: distance-sort both sources from `origin`, take up to 3 lakes (catalog venues take
 * priority), fill with waters to 5 total, then order the one list by distance. Lakes without usable
 * coordinates are dropped; their coords are seeded into the selection so picking one does not wait
 * on a detail fetch.
 */
export function buildNearbySuggestions(lakes: LakeIndexEntry[], waters: PublicWaterListItem[], origin: LatLng): VenueSuggestion[] {
  const lakeRows = lakes
    .map(lake => ({ lake, coord: lakeCoord(lake) }))
    .filter((e): e is { lake: LakeIndexEntry; coord: LatLng } => e.coord !== null)
    .map(({ lake, coord }) => ({ lake, coord, distanceM: haversineMeters(origin, coord) }))
    .filter(({ distanceM }) => distanceM <= MAX_NEARBY_M)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, MAX_NEARBY_LAKES)
    .map(({ lake, coord, distanceM }): VenueSuggestion & { distanceM: number } => ({
      distanceM,
      key: `lake-${lake.documentId}`,
      selection: { kind: 'lake', lakeId: lake.documentId, name: lake.name, locality: lake.locality, coordinates: coord },
      subtitle: joinSubtitle([lake.locality, formatDistanceLabel(distanceM / 1000)]),
      thumb: lake.thumb ?? null,
    }));

  const waterRows = waters
    .filter((w): w is PublicWaterListItem & { linkCode: string } => w.linkCode !== null)
    .map(w => ({ w, distanceM: haversineMeters(origin, { lat: w.centerLat, lng: w.centerLng }) }))
    .filter(({ distanceM }) => distanceM <= MAX_NEARBY_M)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, Math.max(0, MAX_SUGGESTIONS - lakeRows.length))
    .map(({ w, distanceM }): VenueSuggestion & { distanceM: number } => {
      const typeLabel = publicWaterTypeLine(w);
      return {
        distanceM,
        key: `water-${w.linkCode}`,
        selection: {
          kind: 'publicWater',
          linkCode: w.linkCode,
          name: w.name ?? 'Apă publică',
          typeLabel,
          center: { lat: w.centerLat, lng: w.centerLng },
        },
        subtitle: joinSubtitle([typeLabel, formatDistanceLabel(distanceM / 1000)]),
        thumb: null,
      };
    });

  // Each kind is capped on its own, but the angler reads one list under one heading: order it by
  // distance as a whole.
  return [...lakeRows, ...waterRows]
    .sort((a, b) => a.distanceM - b.distanceM)
    .map(({ key, selection, subtitle, thumb }) => ({ key, selection, subtitle, thumb }));
}

/**
 * The venue fields of a past partidă (fish LocalSession's). The web reads them from the viewer's
 * own list (/feed/sessions/mine, `recentVenueSessionOf`) — fish's TODO(partide-coop) source.
 */
export type RecentVenueSession = {
  venueType: 'lake' | 'publicWater' | 'pin';
  lakeId: string | null;
  lakeName: string | null;
  publicWaterCode: string | null;
  publicWaterName: string | null;
  manualVenueName: string | null;
  locality: string | null;
  anchorLat: number;
  anchorLng: number;
  /** Epoch ms. */
  startedAt: number;
};

/** A row of /feed/sessions/mine as a RecentVenueSession; null without a usable anchor. */
export function recentVenueSessionOf(item: SessionListItemDTO): RecentVenueSession | null {
  if (item.anchorLat == null || item.anchorLong == null) return null;
  const startedAt = Date.parse(item.startedAt);
  if (!Number.isFinite(startedAt)) return null;
  return {
    venueType: item.venueType,
    lakeId: item.lakeId,
    lakeName: item.lakeName,
    publicWaterCode: item.publicWaterCode,
    publicWaterName: item.publicWaterName,
    manualVenueName: item.manualVenueName,
    locality: item.locality,
    anchorLat: item.anchorLat,
    anchorLng: item.anchorLong,
    startedAt,
  };
}

/** Map one past session back to a selectable venue; null when its ref id is gone. */
function sessionToSuggestion(s: RecentVenueSession): VenueSuggestion | null {
  const anchor = { lat: s.anchorLat, lng: s.anchorLng };
  if (s.venueType === 'lake') {
    if (!s.lakeId) return null;
    return {
      key: `lake-${s.lakeId}`,
      selection: { kind: 'lake', lakeId: s.lakeId, name: s.lakeName ?? 'Baltă', locality: s.locality, coordinates: anchor },
      subtitle: s.locality,
      thumb: null,
    };
  }
  if (s.venueType === 'publicWater') {
    if (!s.publicWaterCode) return null;
    return {
      key: `water-${s.publicWaterCode}`,
      selection: { kind: 'publicWater', linkCode: s.publicWaterCode, name: s.publicWaterName ?? 'Apă publică', typeLabel: s.locality ?? '', center: anchor },
      subtitle: s.locality,
      thumb: null,
    };
  }
  return {
    key: `pin-${s.anchorLat.toFixed(4)},${s.anchorLng.toFixed(4)}`,
    selection: { kind: 'pin', coord: anchor, name: s.manualVenueName ?? 'Loc pe hartă' },
    subtitle: s.locality ?? 'Loc pe hartă',
    thumb: null,
  };
}

/**
 * Recent section: newest session first, distinct venues only (by ref key). `exclude` drops venues
 * already shown in the nearby section; `limit` shrinks the section when it renders below nearby
 * (3) vs alone (5).
 */
export function buildRecentSuggestions(sessions: RecentVenueSession[], opts: { exclude?: Set<string>; limit?: number } = {}): VenueSuggestion[] {
  const { exclude, limit = MAX_SUGGESTIONS } = opts;
  const ordered = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  const seen = new Set<string>();
  const out: VenueSuggestion[] = [];
  for (const s of ordered) {
    const suggestion = sessionToSuggestion(s);
    if (!suggestion || seen.has(suggestion.key) || exclude?.has(suggestion.key)) continue;
    seen.add(suggestion.key);
    out.push(suggestion);
    if (out.length >= limit) break;
  }
  return out;
}

/** Random mode: Fisher–Yates over the fetched page (injectable RNG for tests), max 5. */
export function buildRandomSuggestions(lakes: LakeCard[], random: () => number = Math.random): VenueSuggestion[] {
  const pool = [...lakes];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, MAX_SUGGESTIONS).map(lake => {
    const locality = getLakeLocationSubtitle(lake, { includeAddress: false });
    return {
      key: `lake-${lake.documentId}`,
      selection: { kind: 'lake', lakeId: lake.documentId, name: lake.name, locality, coordinates: null },
      subtitle: locality,
      thumb: lakeCardThumb(lake),
    };
  });
}

/**
 * The three sections from their sources (fish useVenueSuggestions `applySections`): nearby from the
 * origin (none without one), recent below it (3 when nearby has rows, else 5, nearby's venues
 * excluded), random only when both are empty.
 */
export function buildVenueSections(input: {
  nearby: VenueSuggestion[];
  sessions: RecentVenueSession[];
  randomPool: LakeCard[];
  random?: () => number;
}): { nearby: VenueSuggestion[]; recent: VenueSuggestion[]; random: VenueSuggestion[] } {
  const { nearby } = input;
  const recent = buildRecentSuggestions(input.sessions, {
    exclude: new Set(nearby.map(s => s.key)),
    limit: nearby.length > 0 ? MAX_RECENT_WITH_NEARBY : MAX_SUGGESTIONS,
  });
  const random = nearby.length === 0 && recent.length === 0 ? buildRandomSuggestions(input.randomPool, input.random) : [];
  return { nearby, recent, random };
}
