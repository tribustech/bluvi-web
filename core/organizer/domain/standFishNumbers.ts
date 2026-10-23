// «Standuri valorice»: a stand can have its own grid (how many of its heaviest fish count for
// quality) instead of the sector's minFishNumber. Stored per sector as
// standFishNumbers = { [stand documentId]: N }; only stands that differ from the sector are kept.
// The CMS resolves the grid with the same rule (rankings/stand-fish-number.ts); fish keeps the
// twin of this file in helpers/standFishNumbers.ts.

export type StandFishNumbers = Record<string, number>;

export type SectorWithStandGrid = {
  name: string;
  minFishNumber: number;
  standFishNumbers?: StandFishNumbers | null;
};

export const standGrid = (sector: SectorWithStandGrid, standId: string): number => {
  const own = sector.standFishNumbers?.[standId];
  return typeof own === 'number' && Number.isInteger(own) && own > 0 ? own : sector.minFishNumber;
};

const withMap = <S extends SectorWithStandGrid>(sector: S, map: StandFishNumbers): S => {
  const { standFishNumbers: _drop, ...rest } = sector;
  return (Object.keys(map).length > 0 ? { ...rest, standFishNumbers: map } : rest) as S;
};

/** Sets a stand's grid; a value equal to the sector's grid removes the override. */
export const setStandGrid = <S extends SectorWithStandGrid>(sector: S, standId: string, n: number): S => {
  const map = { ...(sector.standFishNumbers ?? {}) };
  if (n === sector.minFishNumber || n < 1) delete map[standId];
  else map[standId] = n;
  return withMap(sector, map);
};

export const clearStandGrids = <S extends SectorWithStandGrid>(sector: S): S => withMap(sector, {});

/** Keeps only overrides of stands allocated to the sector (and still different from its grid). */
export const pruneStandGrids = <S extends SectorWithStandGrid>(
  sectors: S[],
  allocations: Record<string, string[]>,
): S[] =>
  sectors.map(sector => {
    const allowed = new Set(allocations[sector.name] ?? []);
    const map = Object.fromEntries(
      Object.entries(sector.standFishNumbers ?? {}).filter(
        ([standId, n]) => allowed.has(standId) && n !== sector.minFishNumber,
      ),
    );
    return withMap(sector, map);
  });

export const valuedStandCount = (sector: SectorWithStandGrid): number =>
  Object.keys(sector.standFishNumbers ?? {}).length;

/**
 * Display groups for one sector: every stand with its grid, grouped by grid (highest first),
 * stand names in natural order. Empty when the sector has no override.
 */
export const standGridGroups = (
  sector: SectorWithStandGrid & { stands?: { documentId: string; name: string }[] | null },
): { fishNumber: number; standNames: string[] }[] => {
  if (valuedStandCount(sector) === 0) return [];
  const byGrid = new Map<number, string[]>();
  for (const stand of sector.stands ?? []) {
    const n = standGrid(sector, stand.documentId);
    byGrid.set(n, [...(byGrid.get(n) ?? []), stand.name]);
  }
  return [...byGrid.entries()]
    .sort(([a], [b]) => b - a)
    .map(([fishNumber, standNames]) => ({
      fishNumber,
      standNames: standNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    }));
};
