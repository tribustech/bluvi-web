import {
  DISABLED_RANKING_TYPES,
  getGeneralPriorityMetric,
  getRankingTypeLabel,
  normalizeGeneralRankingWinnerMode,
  normalizeGridRule,
  type CreateCompetitionFormData,
  type GeneralModeValue,
} from '@/core/organizer';

/*
 * Pure rules of step 3 «Tip clasament» (parity organizer.step-ranking; fish
 * app/(app)/create-competition/step-ranking.tsx). The copy and the lists live in core/organizer
 * (rankingConfig.ts); this file only holds what the step decides.
 */

export type RankingPatch = Partial<
  Pick<
    CreateCompetitionFormData,
    'rankingType' | 'generalRankingWinnerMode' | 'gridRule' | 'bestOfFishCount' | 'numberOfWinners' | 'bestOfTierSizes' | 'roundsCount'
  >
>;

/**
 * fish `handleSelectRankingType` (c4): the fields a new ranking type writes, in fish's order.
 * A disabled type (Campionat Național, FIPSed) writes nothing (null). Best-of fields are cleared
 * with '' (fish), the tiers and the legs with undefined; a feeder keeps legs it already has, else 2.
 */
export function rankingTypePatch(values: CreateCompetitionFormData, next: string): RankingPatch | null {
  if (DISABLED_RANKING_TYPES.has(next)) return null;
  const patch: RankingPatch = {
    rankingType: next,
    generalRankingWinnerMode: normalizeGeneralRankingWinnerMode(values.generalRankingWinnerMode, next),
    gridRule: normalizeGridRule(values.gridRule, next),
  };
  if (next !== 'bestOf') {
    patch.bestOfFishCount = '';
    patch.numberOfWinners = '';
  }
  if (next !== 'bestOfTiers') patch.bestOfTierSizes = undefined;
  if (next === 'feederRounds') {
    if (!values.roundsCount) patch.roundsCount = '2';
  } else {
    patch.roundsCount = undefined;
  }
  return patch;
}

/**
 * The values only one type owns (Best of: fish count + winners, Best of x, y, z...: the tiers,
 * Feeder: the legs) — what that type's patch wipes when another type is chosen. Empty values are
 * left out (nothing worth keeping).
 */
export function typeOwnValues(values: CreateCompetitionFormData, type: string): RankingPatch {
  const kept: RankingPatch = {};
  if (type === 'bestOf') {
    if (values.bestOfFishCount) kept.bestOfFishCount = values.bestOfFishCount;
    if (values.numberOfWinners) kept.numberOfWinners = values.numberOfWinners;
  } else if (type === 'bestOfTiers') {
    if (values.bestOfTierSizes?.length) kept.bestOfTierSizes = values.bestOfTierSizes;
  } else if (type === 'feederRounds') {
    if (values.roundsCount) kept.roundsCount = values.roundsCount;
  }
  return kept;
}

/**
 * Web addition to fish `handleSelectRankingType` (the arrow keys move through native radios, so
 * reading the next card switches the type): the patch for `next`, with the values `next` owned
 * earlier in this visit (`kept`) put back instead of fish's empty ones.
 */
export function rankingTypePatchRestoring(values: CreateCompetitionFormData, next: string, kept: RankingPatch | undefined): RankingPatch | null {
  const patch = rankingTypePatch(values, next);
  return patch && kept ? { ...patch, ...kept } : patch;
}

/**
 * fish's two normalising effects + the disabled-type clear (c2, c4): what a hydrated / changed
 * value must become without the user doing anything. Empty when nothing is off.
 */
export function rankingNormalization(values: CreateCompetitionFormData): RankingPatch {
  const type = values.rankingType || '';
  if (type && DISABLED_RANKING_TYPES.has(type)) return { rankingType: undefined };
  const patch: RankingPatch = {};
  const mode = normalizeGeneralRankingWinnerMode(values.generalRankingWinnerMode, type);
  if (mode !== values.generalRankingWinnerMode) patch.generalRankingWinnerMode = mode;
  const rule = normalizeGridRule(values.gridRule, type);
  if (rule !== values.gridRule) patch.gridRule = rule;
  return patch;
}

/** fish's label «⚖️🏆 Cantitate/Calitate» split into the emoji (decorative) and the name. */
export function splitRankingLabel(value: string, label: string): { emoji: string; name: string } {
  const space = label.indexOf(' ');
  return {
    emoji: space > 0 ? label.slice(0, space) : '',
    name: getRankingTypeLabel(value) ?? (space > 0 ? label.slice(space + 1) : label),
  };
}

/** fish `getMetricIcon(getGeneralPriorityMetric(…))`: ⚖️ quantity decides, 🐟 quality decides. */
export function sectorModeIcon(rankingType: string, mode: GeneralModeValue): string {
  return getGeneralPriorityMetric(rankingType, mode) === 'quantity' ? '⚖️' : '🐟';
}

/** fish: the sector-position group opens by itself when the current mode is one of its rows. */
export function isSectorMode(mode: string | undefined | null): mode is GeneralModeValue {
  return mode === 'bySectorPosition' || mode === 'bySectorPositionPerisReversed';
}

/** fish TierSizesEditor `onChangeText`: digits and commas only, the rest is dropped as typed. */
export function tiersOnly(raw: string): string {
  return raw.replace(/[^0-9,]/g, '');
}

/** fish best-of inputs (`v.replace(/\D/g, '')`). */
export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '');
}

/** The legs a feeder can run (fish 3.6.1: 1, 2 or 3 — docs/domain/competitions.md). */
export const LEG_OPTIONS = ['1', '2', '3'] as const;

/** «1 manșă», «2 manșe», «3 manșe» (fish). */
export function legLabel(count: string): string {
  return count === '1' ? '1 manșă' : `${count} manșe`;
}
