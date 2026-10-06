import { getLakeLocationSubtitle, type LakeLocationInput } from '@/core/lakes';

/*
 * The location line under the lake's name (lakes.detail.c9): core getLakeLocationSubtitle
 * («address, city, county»), without repeating what the address already says — the CMS addresses
 * often carry the locality and «jud. X» already («Belin, nr. 360, jud. Covasna, Belin, Covasna»).
 * TODO(core): move the de-duplication into getLakeLocationSubtitle (fish shows the repeat too).
 */

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** `name` appears in `address` as whole words (case and diacritics aside; «jud. X» counts). */
function mentions(address: string, name: string): boolean {
  const a = ` ${fold(address).replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const n = fold(name).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return n.length > 0 && a.includes(` ${n} `);
}

export function lakeLocationLine(lake: LakeLocationInput): string | null {
  const address = lake.address?.trim();
  if (!address) return getLakeLocationSubtitle(lake);
  const rest = getLakeLocationSubtitle({ ...lake, address: null });
  const parts = (rest ? rest.split(', ') : []).filter(p => !mentions(address, p));
  return [address, ...parts].join(', ');
}
