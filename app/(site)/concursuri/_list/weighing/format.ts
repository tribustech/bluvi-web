import { formatCount, formatKg, type RecentWeighing } from '@/core/competitions';

/*
 * The copy of a recent weighing, shared by the Live strip and the weighing detail. Pure: the
 * time-dependent parts (how long ago) are computed by the caller in the browser.
 */

/** «1 pește», «3 pești», «20 de pești». */
export const fishCount = (n: number) => formatCount(n, 'pește', 'pești');

/** «3 pești · 12,45 kg»; a weighing with no fish says so («Fără capturi», never «capot»). */
export function weighingSummary(w: Pick<RecentWeighing, 'catchCount' | 'totalKg'>): string {
  if (w.catchCount === 0) return 'Fără capturi';
  return `${fishCount(w.catchCount)} · ${formatKg(w.totalKg)} kg`;
}

/** Who weighed: the angler or team, else the stand (a stand with nobody resolvable). */
export const weigherName = (w: Pick<RecentWeighing, 'angler' | 'standLabel'>) => w.angler?.displayName ?? w.standLabel;

/** The strip thumbnail: the angler's photo, else the competition poster, else nothing (initials). */
export const weighingThumb = (w: Pick<RecentWeighing, 'angler' | 'competition'>) => w.angler?.avatarUrl ?? w.competition.posterUrl ?? null;

export type SpeciesGroup = { species: string; count: number; kg: number };

/** The catches grouped by species, heaviest group first (the detail's «Capturi pe specii»). */
export function catchesBySpecies(catches: { weight: number; fishType: { Name: string } | null }[]): SpeciesGroup[] {
  const by = new Map<string, SpeciesGroup>();
  for (const c of catches) {
    const species = c.fishType?.Name?.trim() || 'Specie necunoscută';
    const g = by.get(species) ?? { species, count: 0, kg: 0 };
    g.count += 1;
    g.kg += c.weight;
    by.set(species, g);
  }
  return [...by.values()].sort((a, b) => b.kg - a.kg || a.species.localeCompare(b.species, 'ro'));
}
