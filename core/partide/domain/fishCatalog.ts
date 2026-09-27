/**
 * Pure parts of fish `features/partide/domain/fishCatalog.ts`. The `useFishCatalog` hook (a
 * persisted jotai atom hydrated from `useFishes()`) is UI state and is not ported; the fishes
 * list itself belongs to the fishes domain.
 */
import type { TargetSpecies } from './types';

export type CatalogFish = { id: string; name: string; priority: number | null; defaultRank: number | null };

/** Last resort ONLY (catalog never fetched / no ranks set in CMS). */
export const FALLBACK_TARGET_NAMES = ['Crap', 'Caras', 'Somn', 'Știucă'] as const;

/** Fallback-era targets carry id: null — the same fish later resolves with a real documentId,
 * so identity falls back to the (unique) name when either id is null. */
export const speciesKey = (t: TargetSpecies): string => t.id ?? `name:${t.name.trim().toLowerCase()}`;
export const sameSpecies = (a: TargetSpecies, b: TargetSpecies): boolean =>
  a.id != null && b.id != null ? a.id === b.id : a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

/** priority asc, nulls last, ties by name (localeCompare 'ro'). Pure — never mutates the input. */
export function sortCatalog(list: CatalogFish[]): CatalogFish[] {
  return [...list].sort((a, b) => {
    if (a.priority == null && b.priority != null) return 1;
    if (a.priority != null && b.priority == null) return -1;
    if (a.priority != null && b.priority != null && a.priority !== b.priority) return a.priority - b.priority;
    return a.name.localeCompare(b.name, 'ro');
  });
}

/**
 * Entries with a non-null `defaultRank`, sorted rank ascending → `{ id, name }`. Empty result
 * (no entry ranked, or an empty catalog) → the four fallback names with `id: null`.
 */
export function resolveDefaultTargets(catalog: CatalogFish[]): TargetSpecies[] {
  const ranked = catalog
    .filter((f): f is CatalogFish & { defaultRank: number } => f.defaultRank != null)
    .sort((a, b) => a.defaultRank - b.defaultRank);
  if (!ranked.length) return FALLBACK_TARGET_NAMES.map(name => ({ id: null, name }));
  return ranked.map(f => ({ id: f.id, name: f.name }));
}

/**
 * Chip row for the „Ce pescuiești?" picker: every selected target first, then the quick picks
 * not already selected. Matching goes through `sameSpecies`, not a key `Set`: a fallback-era
 * entry (`id: null`) and its real-`documentId` twin are the same fish.
 */
export function mergeSpeciesChips(selected: TargetSpecies[], quick: TargetSpecies[]): TargetSpecies[] {
  return [...selected, ...quick.filter(q => !selected.some(s => sameSpecies(s, q)))];
}

/** The mapping `useFishCatalog` applies to each CMS fish row. */
export function toCatalogFish(f: {
  documentId: string;
  Name: string;
  competitionPriority?: number | null;
  partidaDefaultRank?: number | null;
}): CatalogFish {
  return { id: f.documentId, name: f.Name, priority: f.competitionPriority ?? null, defaultRank: f.partidaDefaultRank ?? null };
}
