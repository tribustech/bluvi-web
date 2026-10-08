'use client';

import { Dialog } from '@/components/surfaces/Dialog';
import { Button } from '@/components/ui/Button';

/*
 * The ranking explanation over step 3 (parity organizer.ranking-explanation and the step's in-page
 * explanations) — the panel is a STUB until its batch replaces the body; the URL codec is final.
 * Final signatures: `export function RankingExplanationPanel({ target, onClose })`,
 * `explanationParam(target)` (the ?explicatie= value) and `parseExplanationParam(value)`. The
 * explanations themselves are core/organizer (getRankingExplanation, getGeneralModeGroupExplanation,
 * getGridRuleExplanation).
 */

export type ExplanationTarget =
  | { kind: 'ranking'; rankingType: string }
  | { kind: 'generalMode'; rankingType: string }
  | { kind: 'gridRule' };

const GENERAL_MODE_PREFIX = 'mod-general:';
const GRID_RULE_PARAM = 'regula-grila';

/** ?explicatie= value: «quantity» (a ranking type), «mod-general:quality», «regula-grila». */
export function explanationParam(target: ExplanationTarget): string {
  if (target.kind === 'gridRule') return GRID_RULE_PARAM;
  if (target.kind === 'generalMode') return `${GENERAL_MODE_PREFIX}${target.rankingType}`;
  return target.rankingType;
}

/** The inverse of explanationParam; null for an empty value. An unknown type stays a ranking target («Necunoscut»). */
export function parseExplanationParam(value: string | null | undefined): ExplanationTarget | null {
  if (!value) return null;
  if (value === GRID_RULE_PARAM) return { kind: 'gridRule' };
  if (value.startsWith(GENERAL_MODE_PREFIX)) return { kind: 'generalMode', rankingType: value.slice(GENERAL_MODE_PREFIX.length) };
  return { kind: 'ranking', rankingType: value };
}

export function RankingExplanationPanel({ target, onClose }: { target: ExplanationTarget; onClose: () => void }) {
  void target;
  return (
    <Dialog open onClose={onClose} closeButton title="Explicație" description="În lucru" actions={<Button onClick={onClose}>Închide</Button>} />
  );
}
