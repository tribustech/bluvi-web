// Ported from fish `features/timer/baitTaxonomy.ts` (pure).
export type BaitType = 'boilies' | 'pop_up' | 'snowman' | 'wafters' | 'pellets' | 'porumb' | 'mamaliga' | 'tigernuts' | 'artificial';

export type BaitSize = 10 | 12 | 14 | 15 | 16 | 18 | 20 | 22 | 24;

export type BaitFlavor =
  | 'krill' | 'monster_crab' | 'squid' | 'squid_capsuna' | 'squid_pruna' | 'squid_octopus' | 'scopex' | 'scopex_banana'
  | 'capsuna' | 'banana' | 'ananas' | 'tutti_frutti' | 'pruna' | 'usturoi' | 'capsuna_usturoi' | 'ananas_usturoi'
  | 'miere' | 'miere_usturoi' | 'porumb' | 'tigernut' | 'hot_krill' | 'crab_pruna' | 'shellfish' | 'belachan'
  | 'robin_red' | 'fishmeal' | 'pepper' | 'black_pepper' | 'mango' | 'frankfurter' | 'frankfurter_capsuna'
  | 'spicy_crab' | 'moroccan_spice' | 'fruity_tuna' | 'tuna' | 'calypso_pink' | 'bubblegum' | 'butyric'
  | 'milk_toffee' | 'chocolate' | 'coconut';

export const BAIT_TYPES: readonly BaitType[] = ['boilies', 'pop_up', 'snowman', 'wafters', 'pellets', 'porumb', 'mamaliga', 'tigernuts', 'artificial'];

export const BAIT_SIZES: readonly BaitSize[] = [24, 22, 20, 18, 16, 15, 14, 12, 10];

export const BAIT_TYPE_LABELS: Record<BaitType, string> = {
  boilies: 'Boilies',
  pop_up: 'Pop-up',
  snowman: 'Snowman',
  wafters: 'Wafters',
  pellets: 'Pelete',
  porumb: 'Porumb',
  mamaliga: 'Mămăligă',
  tigernuts: 'Tigernuts',
  artificial: 'Artificială',
};

export const BAIT_FLAVOR_LABELS: Record<BaitFlavor, string> = {
  krill: 'Krill',
  monster_crab: 'Monster Crab',
  squid: 'Squid',
  squid_capsuna: 'Squid Căpșună',
  squid_pruna: 'Squid Prună',
  squid_octopus: 'Squid Octopus',
  scopex: 'Scopex',
  scopex_banana: 'Scopex Banană',
  capsuna: 'Căpșună',
  banana: 'Banană',
  ananas: 'Ananas',
  tutti_frutti: 'Tutti Frutti',
  pruna: 'Prună',
  usturoi: 'Usturoi',
  capsuna_usturoi: 'Căpșună Usturoi',
  ananas_usturoi: 'Ananas Usturoi',
  miere: 'Miere',
  miere_usturoi: 'Miere Usturoi',
  porumb: 'Porumb',
  tigernut: 'Tigernut',
  hot_krill: 'Hot Krill',
  crab_pruna: 'Crab Prună',
  shellfish: 'Shellfish',
  belachan: 'Belachan',
  robin_red: 'Robin Red',
  fishmeal: 'Fishmeal',
  pepper: 'Pepper',
  black_pepper: 'Black Pepper',
  mango: 'Mango',
  frankfurter: 'Frankfurter',
  frankfurter_capsuna: 'Frankfurter Căpșună',
  spicy_crab: 'Spicy Crab',
  moroccan_spice: 'Moroccan Spice',
  fruity_tuna: 'Fruity Tuna',
  tuna: 'Tuna',
  calypso_pink: 'Calypso Pink',
  bubblegum: 'Bubblegum',
  butyric: 'Butyric',
  milk_toffee: 'Milk Toffee',
  chocolate: 'Ciocolată',
  coconut: 'Cocos',
};

export const BAIT_FLAVORS: readonly BaitFlavor[] = Object.keys(BAIT_FLAVOR_LABELS) as BaitFlavor[];

export function composeBait(type: BaitType | null, size: BaitSize | null, flavor: BaitFlavor | null): string {
  const tokens: string[] = [];
  if (type) tokens.push(BAIT_TYPE_LABELS[type]);
  if (size !== null) tokens.push(`${size}mm`);
  if (flavor) tokens.push(BAIT_FLAVOR_LABELS[flavor]);
  return tokens.join(' ');
}
