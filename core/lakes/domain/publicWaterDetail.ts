import { publicWaterLocationLabel, type PublicWaterDetail, type PublicWaterListItem, type PublicWaterType } from './publicWaters';

/*
 * Pure logic of the public-water screens (detail page, list sheet, search, county filter) —
 * fish features/public-waters/{routeParam, publicWaterDetailLogic, recentSearches,
 * PublicWaterDetailCard, PublicWatersSheet, PublicWatersSearch, PublicWaterCountyFilter} and
 * app/(app)/(tabs)/lakes/index.tsx (the «NOU» gate).
 */

// ── routeParam.ts ───────────────────────────────────────────────────────────────────────────

export type PublicWaterRouteParam = { kind: 'id'; id: number } | { kind: 'code'; code: string };

/**
 * A positive safe integer is the bundled row id; anything else (trimmed) is the stable ANAR link
 * code («R:RO11_01.018_R1»); an empty value resolves to nothing (not found, no lookup).
 */
export function parsePublicWaterRouteParam(input: string | string[] | undefined | null): PublicWaterRouteParam | null {
  const raw = Array.isArray(input) ? input[0] : input;
  const value = raw?.trim();
  if (!value) return null;
  if (/^[1-9]\d*$/.test(value)) {
    const id = Number(value);
    if (Number.isSafeInteger(id) && id > 0) return { kind: 'id', id };
  }
  return { kind: 'code', code: value };
}

// ── labels (PublicWaterDetailCard / PublicWatersSheet / [id].tsx) ───────────────────────────

export const PUBLIC_WATER_TYPE_LABEL: Record<PublicWaterType, string> = {
  river: 'Râu',
  natural_lake: 'Lac natural',
  reservoir_lake: 'Lac de acumulare',
  coastal_lake: 'Lac costier',
  transitional_lake: 'Apă de tranziție',
};

/** The list rows' badge: «Râu» or «Lac». */
export function publicWaterTypeBadge(type: PublicWaterType): string {
  return type === 'river' ? 'Râu' : 'Lac';
}

/** fish: a nameless ANAR row reads «Apă publică». */
export function publicWaterName(water: { name: string | null }): string {
  return water.name?.trim() || 'Apă publică';
}

/** «Lac de acumulare · Ilfov» / «Râu · 12 județe». */
export function publicWaterSubtitle(water: { type: PublicWaterType; county: string | null; countyIds: number[] }): string {
  return [PUBLIC_WATER_TYPE_LABEL[water.type], publicWaterLocationLabel(water)].filter(Boolean).join(' · ');
}

/** fish PublicWatersSheet row meta: «<location> · <N ha>». */
export function publicWaterRowMeta(water: { type: PublicWaterType; county: string | null; countyIds: number[]; areaKm2: number | null }): string {
  const area = water.areaKm2 != null && water.areaKm2 > 0 ? `${Math.round(water.areaKm2 * 100).toLocaleString('ro-RO')} ha` : null;
  return [publicWaterLocationLabel(water), area].filter(Boolean).join(' · ');
}

/** «Cele mai mari ape din zonă»: surface area descending, rivers (no area) last. Stable. */
export function sortWatersByArea<T extends { areaKm2: number | null }>(waters: ReadonlyArray<T>): T[] {
  return [...waters].sort((a, b) => (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0));
}

/** «1 apă» / «12 ape». */
export function watersCountLabel(n: number): string {
  return `${n} ${n === 1 ? 'apă' : 'ape'}`;
}

/** The list sheet's title (fish LakesResultsWithMap). */
export function publicWatersListTitle({
  band,
  count,
  loading,
}: {
  band: 'clusters' | 'geometry';
  count: number;
  loading: boolean;
}): string {
  if (band === 'clusters') return count ? 'Cele mai mari ape din zonă' : 'Nicio apă în această zonă';
  if (loading && count === 0) return 'Se încarcă…';
  return `${watersCountLabel(count)} în această zonă`;
}

// ── detail facts / sections ─────────────────────────────────────────────────────────────────

export type PublicWaterFact = { key: string; label: string; value: string };

/** fish [id].tsx «Detalii»: each fact only when present; none → the block hides. */
export function publicWaterFacts(water: Pick<PublicWaterDetail, 'basin' | 'areaKm2' | 'volumeMilM3' | 'elevationM' | 'euCode'>): PublicWaterFact[] {
  const facts: PublicWaterFact[] = [];
  if (water.basin) facts.push({ key: 'basin', label: 'Bazin hidrografic', value: water.basin });
  if (water.areaKm2) facts.push({ key: 'area', label: 'Suprafață', value: `${water.areaKm2.toFixed(2)} km²` });
  if (water.volumeMilM3) facts.push({ key: 'volume', label: 'Volum', value: `${water.volumeMilM3.toFixed(0)} mil. m³` });
  if (water.elevationM) facts.push({ key: 'elevation', label: 'Altitudine', value: `${water.elevationM.toFixed(0)} m` });
  if (water.euCode) facts.push({ key: 'euCode', label: 'Cod corp de apă', value: water.euCode });
  return facts;
}

export type PublicWaterSectionId = 'prezentare' | 'partide' | 'capturi' | 'locatie';

export const PUBLIC_WATER_SECTION_LABEL: Record<PublicWaterSectionId, string> = {
  prezentare: 'Prezentare',
  partide: 'Partide',
  capturi: 'Capturi',
  locatie: 'Locație',
};

/**
 * fish buildPublicWaterSectionChips: Prezentare, Partide (partide activity), Capturi (≥1 photo
 * catch OR server species counts — either justifies the section), Locație.
 */
export function buildPublicWaterSectionChips({
  hasPartide,
  hasCatches,
  hasSpecies = false,
}: {
  hasPartide: boolean;
  hasCatches: boolean;
  hasSpecies?: boolean;
}): PublicWaterSectionId[] {
  return ['prezentare', ...(hasPartide ? (['partide'] as const) : []), ...(hasCatches || hasSpecies ? (['capturi'] as const) : []), 'locatie'];
}

/** fish PublicWaterSpeciesChips: most-caught first (server order), 6 chips then «+N». */
export const SPECIES_CHIPS_MAX = 6;
export function speciesChips<T extends { species: string; count: number }>(species: ReadonlyArray<T> | null | undefined): { shown: T[]; rest: number } {
  if (!species?.length) return { shown: [], rest: 0 };
  const shown = species.slice(0, SPECIES_CHIPS_MAX);
  return { shown, rest: species.length - shown.length };
}

/** «Județ» / «Județe (3)». */
export function countiesHeading(n: number): string {
  return n === 1 ? 'Județ' : `Județe (${n})`;
}

// ── recentSearches.ts ───────────────────────────────────────────────────────────────────────

export const RECENT_PUBLIC_WATERS_KEY = 'recent_public_water_searches';
export const RECENT_PUBLIC_WATERS_MAX = 8;

/** Rows only (no geometry), newest first, de-duplicated by id, max 8. */
export function pushRecentPublicWater(current: ReadonlyArray<PublicWaterListItem>, water: PublicWaterListItem): PublicWaterListItem[] {
  const row: PublicWaterListItem = {
    id: water.id,
    name: water.name,
    type: water.type,
    county: water.county,
    countyId: water.countyId,
    countyIds: water.countyIds,
    centerLat: water.centerLat,
    centerLng: water.centerLng,
    linkCode: water.linkCode,
    areaKm2: water.areaKm2,
  };
  return [row, ...current.filter((w) => w.id !== water.id)].slice(0, RECENT_PUBLIC_WATERS_MAX);
}

/** Parse what a device stored (anything unreadable is an empty list). */
export function parseRecentPublicWaters(raw: string | null | undefined): PublicWaterListItem[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((w): w is PublicWaterListItem => !!w && typeof w === 'object' && typeof (w as { id?: unknown }).id === 'number')
      .slice(0, RECENT_PUBLIC_WATERS_MAX);
  } catch {
    return [];
  }
}

// ── search + county filter ──────────────────────────────────────────────────────────────────

/** fish PublicWatersSearch sections: «Râuri» then «Lacuri», empty groups dropped. */
export function groupSearchResults<T extends { type: PublicWaterType }>(results: ReadonlyArray<T>): { title: 'Râuri' | 'Lacuri'; items: T[] }[] {
  const rivers = results.filter((r) => r.type === 'river');
  const lakes = results.filter((r) => r.type !== 'river');
  return [
    ...(rivers.length ? [{ title: 'Râuri' as const, items: rivers }] : []),
    ...(lakes.length ? [{ title: 'Lacuri' as const, items: lakes }] : []),
  ];
}

/**
 * fish searchPublicWaters ordering (SQL ORDER BY): names starting with the term first, then
 * shorter names, then by name. Matching is name OR county, case-insensitive.
 */
export function rankSearchResults<T extends { name: string | null; county: string | null }>(rows: ReadonlyArray<T>, term: string, limit = 40): T[] {
  const q = term.trim().toLowerCase();
  if (q.length < 2) return [];
  const name = (r: T) => (r.name ?? '').toLowerCase();
  return rows
    .filter((r) => name(r).includes(q) || (r.county ?? '').toLowerCase().includes(q))
    .sort((a, b) => {
      const pa = name(a).startsWith(q) ? 0 : 1;
      const pb = name(b).startsWith(q) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (name(a).length !== name(b).length) return name(a).length - name(b).length;
      return (a.name ?? '').localeCompare(b.name ?? '');
    })
    .slice(0, limit);
}

/** Diacritic- and case-insensitive (county names carry diacritics; people may type without). */
export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** fish PublicWaterCountyFilter: named counties, filtered by the term (diacritic-insensitive). */
export function filterCounties<T extends { name: string | null }>(counties: ReadonlyArray<T>, term: string): T[] {
  const withNames = counties.filter((c) => c.name);
  const q = normalizeForSearch(term.trim());
  if (!q) return withNames;
  return withNames.filter((c) => normalizeForSearch(c.name as string).includes(q));
}

/** «Aplică (3)» / «Aplică». */
export function countyApplyLabel(n: number): string {
  return n > 0 ? `Aplică (${n})` : 'Aplică';
}

// ── «NOU» badge on the Ape publice toggle ───────────────────────────────────────────────────

/** fish lakes/index.tsx: the red «NOU» badge shows only while now < 2026-09-06 (no persistence). */
export const PUBLIC_WATERS_NEW_BADGE_UNTIL = Date.UTC(2026, 8, 6);
export function showPublicWatersNewBadge(nowMs: number): boolean {
  return nowMs < PUBLIC_WATERS_NEW_BADGE_UNTIL;
}

// ── directions (components/NavigationSheet.tsx) ─────────────────────────────────────────────

/** Google Maps (dir api, driving) and Waze (navigate=yes) to the water's centre point. */
export function directionsLinks(lat: number | null | undefined, lng: number | null | undefined): { google: string; waze: string; apple: string } | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving&dir_action=navigate`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes&z=10`,
    // fish opens `maps:` on iOS; the web equivalent is the Apple Maps universal link.
    apple: `https://maps.apple.com/?q=${lat},${lng}`,
  };
}

/** fish NavigationSheet's toast when a water has no usable coordinates. */
export const DIRECTIONS_UNAVAILABLE = 'Coordonatele nu sunt disponibile. Vă rugăm să folosiți una din celelalte opțiuni.';
