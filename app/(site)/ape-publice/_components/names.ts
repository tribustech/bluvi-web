import { publicWaterName, type PublicWaterDetail } from '@/core/lakes';

/** Folded for comparison: no diacritics, lower case, trimmed («SNAGOV» = «Snagov»). */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/**
 * The dataset's second name, when it says something the name does not: «SNAGOV» next to «Snagov»
 * is noise and is dropped; «Brat Alionte» on Dunarea is kept, labelled «și: …» so it never reads
 * as a place.
 */
export function waterAltName(water: PublicWaterDetail): string | null {
  const alt = water.nameEn?.trim();
  if (!alt) return null;
  return fold(alt) === fold(water.name ?? '') || fold(alt) === fold(publicWaterName(water)) ? null : alt;
}
