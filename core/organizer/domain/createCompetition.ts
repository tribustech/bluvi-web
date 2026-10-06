import * as z from 'zod';
import type { DraftCompetition, DraftMeta, OrganizerEditRiskCode } from '../schemas';
import { htmlToStrapiBlocks, strapiBlocksToHtml } from './richText';

/* ------------------------------------------------------------------ */
/* Wizard form — fish contexts/CreateCompetitionContext.tsx            */
/* ------------------------------------------------------------------ */

const optionalIntString = (isValid: (n: number) => boolean, message: string) =>
  z
    .string()
    .optional()
    .refine(value => {
      if (value === undefined || value === '') return true;
      return isValid(Number(value));
    }, { message });

// Relaxed schema — only validated fully on publish (the CMS enforces the rest in
// `organizerPublishDraft`: dates, deadline ≤ start, lake, sectors…).
export const createCompetitionSchema = z.object({
  name: z.string().min(3, 'Numele trebuie să aibă cel puțin 3 caractere'),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reward: z.string().optional(),
  regulation: z.string().optional(),
  banner: z.string().optional(),
  competitionType: z.enum(['single', 'team']).optional(),
  teamParticipants: optionalIntString(
    n => Number.isInteger(n) && n >= 1 && n <= 10,
    'Participanți per echipă trebuie să fie între 1 și 10.'
  ),
  participantsLimit: optionalIntString(n => Number.isInteger(n) && n >= 1, 'Capacitatea trebuie să fie cel puțin 1.'),
  registerFee: optionalIntString(
    n => Number.isFinite(n) && n >= 0 && n <= 50000,
    'Taxa de înscriere trebuie să fie între 0 și 50.000 RON.'
  ),
  fishSpeciesIds: z.array(z.string()).optional(),
  rankingType: z.string().optional(),
  excludeBiggestCatch: z.boolean().optional(),
  generalRankingWinnerMode: z.string().optional(),
  gridRule: z.string().optional(),
  bestOfFishCount: optionalIntString(
    n => Number.isInteger(n) && n >= 1 && n <= 100,
    'Numărul de pești trebuie să fie între 1 și 100.'
  ),
  bestOfTierSizes: z.array(z.number().int().positive()).optional(),
  numberOfWinners: optionalIntString(
    n => Number.isInteger(n) && n >= 1,
    'Numărul de câștigători trebuie să fie cel puțin 1.'
  ),
  lake: z.string().optional(),
  sectors: z.array(z.object({ name: z.string(), minFishNumber: z.number() })).optional(),
  standAllocations: z.record(z.string(), z.array(z.string())).optional(),
  sponsorIds: z.array(z.string()).optional(),
});
export type CreateCompetitionFormData = z.infer<typeof createCompetitionSchema>;

/** fish `useForm` defaultValues. */
export const createCompetitionDefaultValues: CreateCompetitionFormData = {
  name: '',
  competitionType: 'single',
  sectors: [],
  standAllocations: {},
  sponsorIds: [],
  fishSpeciesIds: [],
};

/** The minimal published-competition shape the edit flow hydrates from (`/feed/competitions/:id`). */
export type EditableCompetition = {
  name?: string | null;
  description?: readonly unknown[] | null;
  reward?: readonly unknown[] | null;
  regulation?: readonly unknown[] | null;
  startDate?: string | null;
  endDate?: string | null;
  banner?: { url?: string | null } | null;
  competitionType?: 'single' | 'team' | null;
  teamParticipants?: number | null;
  participantsLimit?: number | null;
  registerFee?: string | number | null;
  rankingType?: string | null;
  excludeBiggestCatch?: boolean | null;
  generalRankingWinnerMode?: string | null;
  gridRule?: string | null;
  bestOfFishCount?: number | null;
  bestOfTierSizes?: number[] | null;
  numberOfWinners?: number | null;
  lake?: { documentId?: string | null } | null;
  fishType?: { documentId: string }[] | null;
  sectors?: { name: string; minFishNumber?: number | null; stands?: { documentId?: string | null }[] | null }[] | null;
  sponsors?: { documentId: string }[] | null;
};

/** fish `mapCompetitionToFormData` — edit mode of a published competition. */
export function mapCompetitionToFormData(competition: EditableCompetition | null | undefined): CreateCompetitionFormData {
  const sectors = (competition?.sectors || []).map(sector => ({
    name: sector.name,
    minFishNumber: sector.minFishNumber ?? 1,
  }));

  const standAllocations = (competition?.sectors || []).reduce<Record<string, string[]>>((acc, sector) => {
    acc[sector.name] = (sector?.stands || [])
      .map(stand => stand?.documentId || null)
      .filter((standId): standId is string => typeof standId === 'string' && standId.length > 0);
    return acc;
  }, {});

  return {
    name: competition?.name || '',
    description: strapiBlocksToHtml(competition?.description),
    startDate: competition?.startDate || undefined,
    endDate: competition?.endDate || undefined,
    reward: strapiBlocksToHtml(competition?.reward),
    regulation: strapiBlocksToHtml(competition?.regulation),
    banner: competition?.banner?.url || undefined,
    competitionType: competition?.competitionType || 'single',
    teamParticipants: competition?.teamParticipants ? competition.teamParticipants.toString() : undefined,
    participantsLimit: competition?.participantsLimit ? competition.participantsLimit.toString() : undefined,
    registerFee: competition?.registerFee?.toString() || undefined,
    rankingType: competition?.rankingType || undefined,
    excludeBiggestCatch: competition?.excludeBiggestCatch ?? undefined,
    generalRankingWinnerMode: competition?.generalRankingWinnerMode || undefined,
    gridRule: competition?.gridRule || undefined,
    bestOfFishCount: competition?.bestOfFishCount?.toString() || undefined,
    bestOfTierSizes: competition?.bestOfTierSizes ?? undefined,
    numberOfWinners: competition?.numberOfWinners?.toString() || undefined,
    lake: competition?.lake?.documentId || undefined,
    fishSpeciesIds: (competition?.fishType || []).map(fish => fish.documentId),
    sectors,
    standAllocations,
    sponsorIds: (competition?.sponsors || []).map(sponsor => sponsor.documentId),
  };
}

/** fish provider `hydrate()` draft branch — a draft keeps sectors/allocations/sponsors in `draftMeta`. */
export function mapDraftToFormData(draft: DraftCompetition): CreateCompetitionFormData {
  const meta = draft.draftMeta ?? null;
  return {
    name: draft.name || '',
    description: strapiBlocksToHtml(draft.description),
    startDate: draft.startDate || undefined,
    endDate: draft.endDate || undefined,
    reward: strapiBlocksToHtml(draft.reward),
    regulation: strapiBlocksToHtml(draft.regulation),
    banner: draft.banner?.url || undefined,
    competitionType: draft.competitionType || 'single',
    teamParticipants: draft.teamParticipants ? draft.teamParticipants.toString() : undefined,
    participantsLimit: draft.participantsLimit ? draft.participantsLimit.toString() : undefined,
    registerFee: draft.registerFee?.toString() || undefined,
    rankingType: draft.rankingType || undefined,
    excludeBiggestCatch: draft.excludeBiggestCatch ?? undefined,
    generalRankingWinnerMode: draft.generalRankingWinnerMode || undefined,
    gridRule: draft.gridRule || undefined,
    bestOfFishCount: draft.bestOfFishCount?.toString() || undefined,
    bestOfTierSizes: draft.bestOfTierSizes ?? undefined,
    numberOfWinners: draft.numberOfWinners?.toString() || undefined,
    lake: draft.lake?.documentId || undefined,
    fishSpeciesIds: meta?.fishSpeciesIds || [],
    sectors: meta?.sectors || [],
    standAllocations: meta?.standAllocations || {},
    sponsorIds: meta?.sponsorIds || [],
  };
}

// Postgres rejects "" for biginteger/integer columns — drop empty numeric fields
// so the backend applies schema defaults instead of choking on the cast.
const NUMERIC_FIELDS = ['registerFee', 'participantsLimit', 'teamParticipants', 'numberOfWinners', 'bestOfFishCount'] as const;

/**
 * fish provider `buildPayload` — form values → the draft / organizer-edit request body.
 * Banner is uploaded separately (media upload), so it never goes in the payload.
 */
export function buildCompetitionPayload(values: CreateCompetitionFormData): Record<string, unknown> {
  const {
    sectors,
    standAllocations,
    sponsorIds,
    fishSpeciesIds,
    description,
    reward,
    regulation,
    banner,
    ...competitionFields
  } = values;
  void banner;

  const fields: Record<string, unknown> = { ...competitionFields };
  for (const key of NUMERIC_FIELDS) {
    const v = fields[key];
    if (v === '' || v === null) delete fields[key];
  }

  const draftMeta: DraftMeta = {
    sectors: sectors || [],
    standAllocations: Object.fromEntries(
      Object.entries(standAllocations || {}).map(([sectorName, standIds]) => [
        sectorName,
        (standIds || []).filter((standId): standId is string => typeof standId === 'string' && standId.trim().length > 0),
      ])
    ),
    sponsorIds: sponsorIds || [],
    fishSpeciesIds: fishSpeciesIds || [],
    completedSteps: [],
  };

  if (values.name) draftMeta.completedSteps.push(1);
  {
    const limitNum = values.participantsLimit ? Number(values.participantsLimit) : NaN;
    if (values.competitionType && Number.isInteger(limitNum) && limitNum >= 1) {
      draftMeta.completedSteps.push(2);
    }
  }
  if (values.rankingType) draftMeta.completedSteps.push(3);
  if (values.lake && (sectors?.length || 0) > 0) draftMeta.completedSteps.push(4);
  if (Object.values(standAllocations || {}).some(ids => ids.length > 0)) draftMeta.completedSteps.push(5);

  const payload: Record<string, unknown> = { ...fields, draftMeta };
  const derivedRegistrationDeadline = getRegistrationDeadlineFromStartDate(values.startDate);
  if (derivedRegistrationDeadline) {
    payload.registrationDeadline = derivedRegistrationDeadline;
  }
  const descBlocks = htmlToStrapiBlocks(description || '');
  const rewardBlocks = htmlToStrapiBlocks(reward || '');
  const regBlocks = htmlToStrapiBlocks(regulation || '');
  if (descBlocks) payload.description = descBlocks;
  if (rewardBlocks) payload.reward = rewardBlocks;
  if (regBlocks) payload.regulation = regBlocks;

  return payload;
}

/* ------------------------------------------------------------------ */
/* Dates — fish helpers/competitionDateConstraints.ts                  */
/* ------------------------------------------------------------------ */

export type CompetitionDateField = 'startDate' | 'endDate' | 'registrationDeadline';
type CompetitionDates = Partial<Record<CompetitionDateField, string | undefined>>;

/** Registration closes when the competition starts. */
export function getRegistrationDeadlineFromStartDate(startDate?: string): string | undefined {
  return startDate;
}

const isAfter = (aIso: string, bIso: string) => new Date(aIso).getTime() > new Date(bIso).getTime();
const isBefore = (aIso: string, bIso: string) => new Date(aIso).getTime() < new Date(bIso).getTime();

/** Keeps start ≤ end and deadline = start when one date picker changes. */
export function getDateConstraintUpdates(
  currentDates: CompetitionDates,
  changedField: CompetitionDateField,
  nextValueIso: string
): Partial<Record<CompetitionDateField, string>> {
  const next: CompetitionDates = {
    startDate: currentDates.startDate,
    endDate: currentDates.endDate,
    registrationDeadline: currentDates.registrationDeadline,
    [changedField]: nextValueIso,
  };

  const updates: Partial<Record<CompetitionDateField, string>> = { [changedField]: nextValueIso };

  if (next.startDate && next.endDate && isAfter(next.startDate, next.endDate)) {
    if (changedField === 'startDate') {
      updates.endDate = next.startDate;
      next.endDate = next.startDate;
    } else if (changedField === 'endDate') {
      updates.startDate = next.endDate;
      next.startDate = next.endDate;
    }
  }

  if (next.registrationDeadline && next.startDate) {
    const shouldAlignDeadlineToStart =
      changedField === 'startDate' || changedField === 'endDate' || isAfter(next.registrationDeadline, next.startDate);

    if (
      shouldAlignDeadlineToStart &&
      (isAfter(next.registrationDeadline, next.startDate) || isBefore(next.registrationDeadline, next.startDate))
    ) {
      updates.registrationDeadline = next.startDate;
    }
  }

  return updates;
}

/* ------------------------------------------------------------------ */
/* Stand capacity — fish helpers/standCapacityWarning.ts               */
/* ------------------------------------------------------------------ */

export type StandCapacityWarning = { configuredStands: number; participantsLimit: number; missingSlots: number };

/** Warns when fewer distinct stands are allocated than the participant limit. */
export function getStandCapacityWarning(
  participantsLimit?: number | null,
  standAllocations?: Record<string, string[] | undefined>
): StandCapacityWarning | null {
  if (typeof participantsLimit !== 'number' || participantsLimit <= 0) return null;

  const uniqueStandIds = new Set<string>();
  Object.values(standAllocations || {}).forEach(standIds => {
    (standIds || []).forEach(standId => {
      if (typeof standId === 'string' && standId.trim().length > 0) uniqueStandIds.add(standId);
    });
  });

  const configuredStands = uniqueStandIds.size;
  if (configuredStands >= participantsLimit) return null;

  return { configuredStands, participantsLimit, missingSlots: participantsLimit - configuredStands };
}

/* ------------------------------------------------------------------ */
/* Ranking step — fish app/(app)/create-competition/step-ranking.tsx  */
/* ------------------------------------------------------------------ */

/** bestOfTiers tier sizes typed as "9,7,5,3": positive ints, strictly descending, ≤ 20. */
export function parseTierSizesInput(raw: string): { tiers: number[] | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { tiers: null, error: null };

  const parts = trimmed.split(',').filter(Boolean);
  const parsed: number[] = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
      return { tiers: null, error: 'Pragurile trebuie să fie numere întregi pozitive (ex: 9,7,5,3).' };
    }
    parsed.push(n);
  }
  if (parsed.length === 0) return { tiers: null, error: 'Adaugă cel puțin un prag.' };
  if (parsed.length > 20) return { tiers: null, error: 'Sunt permise cel mult 20 de praguri.' };
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i] >= parsed[i - 1]) {
      return { tiers: null, error: 'Pragurile trebuie să fie ordonate descrescător și distincte.' };
    }
  }
  return { tiers: parsed, error: null };
}

export type GeneralModeValue = 'bySectorPosition' | 'bySectorPositionPerisReversed';

/** Which metric decides the general ranking for a ranking type + general mode. */
export function getGeneralPriorityMetric(rankingType: string, mode: GeneralModeValue): 'quantity' | 'quality' {
  if (rankingType === 'quality') return 'quality';
  if (rankingType === 'quantity') return 'quantity';
  if (rankingType === 'quantityQuality') return mode === 'bySectorPositionPerisReversed' ? 'quality' : 'quantity';
  if (rankingType === 'qualityQuantity') return mode === 'bySectorPositionPerisReversed' ? 'quantity' : 'quality';
  return 'quantity';
}

/* ------------------------------------------------------------------ */
/* Edit risk copy — fish helpers/competitionEditRiskMessages.ts        */
/* ------------------------------------------------------------------ */

const RISK_MESSAGES: Record<OrganizerEditRiskCode, string> = {
  LAKE_CHANGED_WITH_ALLOCATIONS: 'Schimbarea lacului invalidează alocările curente de standuri.',
  PARTICIPANTS_LIMIT_BELOW_REGISTERED: 'Limita nouă este mai mică decât numărul de participanți deja înscriși.',
  PARTICIPANTS_LIMIT_BELOW_ALLOCATED: 'Limita nouă invalidează alocările existente pe standuri.',
  STAND_ALLOCATIONS_INVALID_FOR_NEW_LAKE: 'Standurile alocate nu mai sunt valide pentru lacul nou selectat.',
  SECTORS_CHANGED_WITH_ALLOCATIONS: 'Modificarea sectoarelor necesită realocarea standurilor.',
};

const RISK_FALLBACK_MESSAGE =
  'Modificările propuse au impact asupra competiției. Revizuiește și confirmă pentru a continua.';

export function getCompetitionEditRiskMessage(riskCode: string): string {
  return RISK_MESSAGES[riskCode as OrganizerEditRiskCode] || RISK_FALLBACK_MESSAGE;
}

export function getCompetitionEditRiskFallbackMessage() {
  return RISK_FALLBACK_MESSAGE;
}

/* ------------------------------------------------------------------ */
/* Auto-save — fish helpers/createCompetitionAutoSave.ts               */
/* ------------------------------------------------------------------ */

export type AutoSaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; at: Date }
  | { status: 'error'; at: Date };

export type AutoSaveLabel = { icon: 'saving' | 'saved' | 'error'; text: string };

export function formatAutoSaveLabel(state: AutoSaveState): AutoSaveLabel | null {
  if (state.status === 'idle') return null;
  if (state.status === 'saving') return { icon: 'saving', text: 'Se salvează...' };
  if (state.status === 'saved') {
    const hh = state.at.getHours().toString().padStart(2, '0');
    const mm = state.at.getMinutes().toString().padStart(2, '0');
    return { icon: 'saved', text: `Salvat la ${hh}:${mm}` };
  }
  return { icon: 'error', text: 'Nu s-a putut salva automat' };
}

export type AutoSaveGateContext = {
  isOnline: boolean;
  isEditCompetitionMode: boolean;
  name: string | undefined;
  isDirty: boolean;
  isInFlight: boolean;
};

/** Drafts only (never a published competition), online, dirty, with a valid name. */
export function shouldAttemptAutoSave(ctx: AutoSaveGateContext): boolean {
  if (!ctx.isOnline) return false;
  if (ctx.isEditCompetitionMode) return false;
  if (ctx.isInFlight) return false;
  if (!ctx.isDirty) return false;
  return (ctx.name ?? '').trim().length >= 3;
}
