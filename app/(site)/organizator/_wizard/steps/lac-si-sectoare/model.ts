import type { LakeCard } from '@/core/lakes';
import type { SearchSelectOption } from '@/components/forms/searchSelect';
import { SECTOR_LETTERS } from '@/components/ranking/sector';

/*
 * Pure half of step «Lac și sectoare» (parity organizer.step-lake-sectors; fish
 * app/(app)/create-competition/step-lake-sectors.tsx + components/SectorBuilder.tsx), unit-tested
 * in model.test.ts.
 */

export type SectorConfig = { name: string; minFishNumber: number };

/* ------------------------------------------------------------------ */
/* Lake picker — fish step-lake-sectors.tsx:63-98                      */
/* ------------------------------------------------------------------ */

/**
 * c3 — without a search term: the organizer's recent lakes first (in their recency order), then the
 * rest by name (Romanian, case- and accent-insensitive: fish localeCompare 'ro', sensitivity base).
 * With a term the server's order is kept.
 */
export function orderLakes<T extends { documentId: string; name: string }>(
  lakes: readonly T[],
  recentIds: readonly string[],
  search: string,
): T[] {
  if (search) return [...lakes];
  const at = new Map(recentIds.map((id, i) => [id, i]));
  return [...lakes].sort((a, b) => {
    const ra = at.get(a.documentId);
    const rb = at.get(b.documentId);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return String(a.name).localeCompare(String(b.name), 'ro', { sensitivity: 'base' });
  });
}

/** The lake's first photo, small format first (fish getImageFormat(images[0])). */
export function lakePhoto(lake: { images?: readonly { url: string; smallUrl?: string | null; mediumUrl?: string | null }[] | null } | null | undefined): string | null {
  const img = lake?.images?.[0];
  return img ? (img.smallUrl ?? img.mediumUrl ?? img.url ?? null) : null;
}

/** c4 — «oraș, județ» (fish: cityRef, then countyRef or the legacy county text). */
export function lakePlace(lake: Pick<LakeCard, 'cityRef' | 'countyRef' | 'county'>): string {
  return [lake.cityRef?.name, lake.countyRef?.name ?? lake.county].filter((s): s is string => Boolean(s && s.trim())).join(', ');
}

export type LakeOption = SearchSelectOption & { lake: LakeCard };

/**
 * c4 — one picker row: the photo as a square avatar, the name, «oraș, județ»; the current lake
 * selected + disabled (= fixed: the check mark, read «…, selectat» once — no separate reason tag).
 */
export function lakeOption(lake: LakeCard, currentId: string | undefined): LakeOption {
  const place = lakePlace(lake);
  const current = lake.documentId === currentId;
  return {
    id: lake.documentId,
    label: lake.name,
    ...(place ? { helper: place } : {}),
    avatar: { name: lake.name, src: lakePhoto(lake), square: true },
    disabled: current,
    selected: current,
    lake,
  };
}

/* ------------------------------------------------------------------ */
/* Sectors — fish components/SectorBuilder.tsx                         */
/* ------------------------------------------------------------------ */

/** A..X: 24 sectors at most (the CMS's [A-X] name regex and max(24)). */
export const SECTOR_NAMES = SECTOR_LETTERS;

/** c9 — the next sector, named after the count (A, B, C…), min fish 1; unchanged at the maximum. */
export function addSector(sectors: readonly SectorConfig[], max: number): SectorConfig[] {
  const name = SECTOR_NAMES[sectors.length];
  if (sectors.length >= max || !name) return [...sectors];
  return [...sectors, { name, minFishNumber: 1 }];
}

/** c11 — drop one sector and rename the rest A, B, C… in order. */
export function removeSector(sectors: readonly SectorConfig[], index: number): SectorConfig[] {
  return sectors.filter((_, i) => i !== index).map((s, i) => ({ ...s, name: SECTOR_NAMES[i] }));
}

/** c11 — the removal asks «Ștergi sectorul?» first when the sector's min fish was changed from 1. */
export function removalNeedsConfirm(sector: SectorConfig | undefined, showMinFish: boolean): boolean {
  return Boolean(sector) && showMinFish && sector!.minFishNumber !== 1;
}

/** c10 — the typed value: digits only, empty = 0 (fish updateMinFish). */
export function parseMinFish(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}

/** c10 — − / + : never below 0. */
export function stepMinFish(sectors: readonly SectorConfig[], index: number, delta: number): SectorConfig[] {
  return sectors.map((s, i) => (i === index ? { ...s, minFishNumber: Math.max(0, (s.minFishNumber ?? 0) + delta) } : s));
}

export function setMinFish(sectors: readonly SectorConfig[], index: number, value: number): SectorConfig[] {
  return sectors.map((s, i) => (i === index ? { ...s, minFishNumber: value } : s));
}

/** c12 — keep only the allocations of sectors that still exist. */
export function keepAllocations(allocations: Record<string, string[]> | undefined, sectors: readonly SectorConfig[]): Record<string, string[]> {
  const names = new Set(sectors.map(s => s.name));
  const out: Record<string, string[]> = {};
  for (const [name, stands] of Object.entries(allocations ?? {})) if (names.has(name)) out[name] = stands;
  return out;
}

/** c7 — the participants limit is above the lake's stands (only once the stands are known). */
export function exceedsStands(participantsLimit: string | undefined, standCount: number | null): boolean {
  if (standCount == null || standCount === 0 || !participantsLimit) return false;
  return Number(participantsLimit) > standCount;
}
