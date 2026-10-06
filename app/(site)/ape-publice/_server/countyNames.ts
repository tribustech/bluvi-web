/*
 * The ANAR dataset stores county names without diacritics («Bucuresti», «Caras-Severin»), while the
 * basemap next to them labels the same places with them («București»). Every county name leaves the
 * source through `countyDisplayName`, so the list, the search, the chips, the county filter, the
 * page titles and the JSON-LD all read the Romanian spelling. Water names are free text: unchanged.
 * TODO(core): move to core/lakes (with the bundled source) once the lakes unit owns this dataset.
 */

const DISPLAY: Record<string, string> = {
  Alba: 'Alba',
  Arad: 'Arad',
  Arges: 'Argeș',
  Bacau: 'Bacău',
  Bihor: 'Bihor',
  'Bistrita-Nasaud': 'Bistrița-Năsăud',
  Botosani: 'Botoșani',
  Braila: 'Brăila',
  Brasov: 'Brașov',
  Bucuresti: 'București',
  Buzau: 'Buzău',
  Calarasi: 'Călărași',
  'Caras-Severin': 'Caraș-Severin',
  Cluj: 'Cluj',
  Constanta: 'Constanța',
  Covasna: 'Covasna',
  Dambovita: 'Dâmbovița',
  Dolj: 'Dolj',
  Galati: 'Galați',
  Giurgiu: 'Giurgiu',
  Gorj: 'Gorj',
  Harghita: 'Harghita',
  Hunedoara: 'Hunedoara',
  Ialomita: 'Ialomița',
  Iasi: 'Iași',
  Ilfov: 'Ilfov',
  Maramures: 'Maramureș',
  Mehedinti: 'Mehedinți',
  Mures: 'Mureș',
  Neamt: 'Neamț',
  Olt: 'Olt',
  Prahova: 'Prahova',
  Salaj: 'Sălaj',
  'Satu Mare': 'Satu Mare',
  Sibiu: 'Sibiu',
  Suceava: 'Suceava',
  Teleorman: 'Teleorman',
  Timis: 'Timiș',
  Tulcea: 'Tulcea',
  Valcea: 'Vâlcea',
  Vaslui: 'Vaslui',
  Vrancea: 'Vrancea',
};

/** «Bucuresti» → «București»; an unknown name (a new dataset version) is kept as stored. */
export function countyDisplayName(name: string): string;
export function countyDisplayName(name: string | null): string | null;
export function countyDisplayName(name: string | null): string | null {
  if (name == null) return null;
  return DISPLAY[name] ?? name;
}

/** The term without diacritics, for matching the stored county names («Constanța» → «Constanta»). */
export function stripDiacritics(term: string): string {
  return term.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export const byRomanianName = (a: string, b: string) => a.localeCompare(b, 'ro');
