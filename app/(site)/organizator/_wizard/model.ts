import {
  createCompetitionSchema,
  EDIT_BLOCKING_FALLBACK_MESSAGE,
  EDIT_BLOCKING_VALIDATION_CODES,
  EDIT_RISK_CONFIRMATION_CODE,
  requiresMinFishNumber,
  type CreateCompetitionFormData,
  type OrganizerEditRiskDetails,
  type TimeoutRecoveryDestination,
} from '@/core/organizer';
import type { T4Step } from '@/components/templates/T4';
import { routes, type WizardStep } from '@/lib/routes';
import { WIZARD_STEP_DEFS } from './stepDefs';

/*
 * The wizard's pure helpers (unit-tested in model.test.ts): validation by field, the dirty check,
 * the local banner test, the exit / recovery targets, the edit error triage and the step list.
 */

export type WizardField = keyof CreateCompetitionFormData;
export type WizardFieldErrors = Partial<Record<WizardField, string>>;

/** createCompetitionSchema's issues, first message per top-level field (fish zodResolver errors). */
export function fieldErrors(values: CreateCompetitionFormData): WizardFieldErrors {
  const parsed = createCompetitionSchema.safeParse(values);
  if (parsed.success) return {};
  const out: WizardFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in out)) out[key as WizardField] = issue.message;
  }
  return out;
}

/** Key-order-independent, undefined-dropping JSON (what the form holds is plain data). */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonical(v);
    }
    return out;
  }
  return value;
}

/** fish `formState.isDirty`: the values differ from the last loaded / saved ones. */
export function valuesEqual(a: CreateCompetitionFormData, b: CreateCompetitionFormData): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/**
 * fish `isLocalDeviceUri` (file://, content://…): on the web a banner picked on this device is an
 * object URL until it is uploaded; a saved banner is the CMS's https URL.
 */
export function isLocalBanner(banner: string | null | undefined): banner is string {
  return typeof banner === 'string' && banner.startsWith('blob:');
}

/** Where the step URLs live: the new / draft wizard, or a competition's edit wizard. */
export function wizardStepPath(step: WizardStep, competitionId: string | null): string {
  return competitionId
    ? `/concursuri/${encodeURIComponent(competitionId)}/editeaza/${step}`
    : `/organizator/concursuri/nou/${step}`;
}

/** The path prefix every step shares (a traversal inside it is a step change, not a leave). */
export function wizardBasePath(competitionId: string | null): string {
  return competitionId ? `/concursuri/${encodeURIComponent(competitionId)}/editeaza/` : '/organizator/concursuri/nou/';
}

/**
 * fish `dismissCreateFlow(fallback)` / `getEditExitTarget`: the return target when one was given,
 * else the competition page when editing a competition, else the organizer panel (c6).
 */
export function exitTarget(returnTo: string | null, competitionId: string | null): string {
  if (returnTo) return returnTo;
  if (competitionId) return routes.competition(competitionId);
  return routes.organizer();
}

/** The timeout notice's «Verifică …» (c20). */
export function recoveryHref(destination: TimeoutRecoveryDestination): string {
  return destination.kind === 'competition' ? routes.competition(destination.competitionId) : routes.organizer();
}

/**
 * fish step-review.tsx basicsErrors / configErrors / rankingErrors / lakeSectorErrors: what keeps
 * «Publică competiția» / «Salvează modificările» disabled on the review step (the relaxed schema
 * only checks the name; the CMS enforces the rest on publish). Keys are fish's error codes, one
 * list per review card.
 */
export type WizardReviewErrors = { basics: string[]; config: string[]; ranking: string[]; lakeSectors: string[] };

const isPositiveInt = (value: string | undefined, max = Infinity) => {
  const n = value ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= max;
};

export function reviewErrors(values: CreateCompetitionFormData): WizardReviewErrors {
  const basics: string[] = [];
  if (!values.name) basics.push('name');
  if (!values.startDate) basics.push('startDate');
  if (!values.endDate) basics.push('endDate');
  if (values.registerFee) {
    const fee = Number(values.registerFee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 50000) basics.push('registerFee');
  }

  const config: string[] = [];
  if (!values.competitionType) config.push('competitionType');
  if (!isPositiveInt(values.participantsLimit)) config.push('participantsLimit');
  if (values.competitionType === 'team' && !isPositiveInt(values.teamParticipants, 10)) config.push('teamParticipants');
  if (!values.fishSpeciesIds?.length) config.push('fishSpeciesIds');

  const ranking: string[] = [];
  const allocatedStands = Object.values(values.standAllocations ?? {}).flatMap(v => (Array.isArray(v) ? v : [])).length;
  if (!values.rankingType) ranking.push('rankingType');
  if (values.rankingType === 'bestOf') {
    if (!isPositiveInt(values.bestOfFishCount)) ranking.push('bestOfFishCount');
    if (!isPositiveInt(values.numberOfWinners)) ranking.push('numberOfWinners');
  }
  if (values.rankingType === 'feederRounds' && !['1', '2', '3'].includes(values.roundsCount ?? '')) ranking.push('roundsCount');
  if (values.rankingType === 'bestOfTiers') {
    const tiers = values.bestOfTierSizes;
    if (!Array.isArray(tiers) || tiers.length === 0) ranking.push('bestOfTierSizes');
    else if (!tiers.every((n, i) => Number.isInteger(n) && n >= 1 && (i === 0 || n < tiers[i - 1]))) ranking.push('bestOfTierSizesInvalid');
    else if (allocatedStands > 0 && tiers.length > allocatedStands) ranking.push('bestOfTiersInsufficientStands');
  }

  const lakeSectors: string[] = [];
  if (!values.lake) lakeSectors.push('lake');
  if (!values.sectors?.length) lakeSectors.push('sectors');
  if (requiresMinFishNumber(values.rankingType) && values.sectors?.some(s => s.minFishNumber < 1)) lakeSectors.push('minFishNumber');
  if ((values.rankingType === 'nationalChampionship' || values.rankingType === 'fipsed') && values.sectors?.length !== 3) {
    lakeSectors.push('sectorCount');
  }
  if (values.rankingType === 'bestOfTiers' && values.sectors && values.sectors.length !== 1) lakeSectors.push('bestOfTiersSectorCount');

  return { basics, config, ranking, lakeSectors };
}

/**
 * The frame's own publish / save-back gate (fish `hasAnyError`): a schema error or a review error
 * keeps the review step's primary disabled — decided by the frame, not opted into by a step.
 */
export function isPublishBlocked(values: CreateCompetitionFormData): boolean {
  if (Object.keys(fieldErrors(values)).length > 0) return true;
  const r = reviewErrors(values);
  return r.basics.length + r.config.length + r.ranking.length + r.lakeSectors.length > 0;
}

const DEFAULT_RISK_IMPACT = { registeredCount: 0, pendingCount: 0, allocatedRegistrationsCount: 0, allocatedStandsCount: 0 };

export type EditErrorTriage =
  | { kind: 'risk'; details: OrganizerEditRiskDetails }
  | { kind: 'blocking'; bluCode: string; message: string }
  | { kind: 'other'; message: string | null };

/**
 * fish persistCompetitionEdit catch (c12, c14): the risk confirmation, a blocking validation code
 * («Modificări necesare» with the server's message), or anything else (a toast).
 */
export function triageEditError(error: unknown): EditErrorTriage {
  const e = error as { bluCode?: unknown; details?: Record<string, unknown> | null; message?: unknown } | null;
  const bluCode = typeof e?.bluCode === 'string' ? e.bluCode : undefined;
  const message = typeof e?.message === 'string' && e.message ? e.message : null;
  if (bluCode === EDIT_RISK_CONFIRMATION_CODE) {
    const details = (e?.details ?? {}) as { risks?: unknown; impact?: unknown };
    return {
      kind: 'risk',
      details: {
        risks: Array.isArray(details.risks) ? (details.risks as OrganizerEditRiskDetails['risks']) : [],
        impact: { ...DEFAULT_RISK_IMPACT, ...((details.impact as object | undefined) ?? {}) },
      },
    };
  }
  if (bluCode && EDIT_BLOCKING_VALIDATION_CODES.has(bluCode)) {
    return { kind: 'blocking', bluCode, message: message ?? EDIT_BLOCKING_FALLBACK_MESSAGE };
  }
  return { kind: 'other', message };
}

/**
 * How a step stands for the rail: filled in, failing a publish check (red), or still to fill in
 * (neutral). The review step derives it from its own error codes (steps/revizuire/model
 * reviewStepStatus) so the rail and the review cards never give opposite answers.
 */
export type WizardStepStatus = 'complete' | 'error' | 'incomplete';

/**
 * The step list (rail, ≥1280) — c3. A check only on a step that is «Completat»: from `status`
 * when given (the review step), else the draft's completedSteps 1–5 (the panel's «Pas N/5»). A
 * passed step not completed is «De completat» with a neutral numbered marker; a step failing a
 * publish check is red («Are câmpuri de corectat»). Every step is reachable (fish lets the
 * organizer jump to any segment). The phone's segment bar stays positional (wizardSegments).
 */
export function wizardSteps(
  current: WizardStep,
  completed: readonly number[],
  status?: Partial<Record<WizardStep, WizardStepStatus>>,
): T4Step[] {
  const at = WIZARD_STEP_DEFS.findIndex(s => s.slug === current);
  return WIZARD_STEP_DEFS.map((s, i) => {
    if (i === at) return { id: s.slug, title: s.title, state: 'current', reachable: true };
    const st = status?.[s.slug] ?? (completed.includes(i + 1) ? 'complete' : i < at ? 'incomplete' : null);
    const base = { id: s.slug, title: s.title, reachable: true };
    if (st === 'complete') return { ...base, summary: 'Completat', state: 'done' };
    if (st === 'error') return { ...base, state: 'error' };
    if (st === 'incomplete') return { ...base, summary: 'De completat', state: 'upcoming' };
    return { ...base, state: 'upcoming' };
  });
}

/**
 * The segment bar (below 1280; fish StepIndicator, c3): every segment up to and including the
 * current step is filled, the rest empty — position, not completeness. Every segment is reachable.
 */
export function wizardSegments(current: WizardStep): T4Step[] {
  const at = WIZARD_STEP_DEFS.findIndex(s => s.slug === current);
  return WIZARD_STEP_DEFS.map((s, i) => ({
    id: s.slug,
    title: s.title,
    state: i === at ? 'current' : i < at ? 'done' : 'upcoming',
    reachable: true,
  }));
}
