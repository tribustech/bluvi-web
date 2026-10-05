/**
 * Every state the T2 demo can show (?state=…), in switcher order, with the switcher label — one per
 * state of lakes.results-map in the parity inventory (docs/parity/areas/lakes.yml):
 * - 0 results in viewport (c17): «viewport-empty» starts the map over the Black Sea;
 * - filters / search excluding every lake: «no-match» (search «zzzz»);
 * - county / city bbox failed → Romania overview (c6): «bbox-failed» (search scoped, map on Romania);
 *   «resolving» is the first-load skeleton («loading»);
 * - nearby mode: «nearby» (the user + «În jurul meu · 50 km»);
 * - location: never asked («results»), locating, granted («located»), denied, unavailable;
 * - map unavailable (no WebGL / tile host down): «map-failed»;
 * - list pages (fish 7 per page): «more-loading», «more-error».
 *
 * No signed-in / signed-out pair: «Hartă bălți» is public and shows a guest exactly what it shows
 * a member (fish lakes tab: no gated filter or action on the map; booking is gated later, on the
 * lake page). The shell's own signed-out look comes from the session cookie, as on every page.
 */
export const DEMO_STATES = {
  results: 'Rezultate',
  loading: 'Se încarcă',
  fetching: 'Reîncărcare',
  'viewport-empty': '0 în zonă',
  'no-match': 'Nicio potrivire',
  error: 'Eroare',
  partial: 'Date parțiale',
  'map-failed': 'Hartă indisponibilă',
  'bbox-failed': 'Zonă nerezolvată',
  selected: 'Pin selectat',
  filtered: 'Filtre active',
  'filters-open': 'Panou filtre',
  'list-hidden': 'Listă ascunsă',
  'list-full': 'Listă extinsă',
  'more-loading': 'Pagina următoare',
  'more-error': 'Pagină eșuată',
  located: 'Locația mea',
  nearby: 'În jurul meu',
  locating: 'Se caută locația',
  'location-denied': 'Locație refuzată',
  'location-unavailable': 'Locație indisponibilă',
  empty: 'Gol (doar șablon)',
} as const;

/**
 * States the parity inventory (docs/parity/areas/lakes.yml, lakes.results-map) does not list: edge
 * cases of the template only. «Gol» is a CMS with no lake at all — production never has one.
 */
export const TEMPLATE_ONLY_STATES: ReadonlySet<DemoState> = new Set<DemoState>(['empty']);

export type DemoState = keyof typeof DEMO_STATES;

export function parseDemoState(value: string | string[] | undefined): DemoState {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v in DEMO_STATES ? (v as DemoState) : 'results';
}
