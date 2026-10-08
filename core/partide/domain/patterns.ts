// Ported from fish `features/partide/helpers/patterns.ts` (pure).
/**
 * Cross-session pattern aggregations (Tipare) — the ONLY implementation
 * (no server twin; spec §2 deviation). All pure.
 */
import { BAIT_TYPE_LABELS } from './baitTaxonomy';
import { haversineMeters } from './castGeometry';
import { distanceBand } from './stats';
import type { LocalEvent, LocalSession, VenueRef } from './types';
import { ANCHOR_RADIUS_M } from './venueRef';

const isBite = (e: { outcome: string }) => e.outcome !== 'blank';

export const MIN_CYCLES_TO_QUALIFY = 3;
export const RECENCY_HALF_LIFE_DAYS = 90;
const HOT_ZONE_RADIUS_M = 15;
const DAY_MS = 86_400_000;

export type ScopedEvents = { venueEvents: LocalEvent[]; anchorEvents: LocalEvent[]; sessionCount: number };

export function scopeEvents(
  sessions: LocalSession[],
  events: LocalEvent[],
  venue: VenueRef,
  anchor?: { lat: number; lng: number },
): ScopedEvents {
  const byId = new Map(sessions.map(s => [s.clientId, s]));
  const near = (s: LocalSession, ref: { lat: number; lng: number }) =>
    haversineMeters({ lat: s.anchorLat, lng: s.anchorLng }, ref) <= ANCHOR_RADIUS_M;

  if (venue.venueType === 'lake') {
    const venueSessions = sessions.filter(s => s.lakeId === venue.lakeId);
    const ids = new Set(venueSessions.map(s => s.clientId));
    const venueEvents = events.filter(e => ids.has(e.sessionClientId));
    const anchorEvents = anchor
      ? venueEvents.filter(e => {
          const s = byId.get(e.sessionClientId);
          return !!s && near(s, anchor);
        })
      : [];
    return { venueEvents, anchorEvents, sessionCount: venueSessions.length };
  }

  const ref = venue.venueType === 'pin' ? venue.anchor : anchor;
  const matchCode = venue.venueType === 'publicWater' ? venue.publicWaterCode : null;
  const venueSessions = sessions.filter(s =>
    matchCode ? s.publicWaterCode === matchCode && (!ref || near(s, ref)) : !!ref && near(s, ref),
  );
  const ids = new Set(venueSessions.map(s => s.clientId));
  const venueEvents = events.filter(e => ids.has(e.sessionClientId));
  return { venueEvents, anchorEvents: venueEvents, sessionCount: venueSessions.length };
}

const recencyWeight = (occurredAt: number, now: number) => 0.5 ** ((now - occurredAt) / DAY_MS / RECENCY_HALF_LIFE_DAYS);

// Grouping identity: the angler's free-text bait name (what they actually typed,
// e.g. a boilie brand) is the primary key — trimmed + lowercased so casing
// variants ("Tigernut" vs "tigernut") collapse into one group. Only when no
// name was typed do we fall back to the structured taxonomy (baitType+baitSize),
// and finally to 'altele'. This also stops stale/drifted taxonomy from splitting
// a named bait into the wrong bucket.
const taxonomyKeyOf = (e: LocalEvent) => (e.baitType ? `${e.baitType}${e.baitSize ? `:${e.baitSize}` : ''}` : 'altele');
const taxonomyLabelOf = (e: LocalEvent) =>
  e.baitType
    ? `${(BAIT_TYPE_LABELS as Record<string, string>)[e.baitType] ?? e.baitType}${e.baitSize ? ` ${e.baitSize}` : ''}`
    : 'Necunoscută';

const baitKeyOf = (e: LocalEvent) => {
  const name = e.bait.trim();
  return name ? name.toLowerCase() : taxonomyKeyOf(e);
};
// Label uses the name as typed by the first occurrence in the group (preserving
// casing), falling back to the taxonomy label when no name was given.
const baitLabelOf = (e: LocalEvent) => {
  const name = e.bait.trim();
  return name || taxonomyLabelOf(e);
};

function bandOf(e: LocalEvent, anchor?: { lat: number; lng: number }): string {
  if (anchor && e.lat != null && e.lng != null) {
    return distanceBand(haversineMeters(anchor, { lat: e.lat, lng: e.lng }));
  }
  return distanceBand(e.distance);
}

export type ComboRow = {
  baitKey: string;
  baitLabel: string;
  band: string;
  captures: number;
  avgKg: number | null;
  maxKg: number | null;
  weightedScore: number;
};

export function computeCombos(events: LocalEvent[], now: number, anchor?: { lat: number; lng: number }): ComboRow[] {
  const groups = new Map<string, { events: LocalEvent[]; baitKey: string; baitLabel: string; band: string }>();
  for (const e of events) {
    const baitKey = baitKeyOf(e);
    const band = bandOf(e, anchor);
    const key = `${baitKey}|${band}`;
    const g = groups.get(key) ?? { events: [], baitKey, baitLabel: baitLabelOf(e), band };
    g.events.push(e);
    groups.set(key, g);
  }

  const rows: ComboRow[] = [];
  for (const g of groups.values()) {
    if (g.events.length < MIN_CYCLES_TO_QUALIFY) continue;
    const captures = g.events.filter(e => e.outcome === 'capture');
    const kgs = captures.map(c => c.weightKg).filter((w): w is number => w != null);
    rows.push({
      baitKey: g.baitKey,
      baitLabel: g.baitLabel,
      band: g.band,
      captures: captures.length,
      avgKg: kgs.length ? kgs.reduce((a, b) => a + b, 0) / kgs.length : null,
      maxKg: kgs.length ? Math.max(...kgs) : null,
      weightedScore: captures.reduce((sum, c) => sum + recencyWeight(c.occurredAt, now), 0),
    });
  }
  return rows.sort((a, b) => b.weightedScore - a.weightedScore || (b.avgKg ?? 0) - (a.avgKg ?? 0));
}

export type BaitRankRow = {
  baitKey: string;
  baitLabel: string;
  captures: number;
  avgKg: number | null;
  maxKg: number | null;
};

/**
 * «Clasament momeli» — ranks baits by the results they produced, aggregated on
 * the angler's own bait name only (distance is deliberately NOT part of the
 * identity: a bait's performance is what matters, not the exact metre it sat
 * at). Only landed captures count, and every bait that caught at least one fish
 * is listed — there is no minimum-cycle bar here (unlike computeCombos, whose
 * band-level combos need statistical mass to be trustworthy).
 */
export function computeBaitRanking(events: LocalEvent[]): BaitRankRow[] {
  const groups = new Map<string, { baitKey: string; baitLabel: string; captures: LocalEvent[] }>();
  for (const e of events) {
    if (e.outcome !== 'capture') continue;
    const baitKey = baitKeyOf(e);
    const g = groups.get(baitKey) ?? { baitKey, baitLabel: baitLabelOf(e), captures: [] };
    g.captures.push(e);
    groups.set(baitKey, g);
  }

  const rows: BaitRankRow[] = [];
  for (const g of groups.values()) {
    const kgs = g.captures.map(c => c.weightKg).filter((w): w is number => w != null);
    rows.push({
      baitKey: g.baitKey,
      baitLabel: g.baitLabel,
      captures: g.captures.length,
      avgKg: kgs.length ? kgs.reduce((a, b) => a + b, 0) / kgs.length : null,
      maxKg: kgs.length ? Math.max(...kgs) : null,
    });
  }
  return rows.sort((a, b) => b.captures - a.captures || (b.maxKg ?? 0) - (a.maxKg ?? 0));
}

export type ArrivalRecap = {
  bestBait: string | null;
  bestBand: string | null;
  bestHours: string | null;
  spatialLine: string | null;
  sessionCount: number;
};

export function computeArrivalRecap(scoped: ScopedEvents, now: number): ArrivalRecap {
  const { venueEvents, anchorEvents, sessionCount } = scoped;
  if (!venueEvents.length) {
    return { bestBait: null, bestBand: null, bestHours: null, spatialLine: null, sessionCount };
  }

  const combos = computeCombos(venueEvents, now);
  const best = combos[0] ?? null;

  // Densest 3-hour band of bites.
  const byHour = eventHeatmapByHour(venueEvents);
  let bestStart = 0;
  let bestSum = -1;
  for (let h = 0; h < 24; h++) {
    const sum = byHour[h] + byHour[(h + 1) % 24] + byHour[(h + 2) % 24];
    if (sum > bestSum) {
      bestSum = sum;
      bestStart = h;
    }
  }
  const bestHours =
    bestSum > 0 ? `${String(bestStart).padStart(2, '0')}:00–${String((bestStart + 3) % 24).padStart(2, '0')}:00` : null;

  let spatialLine: string | null = null;
  if (anchorEvents.length >= MIN_CYCLES_TO_QUALIFY) {
    const anchorCombos = computeCombos(anchorEvents, now);
    if (anchorCombos[0]) spatialLine = `Din standul tău: ${anchorCombos[0].band}`;
  }

  return { bestBait: best?.baitLabel ?? null, bestBand: best?.band ?? null, bestHours, spatialLine, sessionCount };
}

export type HotZone = { lat: number; lng: number; count: number; radiusM: number } | null;

export function computeHotZone(events: LocalEvent[]): HotZone {
  const bites = events.filter(e => isBite(e) && e.lat != null && e.lng != null);
  if (bites.length < 3) return null;
  let best: { lat: number; lng: number; count: number } | null = null;
  for (const center of bites) {
    const count = bites.filter(
      b => haversineMeters({ lat: center.lat!, lng: center.lng! }, { lat: b.lat!, lng: b.lng! }) <= HOT_ZONE_RADIUS_M,
    ).length;
    if (!best || count > best.count) best = { lat: center.lat!, lng: center.lng!, count };
  }
  return best && best.count >= 3 ? { ...best, radiusM: HOT_ZONE_RADIUS_M } : null;
}

export type TripStats = {
  captures: number;
  recordKg: number | null;
  totalKg: number;
  capturesPerHour: number | null; // null while elapsedMs === 0
  bestRodIndex: number | null; // most captures; ties → lower index
  dominantSpecies: string | null;
  capturesByRod: Record<number, number>;
};

export function computeTripStats(events: LocalEvent[], elapsedMs: number): TripStats {
  const captures = events.filter(e => e.outcome === 'capture');
  const kgs = captures.map(c => c.weightKg).filter((w): w is number => w != null);
  const byRod: Record<number, number> = {};
  const bySpecies: Record<string, number> = {};
  for (const c of captures) {
    if (c.rodIndex !== null) byRod[c.rodIndex] = (byRod[c.rodIndex] ?? 0) + 1;
    if (c.species) bySpecies[c.species] = (bySpecies[c.species] ?? 0) + 1;
  }
  const bestRod = Object.entries(byRod).sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]))[0];
  const domSpecies = Object.entries(bySpecies).sort((a, b) => b[1] - a[1])[0];
  return {
    captures: captures.length,
    recordKg: kgs.length ? Math.max(...kgs) : null,
    totalKg: kgs.reduce((a, b) => a + b, 0),
    capturesPerHour: elapsedMs > 0 ? captures.length / (elapsedMs / 3_600_000) : null,
    bestRodIndex: bestRod ? Number(bestRod[0]) : null,
    dominantSpecies: domSpecies?.[0] ?? null,
    capturesByRod: byRod,
  };
}

/**
 * The 24 h heatmap of fish's Statistici scene (and usePatterns' `heatmapByHour`): every non-blank
 * event (capture + lost) counted by its local hour of day. Same count as `computeHourHeatmap`
 * (stats.ts), typed for the LocalEvent the scenes hold.
 */
export function eventHeatmapByHour(events: Pick<LocalEvent, 'outcome' | 'occurredAt'>[]): number[] {
  const hours = new Array<number>(24).fill(0);
  for (const e of events) if (isBite(e)) hours[new Date(e.occurredAt).getHours()] += 1;
  return hours;
}

/**
 * fish domain/hooks.ts `usePatterns` (the memo body): the venue scope of the Statistici scene from
 * the sessions + events at hand. The hook read them from the live store; the caller passes them.
 */
export function computeVenuePatterns(
  sessions: LocalSession[],
  events: LocalEvent[],
  venue: VenueRef,
  anchor: { lat: number; lng: number } | undefined,
  now: number,
): { recap: ArrivalRecap; combos: ComboRow[]; baitRanking: BaitRankRow[]; heatmapByHour: number[]; eventCount: number } {
  const scoped = scopeEvents(sessions, events, venue, anchor);
  return {
    // Web: how many events the venue scope holds (the «not enough data» state of the web scene).
    eventCount: scoped.venueEvents.length,
    recap: computeArrivalRecap(scoped, now),
    combos: computeCombos(scoped.venueEvents, now, anchor),
    baitRanking: computeBaitRanking(scoped.venueEvents),
    heatmapByHour: eventHeatmapByHour(scoped.venueEvents),
  };
}
