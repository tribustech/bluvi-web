/*
 * Ranking configuration of the create-competition wizard — fish helpers/rankingConfig.ts, plus the
 * ranking type list of app/(app)/create-competition/step-ranking.tsx (RANKING_TYPES,
 * DISABLED_RANKING_TYPES, GRID_RULE_OPTIONS), the review labels of step-review.tsx
 * (RANKING_TYPE_LABELS) and the sector cap of step-lake-sectors.tsx. Pure; no copy is invented.
 */

/* ------------------------------------------------------------------ */
/* Ranking types — fish step-ranking.tsx RANKING_TYPES                 */
/* ------------------------------------------------------------------ */

export type RankingTypeOption = { value: string; label: string; description: string };

/** fish step-ranking.tsx `RANKING_TYPES` (order and copy kept; the label carries fish's emoji). */
export const RANKING_TYPES: readonly RankingTypeOption[] = [
  {
    value: 'quantity',
    label: '⚖️ Cantitate',
    description:
      'Echipele ordonate după greutatea totală a capturilor. Cu cât prinzi mai mult, cu atât ești mai bine clasat.',
  },
  {
    value: 'quality',
    label: '🏆 Calitate',
    description: 'Media celor mai grele N capturi (N = nr. minim pești pe sector). Premiază calitatea, nu volumul.',
  },
  {
    value: 'quantityQuality',
    label: '⚖️🏆 Cantitate/Calitate',
    description: 'Puncte separate pentru cantitate și calitate, adunate. La egalitate, cantitatea departajează prima.',
  },
  {
    value: 'qualityQuantity',
    label: '🏆⚖️ Calitate/Cantitate',
    description: 'Puncte separate pentru calitate și cantitate, adunate. La egalitate, calitatea departajează prima.',
  },
  {
    value: 'calitateCalitate',
    label: '🏆🏆 Calitate/Calitate',
    description: 'Calitatea 1 = media capturilor fără cel mai mare pește. Calitatea 2 = cel mai mare pește.',
  },
  {
    value: 'calitateCantitateCMMC',
    label: '🏆⚖️🐟 Calitate/Cantitate/CMMC',
    description:
      '3 clasamente pe sector: Calitate (top N fără cea mai mare captură), Cantitate (greutate totală) și CMMC (cea mai mare captură). La general primează cantitatea.',
  },
  {
    value: 'bestOf',
    label: '🎯 Best of',
    description: 'Se selectează cei mai grei N pești din sector. Contează câți pești ai în topul sectorului.',
  },
  {
    value: 'bestOfTiers',
    label: '🪜 Best of x, y, z...',
    description:
      'Standurile vor concura pe baza calității calculate din x, y, z capturi. Exemplu: "Best of 9/7/5/3" va da 4 locuri pe podium unde locul 1 va fi câștigat de standul cu cea mai bună calitate din 9 pești.',
  },
  {
    value: 'feederRounds',
    label: '🔁 Feeder (FIPS)',
    description:
      'Concurs în 1, 2 sau 3 manșe, cu tragere la sorți nouă înainte de fiecare manșă. În fiecare manșă primești punctele locului din sector, iar clasamentul final e suma punctelor (cel mai mic total câștigă).',
  },
  {
    value: 'nationalChampionship',
    label: '🇷🇴 Campionat Național',
    description: 'Reguli oficiale FIPS-CIPS. Clasament pe cluburi, 3 sectoare obligatorii, câte o echipă per sector.',
  },
  {
    value: 'fipsed',
    label: '🌍 Campionat Mondial FIPSed',
    description:
      'Regulile FIPSed pentru competițiile între națiuni: 3 sectoare, punctaj pe sectoare și departajare oficială la echipe și perechi.',
  },
];

/** fish step-ranking.tsx `DISABLED_RANKING_TYPES`: shown, not selectable by organizers. */
export const DISABLED_RANKING_TYPES: ReadonlySet<string> = new Set(['nationalChampionship', 'fipsed']);

/** fish step-review.tsx `RANKING_TYPE_LABELS` — the plain Romanian name (no emoji). */
export const RANKING_TYPE_LABELS: Readonly<Record<string, string>> = {
  quantity: 'Cantitate',
  quality: 'Calitate',
  quantityQuality: 'Cantitate/Calitate',
  qualityQuantity: 'Calitate/Cantitate',
  bestOf: 'Best of',
  bestOfTiers: 'Best of x, y, z...',
  nationalChampionship: 'Campionat Național',
  fipsed: 'Campionat Mondial FIPSed',
  calitateCalitate: 'Calitate/Calitate',
  calitateCantitateCMMC: 'Calitate/Cantitate/CMMC',
  feederRounds: 'Feeder (FIPS)',
};

/** The plain label of a ranking type; an unknown type is printed as is (fish review falls back to the value). */
export function getRankingTypeLabel(rankingType?: string | null): string | undefined {
  if (!rankingType) return undefined;
  return RANKING_TYPE_LABELS[rankingType] ?? rankingType;
}

/* ------------------------------------------------------------------ */
/* Sectors — fish step-lake-sectors.tsx                                */
/* ------------------------------------------------------------------ */

/** National championship and FIPSed run on exactly 3 sectors (fish step-lake-sectors.tsx:59, :279). */
export function isThreeSectorRankingType(rankingType?: string | null): boolean {
  return rankingType === 'nationalChampionship' || rankingType === 'fipsed';
}

/** Most sectors the step lets the organizer add: 3 for national / FIPSed, else 24 (A..X). */
export function getMaxSectors(rankingType?: string | null): number {
  return isThreeSectorRankingType(rankingType) ? 3 : 24;
}

/* ------------------------------------------------------------------ */
/* Min fish per sector — fish helpers/rankingConfig.ts                 */
/* ------------------------------------------------------------------ */

const MIN_FISH_NUMBER_RANKING_TYPES = new Set([
  'quality',
  'quantityQuality',
  'qualityQuantity',
  'calitateCalitate',
  'calitateCantitateCMMC',
]);

/** fish `requiresMinFishNumber`: the quality-based types use a per-sector minimum («grila»). */
export function requiresMinFishNumber(rankingType?: string | null): boolean {
  return !!rankingType && MIN_FISH_NUMBER_RANKING_TYPES.has(rankingType);
}

/* ------------------------------------------------------------------ */
/* General ranking winner mode — fish helpers/rankingConfig.ts         */
/* ------------------------------------------------------------------ */

export const GENERAL_RANKING_WINNER_MODE_LABELS: Readonly<Record<string, string>> = {
  bySectorPosition: 'După poziția în sector',
  byPoints: 'După punctaj',
  bySectorPositionPerisReversed: 'Poziție sector (inversată)',
};

const GENERAL_RANKING_MODE_SUPPORTED_TYPES = new Set(['quantity', 'quality', 'quantityQuality', 'qualityQuantity']);

const PERIS_REVERSED_SUPPORTED_TYPES = new Set(['quantityQuality', 'qualityQuantity']);

const DEFAULT_GENERAL_RANKING_MODE = 'bySectorPosition';

export type GeneralRankingOption = { emoji: string; label: string; value: string; description: string };

export type SectorPriorityOption = {
  value: 'bySectorPosition' | 'bySectorPositionPerisReversed';
  label: string;
  description: string;
};

export function hasGeneralRankingWinnerMode(rankingType?: string | null): boolean {
  return !!rankingType && GENERAL_RANKING_MODE_SUPPORTED_TYPES.has(rankingType);
}

function getSectorPrimaryMetric(rankingType?: string | null): 'Calitatea' | 'Cantitatea' {
  if (rankingType === 'quality' || rankingType === 'qualityQuantity') return 'Calitatea';
  return 'Cantitatea';
}

function getReversedGeneralPrimaryMetric(rankingType?: string | null): 'Calitatea' | 'Cantitatea' {
  if (rankingType === 'quantityQuality') return 'Calitatea';
  return 'Cantitatea';
}

export function getGeneralRankingWinnerModeLabel(mode?: string | null, rankingType?: string | null): string | undefined {
  if (!mode) return undefined;

  if (mode === 'byPoints') return GENERAL_RANKING_WINNER_MODE_LABELS.byPoints;

  if (mode === 'bySectorPosition') {
    return `După poziția în sector, primează ${getSectorPrimaryMetric(rankingType)}`;
  }

  if (mode === 'bySectorPositionPerisReversed') {
    if (!rankingType || !PERIS_REVERSED_SUPPORTED_TYPES.has(rankingType)) {
      return GENERAL_RANKING_WINNER_MODE_LABELS.bySectorPositionPerisReversed;
    }
    return `După poziția în sector, primează ${getReversedGeneralPrimaryMetric(rankingType)}`;
  }

  return mode;
}

function getBySectorPositionDescription(rankingType?: string | null): string {
  if (rankingType === 'quantityQuality') return 'Primează cantitatea pe sector, cantitatea la general.';
  if (rankingType === 'qualityQuantity') return 'Primează calitatea pe sector, calitatea la general.';
  if (rankingType === 'quality') return 'Primează calitatea în grupurile de aceeași poziție de sector.';
  return 'Primează cantitatea în grupurile de aceeași poziție de sector.';
}

function getBySectorPositionReversedDescription(rankingType?: string | null): string {
  if (rankingType === 'quantityQuality') return 'Primează cantitatea pe sector, calitatea la general.';
  return 'Primează calitatea pe sector, cantitatea la general.';
}

function getByPointsDescription(rankingType?: string | null): string {
  if (rankingType === 'quantityQuality') return 'Toate echipele după punctaj total; la egalitate primează cantitatea.';
  if (rankingType === 'qualityQuantity') return 'Toate echipele după punctaj total; la egalitate primează calitatea.';
  if (rankingType === 'quality') return 'Toate echipele ordonate direct după calitate.';
  return 'Toate echipele ordonate direct după cantitate totală.';
}

export function getGeneralRankingOptions(rankingType?: string | null): GeneralRankingOption[] {
  if (!hasGeneralRankingWinnerMode(rankingType)) return [];

  const options: GeneralRankingOption[] = [
    {
      emoji: '📊',
      label: getGeneralRankingWinnerModeLabel('bySectorPosition', rankingType) || GENERAL_RANKING_WINNER_MODE_LABELS.bySectorPosition,
      value: 'bySectorPosition',
      description: getBySectorPositionDescription(rankingType),
    },
    {
      emoji: '🔢',
      label: GENERAL_RANKING_WINNER_MODE_LABELS.byPoints,
      value: 'byPoints',
      description: getByPointsDescription(rankingType),
    },
  ];

  if (rankingType && PERIS_REVERSED_SUPPORTED_TYPES.has(rankingType)) {
    options.push({
      emoji: '🔄',
      label:
        getGeneralRankingWinnerModeLabel('bySectorPositionPerisReversed', rankingType) ||
        GENERAL_RANKING_WINNER_MODE_LABELS.bySectorPositionPerisReversed,
      value: 'bySectorPositionPerisReversed',
      description: getBySectorPositionReversedDescription(rankingType),
    });
  }

  return options;
}

export function getSectorPriorityOptions(rankingType?: string | null): SectorPriorityOption[] {
  if (rankingType === 'quantityQuality') {
    return [
      {
        value: 'bySectorPosition',
        label: 'Primează cantitatea pe sector, cantitatea la general',
        description: 'Comportament standard pentru Cantitate/Calitate.',
      },
      {
        value: 'bySectorPositionPerisReversed',
        label: 'Primează cantitatea pe sector, calitatea la general',
        description: 'Departajare inversată doar în clasamentul general.',
      },
    ];
  }

  if (rankingType === 'qualityQuantity') {
    return [
      {
        value: 'bySectorPosition',
        label: 'Primează calitatea pe sector, calitatea la general',
        description: 'Comportament standard pentru Calitate/Cantitate.',
      },
      {
        value: 'bySectorPositionPerisReversed',
        label: 'Primează calitatea pe sector, cantitatea la general',
        description: 'Departajare inversată doar în clasamentul general.',
      },
    ];
  }

  if (rankingType === 'quality') {
    return [
      {
        value: 'bySectorPosition',
        label: 'Primează calitatea pe sector, calitatea la general',
        description: 'Departajarea rămâne pe calitate.',
      },
    ];
  }

  return [
    {
      value: 'bySectorPosition',
      label: 'Primează cantitatea pe sector, cantitatea la general',
      description: 'Departajarea rămâne pe cantitate.',
    },
  ];
}

export function getGeneralRankingHelpText(rankingType?: string | null): string {
  if (rankingType === 'quantityQuality') {
    return 'În acest tip, în sector primează cantitatea. Mai jos alegi ce primează la egalitate în clasamentul general.';
  }
  if (rankingType === 'qualityQuantity') {
    return 'În acest tip, în sector primează calitatea. Mai jos alegi ce primează la egalitate în clasamentul general.';
  }
  return 'Alegi dacă generalul se ordonează pe grupe de poziție de sector sau direct după punctaj.';
}

/** fish `normalizeGeneralRankingWinnerMode`: a supported mode is kept, else the default; none for other types. */
export function normalizeGeneralRankingWinnerMode(mode: string | undefined | null, rankingType?: string | null): string | undefined {
  const options = getGeneralRankingOptions(rankingType);
  if (!options.length) return undefined;
  if (mode && options.some(option => option.value === mode)) return mode;
  return DEFAULT_GENERAL_RANKING_MODE;
}

/* ------------------------------------------------------------------ */
/* Grid rule (tie-break of stands without «grilă») — rankingConfig.ts   */
/* ------------------------------------------------------------------ */

const DEFAULT_GRID_RULE = 'catchCount';

const GRID_RULE_SUPPORTED_TYPES = new Set(['quality', 'quantityQuality', 'qualityQuantity']);

export const GRID_RULE_LABELS: Readonly<Record<string, string>> = {
  catchCount: 'După numărul de capturi',
  average: 'După media greutății',
};

/** fish step-ranking.tsx `GRID_RULE_OPTIONS`. */
export const GRID_RULE_OPTIONS: readonly { emoji: string; label: string; value: string; description: string }[] = [
  { emoji: '🐟', label: 'După numărul de capturi', value: 'catchCount', description: 'Mai mulți pești = loc mai bun la departajare.' },
  { emoji: '📏', label: 'După media greutății', value: 'average', description: 'Media mai mare = loc mai bun la departajare.' },
];

/** fish step-ranking.tsx `GRID_RULE_TIEBREAK_HELP`. */
export const GRID_RULE_TIEBREAK_HELP =
  'Se aplică doar pentru standurile fără grilă. După ce standurile cu grilă sunt clasate, acestea sunt departajate conform regulii alese mai jos.';

export function hasGridRule(rankingType?: string | null): boolean {
  return !!rankingType && GRID_RULE_SUPPORTED_TYPES.has(rankingType);
}

/** fish `normalizeGridRule`: a known rule is kept, else the default; none for other types. */
export function normalizeGridRule(value: string | undefined | null, rankingType?: string | null): string | undefined {
  if (!hasGridRule(rankingType)) return undefined;
  if (value && GRID_RULE_LABELS[value]) return value;
  return DEFAULT_GRID_RULE;
}
