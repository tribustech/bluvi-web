/*
 * Pure logic of the «Alocă standuri» step (parity organizer.step-stand-allocation; fish
 * app/(app)/create-competition/step-stand-allocation.tsx + components/StandAllocator.tsx).
 */

export type AllocatableStand = {
  documentId: string;
  name: string;
  performanceScore?: number | null;
  competitionsCount?: number | null;
};

/** sector name → stand documentIds (the form's `standAllocations`). */
export type Allocations = Record<string, string[]>;

/** fish PERF_LABELS, best first: the lowest percentile each level starts at. */
export const PERF_LEVELS = [
  { key: 'top', min: 0.75, text: 'Foarte bun', hint: 'top 25% din standuri' },
  { key: 'good', min: 0.5, text: 'Bun', hint: 'top 50%' },
  { key: 'mid', min: 0.25, text: 'Mediu', hint: 'sub medie' },
  { key: 'low', min: 0, text: 'Slab', hint: 'ultimele 25%' },
] as const;

export type PerfLevel = (typeof PERF_LEVELS)[number];
export type PerfKey = PerfLevel['key'];

/** c4: the lake's stands by name, numerically («2» before «10»), as fish sorts them. */
export function sortStands<T extends { name?: string | null }>(stands: readonly T[]): T[] {
  return [...stands].sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { numeric: true }));
}

/** The sector a stand is allocated to, or null. */
export function standSector(allocations: Allocations, standId: string): string | null {
  for (const [sector, ids] of Object.entries(allocations)) {
    if (ids.includes(standId)) return sector;
  }
  return null;
}

/** How many stands each sector holds (the tab badges). */
export function sectorCount(allocations: Allocations, sector: string): number {
  return allocations[sector]?.length ?? 0;
}

export type ToggleResult = { kind: 'changed'; allocations: Allocations } | { kind: 'refused'; sector: string } | { kind: 'ignored' };

/**
 * c5 (fish handleToggleStand): a free stand joins the selected sector, one of the selected sector's
 * stands leaves it, a stand of another sector is refused (the toast names that sector). Without a
 * selected sector nothing happens.
 */
export function toggleStand(allocations: Allocations, selectedSector: string | null, standId: string): ToggleResult {
  if (!selectedSector) return { kind: 'ignored' };
  const other = Object.entries(allocations).find(([sector, ids]) => sector !== selectedSector && ids.includes(standId))?.[0];
  if (other) return { kind: 'refused', sector: other };
  const current = allocations[selectedSector] ?? [];
  const next = current.includes(standId) ? current.filter((id) => id !== standId) : [...current, standId];
  return { kind: 'changed', allocations: { ...allocations, [selectedSector]: next } };
}

/** c5: the refusal toast. */
export const refusedMessage = (sector: string) => `Standul este deja alocat sectorului ${sector}.`;

/**
 * c6 (fish perfLabels): only stands with past competitions and a score are ranked; with fewer than
 * two there is nothing to compare and no stand gets a label. Rank i of n (best first) has the
 * percentile 1 − i / (n − 1) and takes the first level whose `min` it reaches.
 */
export function perfLevels(stands: readonly AllocatableStand[]): Record<string, PerfLevel> {
  const scored = stands.filter((s) => s.competitionsCount && s.performanceScore != null);
  if (scored.length < 2) return {};
  const sorted = [...scored].sort((a, b) => (b.performanceScore ?? 0) - (a.performanceScore ?? 0));
  const out: Record<string, PerfLevel> = {};
  sorted.forEach((stand, i) => {
    const percentile = 1 - i / (sorted.length - 1);
    const level = PERF_LEVELS.find((l) => percentile >= l.min);
    if (level) out[stand.documentId] = level;
  });
  return out;
}

export type EmptyReason = 'no-lake' | 'no-sectors' | 'no-stands';

/** c2: why the allocator cannot show (fish's order: lake, then sectors, then stands), or null. */
export function emptyReason(hasLake: boolean, sectorCount: number, standCount: number): EmptyReason | null {
  if (!hasLake) return 'no-lake';
  if (sectorCount === 0) return 'no-sectors';
  if (standCount === 0) return 'no-stands';
  return null;
}

export const EMPTY_COPY: Record<EmptyReason, string> = {
  'no-lake': 'Selectează un lac în pasul anterior.',
  'no-sectors': 'Adaugă sectoare în pasul anterior.',
  'no-stands': 'Lacul selectat nu are standuri configurate.',
};

/** The grid button's spoken name: «Stand 12», «Stand 12, alocat sectorului A», «…, Foarte bun». */
export function standLabel(name: string, sector: string | null, level?: PerfLevel): string {
  return [`Stand ${name}`, sector ? `alocat sectorului ${sector}` : null, level?.text ?? null].filter(Boolean).join(', ');
}
