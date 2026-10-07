import { formatCount } from '@/core/realtime/chat/format';
import {
  applyHistoryView,
  listItemToSummaryLocalSession,
  sessionVenueName,
  type Aggregate,
  type HistoryEntry,
  type LocalSession,
  type SessionListItemDTO,
} from '@/core/partide';
import type { SearchParams } from '@/lib/search-params';

/*
 * «Istoric partide» as pure derivations (parity partide.istoric): fish app/(app)/partide/istoric.tsx
 * over core historyView / history. The page reads /feed/sessions/mine (every page) summary-only, as
 * fish's usePartideHistory ships it: no local events, so the aggregates map is empty and every card
 * reads the list DTO's summary (core aggForSession).
 */

/** fish PAGE_SIZE: partide rendered per window step (c6). */
export const PAGE_SIZE = 10;

/** fish viewAtoms (partideSortByWeightAtom, partideVenueFilterAtom, partideOnlyWithCapturesAtom). */
export type HistoryFilters = { byWeight: boolean; venues: string[]; withCaptures: boolean };

export const NO_FILTERS: HistoryFilters = { byWeight: false, venues: [], withCaptures: false };

/** The filters from the URL (c8: the web's version of fish's in-memory atoms). */
export function filtersFromParams(sp: SearchParams): HistoryFilters {
  const all = (key: string): string[] => {
    const v = sp[key];
    return v == null ? [] : Array.isArray(v) ? v : [v];
  };
  const venues = Array.from(new Set(all('balti').map(v => v.trim()).filter(Boolean))).slice(0, 50);
  return {
    byWeight: all('sortare')[0] === 'greutate',
    venues,
    withCaptures: all('cu-capturi')[0] === '1',
  };
}

export const filtersKey = (f: HistoryFilters) => JSON.stringify([f.byWeight, f.venues, f.withCaptures]);
export const hasFilters = (f: HistoryFilters) => f.byWeight || f.venues.length > 0 || f.withCaptures;

/** fish venueFilterChipLabel: «Baltă» / the venue / «{n} bălți». */
export function venueChipLabel(venues: string[]): string | null {
  if (venues.length === 0) return null;
  if (venues.length === 1) return venues[0];
  return formatCount(venues.length, 'baltă', 'bălți');
}

export type VenueOption = { value: string; name: string; helper: string; imageUrl: string | null };

/**
 * fish venueOptions (c4): the venues of the FINISHED partide, alphabetical (ro collation); the
 * helper is the first locality seen (newest first), else «{n} partidă / partide». The picture is a
 * capture photo, which a summary-only row never has (fish's rows read the fish glyph too).
 */
export function venueOptions(sessions: LocalSession[], aggregates: Record<string, Aggregate> = {}): VenueOption[] {
  const byVenue = new Map<string, { imageUrl: string | null; locality: string | null; count: number }>();
  for (const s of sessions) {
    if (s.endedAt == null) continue;
    const name = sessionVenueName(s);
    const cur = byVenue.get(name) ?? { imageUrl: null, locality: null, count: 0 };
    cur.count += 1;
    const p = aggregates[s.clientId]?.photoUri;
    if (!cur.imageUrl && p) cur.imageUrl = p;
    if (!cur.locality && s.locality) cur.locality = s.locality;
    byVenue.set(name, cur);
  }
  return Array.from(byVenue.entries())
    .sort((a, b) => a[0].localeCompare(b[0], 'ro'))
    .map(([name, v]) => ({
      value: name,
      name,
      imageUrl: v.imageUrl,
      helper: v.locality ?? formatCount(v.count, 'partidă', 'partide'),
    }));
}

/** The list rows as fish's local sessions, newest start first (fish `sessions`). */
export function toSessions(rows: SessionListItemDTO[]) {
  return rows.map(listItemToSummaryLocalSession).sort((a, b) => b.startedAt - a.startedAt);
}

export type HistorySection = { key: string; title: string | null; entries: HistoryEntry[] };

const NO_AGGREGATES: Record<string, Aggregate> = {};

/**
 * fish `sections` (c2, c3, c5): grouped by month (newest first, newest first inside) or, with
 * «Greutate», one untitled section sorted by record kg descending. Only finished partide; months
 * left empty by the filters are dropped.
 */
export function historySections(sessions: LocalSession[], f: HistoryFilters): HistorySection[] {
  const view = applyHistoryView(sessions, NO_AGGREGATES, {
    sortByWeight: f.byWeight,
    venueFilter: f.venues,
    onlyWithCaptures: f.withCaptures,
  });
  if (view.mode === 'grouped') {
    return view.groups.filter(g => g.entries.length > 0).map(g => ({ key: g.key, title: g.title, entries: g.entries }));
  }
  return view.entries.length > 0 ? [{ key: 'flat', title: null, entries: view.entries }] : [];
}

/**
 * fish windowedRows (c6): the first `count` partide across the sections, in order; a section the
 * window does not reach is left out (never a lone month label).
 */
export function windowSections(sections: HistorySection[], count: number): HistorySection[] {
  const out: HistorySection[] = [];
  let left = count;
  for (const s of sections) {
    if (left <= 0) break;
    const entries = s.entries.slice(0, left);
    left -= entries.length;
    if (entries.length > 0) out.push({ ...s, entries });
  }
  return out;
}

export const entryCount = (sections: HistorySection[]) => sections.reduce((n, s) => n + s.entries.length, 0);
