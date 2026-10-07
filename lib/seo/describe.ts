import { PUBLIC_WATER_TYPE_LABEL, publicWaterBasinName, publicWaterLocationLabel, publicWaterName, type PublicWaterType } from '@/core/lakes';
import { formatCount } from '@/core/realtime/chat/format';

/*
 * Meta-description copy shared by the public pages' generateMetadata (global.b.seo-metadata):
 * Romanian counts through formatCount («25 de participanți»), and the venue named exactly as the
 * page's title, breadcrumb and JSON-LD name it.
 */

/** «1 participant înscris» / «25 de participanți înscriși»; a team competition counts teams. */
export function registeredLine(approved: number, team: boolean): string {
  return team ? formatCount(approved, 'echipă înscrisă', 'echipe înscrise') : formatCount(approved, 'participant înscris', 'participanți înscriși');
}

const AREA = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

/**
 * A public water's page description, as a sentence (the «·» separator is for titles): «Borănești,
 * lac natural în județul Ialomița, 0,02 km², bazinul hidrografic Ialomița. Hartă, partide de pescuit
 * și capturi pe Borănești în Bluvi.» — the county a proper noun, each fact only when known.
 */
export function waterDetailDescription(water: {
  name: string | null;
  type: PublicWaterType;
  county: string | null;
  countyIds: number[];
  areaKm2: number | null;
  basin: string | null;
}): string {
  const name = publicWaterName(water);
  const where = waterWhereProse(water);
  const kind = PUBLIC_WATER_TYPE_LABEL[water.type].toLowerCase();
  const parts = [name, where ? `${kind} în ${where}` : kind];
  if (water.areaKm2) parts.push(`${AREA.format(water.areaKm2)} km²`);
  const basin = publicWaterBasinName(water.basin);
  if (basin) parts.push(`bazinul hidrografic ${basin}`);
  return `${parts.join(', ')}. Hartă, partide de pescuit și capturi pe ${name} în Bluvi.`;
}

export type WaterSubpage = 'partide' | 'statistici' | 'clasament' | 'capturi';

/** Where a water is, for prose: «județul Ialomița», «3 județe»; null without a county. */
export function waterWhereProse(water: { type: PublicWaterType; county: string | null; countyIds: number[] }): string | null {
  const label = publicWaterLocationLabel(water);
  if (!label) return null;
  return label === water.county ? `județul ${label}` : label;
}

/**
 * A public-water subpage's description. The water is named as its title names it (publicWaterName:
 * an unnamed ANAR water reads «Apă publică», never «această apă»), with its county («Nebunul
 * (județul Ialomița)» — ANAR names repeat, the county tells them apart), at the start of the
 * sentence — no preposition to fit every water type and name («pe râul», «la lacul», …).
 */
export function waterSubDescription(water: { name: string | null; type: PublicWaterType; county: string | null; countyIds: number[] }, page: WaterSubpage): string {
  const where = waterWhereProse(water);
  const name = where ? `${publicWaterName(water)} (${where})` : publicWaterName(water);
  switch (page) {
    case 'partide':
      return `${name}: partidele de pescuit din comunitatea Bluvi — cine pescuiește acum, ultimele capturi și partidele încheiate.`;
    case 'statistici':
      return `${name}: statisticile partidelor din comunitatea Bluvi — partide, pescari, capturi, activitate, top pescari, recordul și speciile prinse, pe săptămână, lună și an.`;
    case 'clasament':
      return `${name}: clasamentul pescarilor din comunitatea Bluvi — podiumul, kilogramele prinse și speciile, pe săptămână, lună și an.`;
    case 'capturi':
      return `${name}: toate capturile fotografiate de pescarii din comunitatea Bluvi — specia, greutatea și pescarul.`;
  }
}
