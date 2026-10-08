import {
  getGeneralModeGroupExplanation,
  getGridRuleExplanation,
  hasGridRule,
  RANKING_EXPLANATIONS,
  UNKNOWN_RANKING_EXPLANATION,
  type RankingExplanation,
} from '@/core/organizer';

/*
 * The ranking explanation panel's pure half (parity organizer.ranking-explanation c1–c3,
 * organizer.step-ranking c11, behaviour organizer.b.ranking-explanation-orphan).
 *
 * fish has two ways to read an explanation: the orphan screen ranking-explanation.tsx (?type=, one
 * ranking type, «Necunoscut» otherwise) and step-ranking.tsx's in-page sheet (a ranking type, the
 * general-mode group of a type, or the grid rule of a type). The web keeps ONE panel over step 3,
 * deep-linkable through ?explicatie=:
 *   quantity                 the ranking type's explanation (RANKING_EXPLANATIONS)
 *   mod-general-quality      the type's general-mode group («1. 📊 După poziția în sector», «1.n …», «2. 🔢 După punctaj»)
 *   grila / grila-quality    the grid rule (of the given type; bare «grila» = the form's current type)
 * Anything else is a ranking type: an unknown one reads «Necunoscut» / «Tip de clasament necunoscut.».
 *
 * The value comes from a URL anyone can type, so a type is looked up as an OWN key only («constructor»,
 * «__proto__» are not types). fish only offers the general-mode / grid links for types that have that
 * concept (step-ranking.tsx:621-634); here a general mode / grid rule of a type without it (or of an
 * unknown type) reads «Necunoscut» with no eyebrow — rule 4: we do not explain what does not exist.
 */

export type ExplanationTarget =
  | { kind: 'ranking'; rankingType: string }
  | { kind: 'generalMode'; rankingType: string }
  /** `rankingType` optional: without it the panel explains the grid rule of the form's current type. */
  | { kind: 'gridRule'; rankingType?: string };

const GENERAL_MODE_PREFIX = 'mod-general-';
const GRID_RULE_PARAM = 'grila';
const GRID_RULE_PREFIX = `${GRID_RULE_PARAM}-`;

/** ?explicatie= value of a target (the inverse of parseExplanationParam). */
export function explanationParam(target: ExplanationTarget): string {
  if (target.kind === 'gridRule') return target.rankingType ? `${GRID_RULE_PREFIX}${target.rankingType}` : GRID_RULE_PARAM;
  if (target.kind === 'generalMode') return `${GENERAL_MODE_PREFIX}${target.rankingType}`;
  return target.rankingType;
}

/** The target of a ?explicatie= value; null for a missing / blank one (no panel). */
export function parseExplanationParam(value: string | null | undefined): ExplanationTarget | null {
  const v = value?.trim();
  if (!v) return null;
  if (v === GRID_RULE_PARAM) return { kind: 'gridRule' };
  if (v.startsWith(GRID_RULE_PREFIX) && v.length > GRID_RULE_PREFIX.length) return { kind: 'gridRule', rankingType: v.slice(GRID_RULE_PREFIX.length) };
  if (v.startsWith(GENERAL_MODE_PREFIX) && v.length > GENERAL_MODE_PREFIX.length) return { kind: 'generalMode', rankingType: v.slice(GENERAL_MODE_PREFIX.length) };
  return { kind: 'ranking', rankingType: v };
}

/** A known ranking type (an own key of RANKING_EXPLANATIONS — never an Object.prototype name). */
function isKnownType(rankingType: string | null | undefined): rankingType is string {
  return !!rankingType && Object.hasOwn(RANKING_EXPLANATIONS, rankingType);
}

/** The ranking type whose grid rule a gridRule target explains; undefined when there is none to explain. */
export function gridRuleType(target: ExplanationTarget, formRankingType?: string | null): string | undefined {
  if (target.kind !== 'gridRule') return undefined;
  const type = target.rankingType ?? formRankingType;
  return isKnownType(type) && hasGridRule(type) ? type : undefined;
}

/**
 * The explanation a target shows (fish step-ranking.tsx:607-619 + ranking-explanation.tsx:10-13), or
 * null when it explains nothing that exists (an unknown type, a concept the type does not have).
 */
function knownExplanation(target: ExplanationTarget, formRankingType?: string | null): RankingExplanation | null {
  if (target.kind === 'gridRule') {
    const type = gridRuleType(target, formRankingType);
    return type ? getGridRuleExplanation(type) : null;
  }
  if (!isKnownType(target.rankingType)) return null;
  if (target.kind === 'generalMode') return getGeneralModeGroupExplanation(target.rankingType) ?? null;
  return RANKING_EXPLANATIONS[target.rankingType];
}

export function explanationFor(target: ExplanationTarget, formRankingType?: string | null): RankingExplanation {
  return knownExplanation(target, formRankingType) ?? UNKNOWN_RANKING_EXPLANATION;
}

/* ── the rendered shape ─────────────────────────────────────────────────────────────────────── */

/** A paragraph of a section body; `label` is a lead line like «Cum funcționează:» / «Exemplu concret:». */
export type ExplanationParagraph = { label?: string; text: string };

export type ExplanationSectionView = {
  heading?: string;
  /** 1 = a top heading («Ce este», «1. 📊 După poziția în sector»), 2 = a numbered sub-heading («1.2 …»). */
  level: 1 | 2;
  paragraphs: ExplanationParagraph[];
};

/** `eyebrow` names the kind; none for «Necunoscut» (an eyebrow over an unknown adds noise). */
export type ExplanationView = { eyebrow?: string; title: string; sections: ExplanationSectionView[] };

const SUB_HEADING = /^\d+\.\d+\s/;
/** A paragraph's first line is a lead label when it is short and ends with «:» (fish's «Cum funcționează:»). */
const LEAD_LABEL = /^[^\n]{1,40}:$/;

/** Splits a body on blank lines; single line breaks stay inside a paragraph (rendered pre-line). */
export function splitParagraphs(body: string): ExplanationParagraph[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [first, ...rest] = p.split('\n');
      if (rest.length && LEAD_LABEL.test(first.trim())) return { label: first.trim().slice(0, -1), text: rest.join('\n').trim() };
      return { text: p };
    });
}

const EYEBROW: Record<ExplanationTarget['kind'], string> = {
  ranking: 'Tip de clasament',
  generalMode: 'Clasament general',
  gridRule: 'Regula grilei',
};

/**
 * The form's type matters only to a bare «grila» (the grid rule of the form's current type): every
 * other target ignores it, so a draft hydrating / auto-saving does not rebuild their view.
 */
export function formTypeFor(target: ExplanationTarget, formRankingType?: string | null): string | null | undefined {
  return target.kind === 'gridRule' && !target.rankingType ? formRankingType : undefined;
}

/** Title + the sections in order, each with its optional heading and its body as paragraphs. */
export function buildExplanationView(target: ExplanationTarget, formRankingType?: string | null): ExplanationView {
  const known = knownExplanation(target, formRankingType);
  const explanation = known ?? UNKNOWN_RANKING_EXPLANATION;
  return {
    eyebrow: known ? EYEBROW[target.kind] : undefined,
    title: explanation.title,
    sections: explanation.sections.map((s) => ({
      heading: s.heading,
      level: s.heading && SUB_HEADING.test(s.heading) ? 2 : 1,
      paragraphs: splitParagraphs(s.body),
    })),
  };
}
