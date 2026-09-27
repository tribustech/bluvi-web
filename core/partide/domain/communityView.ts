// Ported from fish `features/partide/community/view.ts` (pure).
/**
 * Pure view helpers for the Partide community dashboard — chip filtering and
 * Romanian time/label formatting. No React, no I/O.
 */
import { fmtKg } from './format';
import type {
  CommunityHistorySessionDTO,
  CommunityMemberDTO,
  CommunityRecordDTO,
  CommunitySessionDetailCatchDTO,
  CommunitySessionDetailDTO,
  CommunityVenueDTO,
  StatsPeriod,
} from '../schemas';

export interface FilterVenuesOptions {
  chip: 'active' | 'urmarite' | 'prieteni';
  followedSessionIds: Set<string>;
  followedAnglerUids: Set<string>;
  venueKeys?: string[] | null;
}

/**
 * Narrows the venue list to the given venueKeys (if any given — null/empty means
 * all), then filters each venue's sessions according to the selected chip:
 * - 'active': no session-level filtering.
 * - 'urmarite': keep sessions the user follows (by documentId).
 * - 'prieteni': keep sessions with at least one followed angler among members.
 * Venues left with zero surviving sessions are dropped entirely.
 */
export function filterVenues(venues: CommunityVenueDTO[], opts: FilterVenuesOptions): CommunityVenueDTO[] {
  const { chip, followedSessionIds, followedAnglerUids, venueKeys } = opts;
  const narrowed = venueKeys && venueKeys.length > 0 ? venues.filter(v => venueKeys.includes(v.key)) : venues;

  return narrowed
    .map(v => {
      const sessions =
        chip === 'urmarite'
          ? v.sessions.filter(s => followedSessionIds.has(s.documentId))
          : chip === 'prieteni'
            ? v.sessions.filter(s => s.members.some(m => followedAnglerUids.has(m.uid)))
            : v.sessions;
      return sessions === v.sessions ? v : { ...v, sessions };
    })
    .filter(v => v.sessions.length > 0);
}

export interface FilterHistoryRowsOptions {
  chip: FilterVenuesOptions['chip'];
  followedSessionIds: Set<string>;
  followedAnglerUids: Set<string>;
  venueKeys?: string[] | null;
}

/**
 * Narrows the (already-loaded) history feed rows the same way `filterVenues`
 * narrows live venues — same chip semantics ('active' = untouched, 'urmarite'
 * = documentId ∈ followedSessionIds, 'prieteni' = a member uid ∈
 * followedAnglerUids), plus an optional venueKeys narrowing. Rows are flat
 * (one per finished session, not grouped by venue like `CommunityVenueDTO`),
 * so — unlike `filterVenues` — there is no "drop an emptied venue" step.
 */
export function filterHistoryRows(
  rows: CommunityHistorySessionDTO[],
  opts: FilterHistoryRowsOptions
): CommunityHistorySessionDTO[] {
  const { chip, followedSessionIds, followedAnglerUids, venueKeys } = opts;
  const narrowed = venueKeys && venueKeys.length > 0 ? rows.filter(r => venueKeys.includes(r.venue.key)) : rows;

  if (chip === 'urmarite') return narrowed.filter(r => followedSessionIds.has(r.documentId));
  if (chip === 'prieteni') return narrowed.filter(r => r.members.some(m => followedAnglerUids.has(m.uid)));
  return narrowed;
}

/**
 * Which query the "Explorează" scene's single `onEndReached` should page
 * (spec 2026-07-28 addendum: bounding the live feed). One FlashList, one
 * `onEndReached` — this is the pure branching rule behind it, extracted so
 * the mode-switch itself is unit-testable without mounting the scene or
 * mocking react-query:
 * - `liveOnly` (the `LiveChip`'s "Vezi toate" destination): pages LIVE.
 *   `ÎNCHEIATE` is hidden entirely in this mode, so history never needs paging.
 * - default mode: pages HISTORY, same as before live pagination existed. The
 *   default view only ever renders live page 1 (see `CommunityScene`), so
 *   there's nothing to page on the live side here.
 * - `'none'` when the relevant query has no further page — the caller no-ops.
 */
export type EndReachedTarget = 'live' | 'history' | 'none';

export function endReachedTarget(opts: {
  liveOnly: boolean;
  liveHasNextPage: boolean;
  historyHasNextPage: boolean;
}): EndReachedTarget {
  if (opts.liveOnly) return opts.liveHasNextPage ? 'live' : 'none';
  return opts.historyHasNextPage ? 'history' : 'none';
}

/** A venue selected in the Explorează "Filtrează după baltă" picker — the key
 * feeds `/feed/community/active|history` and the name labels the filter chip
 * (the name must travel with the key: a lake picked via global search may have
 * zero live sessions, so its name is not resolvable from the live feed). */
export interface SelectedVenue {
  key: string;
  name: string;
}

/**
 * Maps a catalog lake (card DTO) to a community venue selection. Key format
 * mirrors the CMS's `venueKeyOf`: `lake:<lakeDocumentId>`. Returns null
 * without a documentId — a key of `lake:` would match nothing server-side.
 */
export function lakeCardToVenue(lake: { documentId?: string | null; name: string }): SelectedVenue | null {
  if (!lake.documentId) return null;
  return { key: `lake:${lake.documentId}`, name: lake.name };
}

/**
 * Maps a bundled public water (ANAR SQLite row) to a community venue selection.
 * Key format mirrors the CMS's `venueKeyOf`: `water:<publicWaterCode>`, where
 * the code the app persists on sessions is the water's `linkCode` (see
 * `venueSearch.ts`'s start-flow selection). Waters without a linkCode have no
 * stable ref and cannot be filtered on — returns null, same as the start flow
 * excluding them from selection.
 */
export function publicWaterToVenue(water: { linkCode: string | null; name: string | null }): SelectedVenue | null {
  if (!water.linkCode) return null;
  return { key: `water:${water.linkCode}`, name: water.name ?? 'Apă publică' };
}

/**
 * Whether the "ÎN DIRECT" section header — and with it the `Vezi toate`
 * escape hatch — should render (review round 2, Important 2). Without this,
 * the header was only emitted when `filteredLiveCount > 0`; a chip filter
 * ('Cu notificări' / 'Pescari urmăriți') that empties page 1 would then hide
 * the ONLY way to reach the rest of the live feed (`Vezi toate` → `liveOnly`),
 * even when a match exists on page 2+ — the escape hatch hid itself exactly
 * when it was needed. Rendering the header whenever there's a further live
 * page — regardless of whether the current page's filtered rows are empty —
 * keeps that path open; `hasMoreLivePages` (server-reported, chip-independent)
 * is what decides whether there's anywhere further to escape to at all.
 */
export function shouldShowLiveHeader(filteredLiveCount: number, hasMoreLivePages: boolean): boolean {
  return filteredLiveCount > 0 || hasMoreLivePages;
}

/** Acasă dashboard's live-partide rail caps (task 14, spec 2026-07-27). */
export const DASHBOARD_LIVE_CAP = 5;
export const DASHBOARD_FINISHED_FALLBACK_CAP = 3;

export type DashboardPartideSection =
  | { kind: 'live'; venues: CommunityVenueDTO[] }
  | { kind: 'finished'; rows: CommunityHistorySessionDTO[] }
  | { kind: 'empty' };

/**
 * Decides what the Acasă dashboard's middle rail shows: up to
 * `DASHBOARD_LIVE_CAP` live venues when any exist, else the
 * `DASHBOARD_FINISHED_FALLBACK_CAP` most recent finished sessions, else
 * empty. Live and finished can never both render — `finished` is only ever
 * computed from `historyRows` when `live` came back empty, so the return
 * type's single-variant discriminated union makes "both non-empty" a
 * non-representable state, not just an untested one.
 */
export function buildDashboardPartideSection(
  venues: CommunityVenueDTO[],
  historyRows: CommunityHistorySessionDTO[]
): DashboardPartideSection {
  const live = venues.slice(0, DASHBOARD_LIVE_CAP);
  if (live.length > 0) return { kind: 'live', venues: live };

  const finished = historyRows.slice(0, DASHBOARD_FINISHED_FALLBACK_CAP);
  if (finished.length > 0) return { kind: 'finished', rows: finished };

  return { kind: 'empty' };
}

/** "acum 8m" / "acum 2h" / "acum 3z" — coarsest-fitting unit for a past ISO timestamp. */
export function relativeRo(nowMs: number, iso: string): string {
  const diffMs = Math.max(0, nowMs - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `acum ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `acum ${hours}h`;
  const days = Math.floor(hours / 24);
  return `acum ${days}z`;
}

/** "de 2h 14m" / "de 45m" / "de 2h" (no minutes suffix when the remainder is 0). */
export function elapsedRo(nowMs: number, startedIso: string): string {
  const diffMs = Math.max(0, nowMs - new Date(startedIso).getTime());
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `de ${minutes}m`;
  if (minutes === 0) return `de ${hours}h`;
  return `de ${hours}h ${minutes}m`;
}

/**
 * Compact sibling of `elapsedRo` for space-constrained layouts — "de 45m"
 * under an hour same as `elapsedRo`, but drops the minutes remainder once
 * hours ≥ 1 ("de 22h" / "de 2h", never "de 2h 14m"). Used by the session
 * detail's duration stat tile, where the full remainder wraps the tile.
 */
export function elapsedRoCompact(nowMs: number, startedIso: string): string {
  const diffMs = Math.max(0, nowMs - new Date(startedIso).getTime());
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `de ${minutes}m`;
  return `de ${hours}h`;
}

/**
 * "Radu P." (1) | "Tu și Radu" (2) | "Mihai, Dan și Ionuț" (3+) — joins member
 * names with "și" before the last. Falls back to a "N pescari" / "1 pescar"
 * count whenever any member is missing a usable name.
 */
export function membersLabel(members: CommunityMemberDTO[]): string {
  const names = members.map(m => m.name).filter((n): n is string => !!n && n.trim().length > 0);

  if (names.length !== members.length) {
    const n = members.length;
    return n === 1 ? '1 pescar' : `${n} pescari`;
  }

  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} și ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} și ${names[names.length - 1]}`;
}

/** First given name for a compact label — "Andrei Munteanu" → "Andrei"; null/blank → "Pescar". */
export function firstNameOf(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : 'Pescar';
}

/** "Radu Popescu" → "RP", single word → its first letter, null/blank → "?". */
export function initialsOf(name: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
}

const AVATAR_COLORS = ['#F59E0B', '#14B8A6', '#8B5CF6', '#0EA5E9', '#EC4899', '#22C55E'] as const;

/** Deterministic avatar background color for a given uid — same uid always maps to the same color. */
export function avatarColorFor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── "Statistici comunitate" / "Clasamente" (stats-proposal mock) helpers ──

const RANK_COLORS: Record<number, string> = { 1: '#F59E0B', 2: '#94A3B8', 3: '#B45309' };

/** Medal color for ranks 1–3 (gold/silver/bronze-ish, per the stats-proposal mock's `.rk.g/.s/.b`); null for rank ≥4 (default gray text). */
export function rankColor(rank: number): string | null {
  return RANK_COLORS[rank] ?? null;
}

const RECORD_TAG: Record<StatsPeriod, string> = {
  week: 'RECORDUL SĂPTĂMÂNII',
  month: 'RECORDUL LUNII',
  year: 'RECORDUL ANULUI',
};

/** "RECORDUL LUNII" / "RECORDUL SĂPTĂMÂNII" / "RECORDUL ANULUI" — the stats hero-card tag for the selected period. */
export function recordTagFor(period: StatsPeriod): string {
  return RECORD_TAG[period];
}

const PERIOD_PHRASE: Record<StatsPeriod, string> = {
  week: 'săptămâna asta',
  month: 'luna asta',
  year: 'anul asta',
};

/** "săptămâna asta" / "luna asta" / "anul asta" — used by the Clasamente "Tu" pill copy. */
export function periodPhraseFor(period: StatsPeriod): string {
  return PERIOD_PHRASE[period];
}

/**
 * Total weighed kg of a session's catch list (null-weight catches skipped),
 * rounded to 2 decimals to hide float-addition noise. Null when nothing is
 * weighed — the stats tile shows "—" instead of a misleading 0.
 */
export function sessionTotalKg(catches: { weightKg: number | null }[]): number | null {
  const weighed = catches.map(c => c.weightKg).filter((w): w is number => w != null);
  if (weighed.length === 0) return null;
  return Math.round(weighed.reduce((a, b) => a + b, 0) * 100) / 100;
}

/**
 * The catch to feature in the "cea mai mare captură" highlight card: first
 * catch whose weight equals the session's maxKg. Null when nothing is weighed
 * (maxKg null) or when maxKg is stale and matches no catch (edge-cached
 * detail) — the card is simply not rendered then.
 */
export function maxCatch<T extends { weightKg: number | null }>(catches: T[], maxKg: number | null): T | null {
  if (maxKg == null) return null;
  return catches.find(c => c.weightKg != null && c.weightKg === maxKg) ?? null;
}

/** One tile of the Recorduri 2×2 grid (D1): a real record, an indigo invitation, or the Statistici CTA. */
export type RecordSlot =
  | { kind: 'record'; record: CommunityRecordDTO }
  | { kind: 'invite'; window: CommunityRecordDTO['window'] }
  | { kind: 'stats' };

const RECORD_WINDOW_ORDER: CommunityRecordDTO['window'][] = ['today', 'week', 'month'];

/**
 * D1 fixed slots: always 4 tiles — today/week/month (record or invitation)
 * plus the Statistici CTA. Empty windows never collapse the grid, so the
 * "AZI dispare noaptea" failure mode is gone by construction.
 *
 * Photoless records degrade to the invite tile: the CMS already excludes them
 * (photo is a record eligibility condition), but dashboard responses are
 * edge-cached, so an old-shaped payload can arrive for up to the cache TTL
 * after that deploy — this guard covers the interim.
 */
export function buildRecordSlots(records: CommunityRecordDTO[]): RecordSlot[] {
  const slots: RecordSlot[] = RECORD_WINDOW_ORDER.map(window => {
    const record = records.find(r => r.window === window && (r.photoGridUrl ?? r.photoUrl) != null);
    return record ? { kind: 'record', record } : { kind: 'invite', window };
  });
  slots.push({ kind: 'stats' });
  return slots;
}

/**
 * Route for a session's venue: lake detail when a lakeId exists, public-water
 * detail when a publicWater venue carries its ANAR code, null otherwise
 * (pins, code-less waters, older CMS deploys without the venueType fields).
 */
export function venueHref(v: {
  venueType?: 'lake' | 'publicWater' | 'pin';
  lakeId: string | null;
  publicWaterCode?: string | null;
}): string | null {
  if (v.lakeId) return `/lakes/${v.lakeId}`;
  if (v.venueType === 'publicWater' && v.publicWaterCode) return `/public-waters/${v.publicWaterCode}`;
  return null;
}

export type WeightSegment = { key: string; label: string; weightKg: number; fraction: number };

/**
 * Per-SPECIES segments for the total-card stacked bar: weighed catches summed
 * by species (species-less under "Captură"), sorted desc, top 3 species, the
 * rest collapsed into one "altele" segment. Fractions sum to 1. Empty when
 * nothing is weighed.
 */
export function buildWeightSegments(
  catches: { clientId: string; species: string | null; weightKg: number | null }[]
): WeightSegment[] {
  const bySpecies = new Map<string, number>();
  for (const c of catches) {
    if ((c.weightKg ?? 0) <= 0) continue;
    const key = c.species?.trim() || 'Captură';
    bySpecies.set(key, (bySpecies.get(key) ?? 0) + (c.weightKg as number));
  }
  if (bySpecies.size === 0) return [];
  const sorted = [...bySpecies.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((t, [, kg]) => t + kg, 0);
  const head = sorted.slice(0, 3).map(([species, kg]) => ({
    key: species,
    label: `${species} ${fmtKg(kg)}`,
    weightKg: kg,
    fraction: kg / total,
  }));
  const rest = sorted.slice(3);
  if (rest.length === 0) return head;
  const restKg = rest.reduce((t, [, kg]) => t + kg, 0);
  return [...head, { key: '__rest__', label: 'altele', weightKg: restKg, fraction: restKg / total }];
}

/** Session detail's derived stats/segments/featured-catch/lightbox view — single source, computed from the slim detail DTO. */
export type SessionView = {
  totalKg: number | null;
  segments: WeightSegment[];
  avgKg: number | null;
  weighedCount: number;
  /** shape buildEvolutionLineSeries consumes */
  evolutionInput: { weightKg: number; species: string | null; occurredAt: string }[];
  featuredCatch: CommunitySessionDetailCatchDTO | null;
  /** photos + featuredCatch appended when photo-bearing and absent (dedupe clientId) */
  lightboxCatches: CommunitySessionDetailCatchDTO[];
  photoCount: number;
};

/**
 * Derives the session-detail screen's stats card, evolution chart input,
 * featured-catch highlight, and lightbox gallery — all from the slim
 * `weighedCatches`/`maxCatch`/`photos` fields the server now sends, rather
 * than re-deriving them client-side from the (now capped-at-10) `catches`
 * list. The `?? []`/`?? null`/`?? 0` below are type-narrowing for the
 * same-branch transition, not behavioral fallbacks — every field is required
 * on `CommunitySessionDetailDTO`.
 */
export function deriveSessionView(detail: CommunitySessionDetailDTO): SessionView {
  const weighed = detail.weighedCatches ?? [];
  const asCatches = weighed.map((w, i) => ({ clientId: `w${i}`, species: w.species, weightKg: w.kg }));
  const totalKg = sessionTotalKg(asCatches);
  const weighedCount = weighed.length;
  const featuredCatch = detail.maxCatch ?? null;
  const photos = detail.photos ?? [];
  const lightboxCatches =
    featuredCatch?.photoUrl && !photos.some(p => p.clientId === featuredCatch.clientId)
      ? [...photos, featuredCatch]
      : photos;
  return {
    totalKg,
    segments: buildWeightSegments(asCatches),
    avgKg: totalKg != null && weighedCount > 0 ? totalKg / weighedCount : null,
    weighedCount,
    evolutionInput: weighed.map(w => ({ weightKg: w.kg, species: w.species, occurredAt: w.t })),
    featuredCatch,
    lightboxCatches,
    photoCount: detail.photoCount ?? 0,
  };
}
