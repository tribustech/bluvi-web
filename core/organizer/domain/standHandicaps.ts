// «Handicap pe stand»: only a percentage of a stand's total kg counts for the ranking's quantity.
// Stored per sector as standHandicaps = { [stand documentId]: percent 1..99 }; a stand missing
// from the map counts 100%. The CMS applies it (rankings/stand-handicap.ts); fish keeps the twin of
// this file in helpers/standHandicaps.ts.

export type StandHandicaps = Record<string, number>;

export type SectorWithStandHandicaps = {
  name: string;
  standHandicaps?: StandHandicaps | null;
};

const HANDICAP_RANKING_TYPES = new Set(['quantity', 'quantityQuality', 'qualityQuantity', 'calitateCantitateCMMC']);

export const supportsStandHandicap = (rankingType?: string | null): boolean =>
  !!rankingType && HANDICAP_RANKING_TYPES.has(rankingType);

/** Stepper granularity in the wizard; the CMS accepts any whole percent. */
export const HANDICAP_STEP = 10;

export const standHandicap = (sector: SectorWithStandHandicaps, standId: string): number => {
  const own = sector.standHandicaps?.[standId];
  return typeof own === 'number' && Number.isInteger(own) && own >= 1 && own < 100 ? own : 100;
};

const withMap = <S extends SectorWithStandHandicaps>(sector: S, map: StandHandicaps): S => {
  const { standHandicaps: _drop, ...rest } = sector;
  return (Object.keys(map).length > 0 ? { ...rest, standHandicaps: map } : rest) as S;
};

/** Sets a stand's percent; 100 (or more) removes the handicap. */
export const setStandHandicap = <S extends SectorWithStandHandicaps>(sector: S, standId: string, percent: number): S => {
  const map = { ...(sector.standHandicaps ?? {}) };
  if (percent >= 100) delete map[standId];
  else map[standId] = Math.max(1, Math.round(percent));
  return withMap(sector, map);
};

export const clearStandHandicaps = <S extends SectorWithStandHandicaps>(sector: S): S => withMap(sector, {});

/** Keeps only handicaps of stands allocated to the sector. */
export const pruneStandHandicaps = <S extends SectorWithStandHandicaps>(
  sectors: S[],
  allocations: Record<string, string[]>,
): S[] =>
  sectors.map(sector => {
    const allowed = new Set(allocations[sector.name] ?? []);
    const map = Object.fromEntries(
      Object.entries(sector.standHandicaps ?? {}).filter(([standId, n]) => allowed.has(standId) && n < 100),
    );
    return withMap(sector, map);
  });

export const handicappedStandCount = (sector: SectorWithStandHandicaps): number =>
  Object.keys(sector.standHandicaps ?? {}).length;

/**
 * Display groups for one sector: handicapped stands grouped by percent (lowest first),
 * stand names in natural order. Empty when the sector has no handicap.
 */
export const standHandicapGroups = (
  sector: SectorWithStandHandicaps & { stands?: { documentId: string; name: string }[] | null },
): { percent: number; standNames: string[] }[] => {
  const byPercent = new Map<number, string[]>();
  for (const stand of sector.stands ?? []) {
    const percent = standHandicap(sector, stand.documentId);
    if (percent < 100) byPercent.set(percent, [...(byPercent.get(percent) ?? []), stand.name]);
  }
  return [...byPercent.entries()]
    .sort(([a], [b]) => a - b)
    .map(([percent, standNames]) => ({
      percent,
      standNames: standNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    }));
};
