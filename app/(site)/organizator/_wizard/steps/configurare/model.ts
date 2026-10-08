import type { FishSpecies } from '@/core/lakes';

/**
 * fish step-config.tsx sortedFishSpecies (organizer.step-config.c5): species with a numeric
 * `competitionPriority` first, ascending; then the rest; ties and the rest by Romanian name.
 */
export function sortCompetitionSpecies<T extends Pick<FishSpecies, 'Name' | 'competitionPriority'>>(species: ReadonlyArray<T> | null | undefined): T[] {
  if (!species?.length) return [];
  return [...species].sort((a, b) => {
    const ap = a.competitionPriority;
    const bp = b.competitionPriority;
    const aHas = typeof ap === 'number';
    const bHas = typeof bp === 'number';
    if (aHas && bHas && ap !== bp) return ap - bp;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.Name.localeCompare(b.Name, 'ro');
  });
}

/** fish `next.replace(/\D/g, '')` — a count field keeps digits only (typed or pasted). */
export const digitsOnly = (value: string) => value.replace(/\D/g, '');

/** A species chip toggled: added at the end when off, removed when on (fish order). */
export function toggleSpecies(selected: ReadonlyArray<string> | undefined, id: string): string[] {
  const current = selected ?? [];
  return current.includes(id) ? current.filter(x => x !== id) : [...current, id];
}
