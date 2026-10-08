import {
  getGeneralRankingWinnerModeLabel,
  getRankingTypeLabel,
  getStandCapacityWarning,
  GRID_RULE_LABELS,
  requiresMinFishNumber,
  type CreateCompetitionFormData,
  type StandCapacityWarning,
} from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import type { WizardStep } from '@/lib/routes';
import {
  fieldErrors,
  reviewErrors,
  type WizardField,
  type WizardFieldErrors,
  type WizardReviewErrors,
  type WizardStepStatus,
} from '../../model';
import { legLabel } from '../clasament/model';
import { formatDay, formatTime } from '../detalii/format';

/*
 * Step «Revizuire» as data (parity organizer.step-review c1–c10; fish
 * app/(app)/create-competition/step-review.tsx): four sections of rows, each row a value, a
 * «Lipsește» (a missing required value) or an error, plus the notes fish prints under a row (the
 * fee range, the stand shortage) and the amber capacity warning. The error CODES are the frame's
 * own (../../model reviewErrors, which also gates «Publică competiția»), so what turns a section
 * red here is exactly what keeps the button disabled. Pure; unit-tested in model.test.ts.
 */

export type ReviewSectionId = keyof WizardReviewErrors;

export type ReviewNote = { tone: 'danger' | 'warning'; text: string };

export type ReviewRow = {
  key: string;
  label: string;
  /** The value printed at the right; null while it is loading (the lake's name). */
  value: string | null;
  /** fish MissingField: the label and «Lipsește» in red. */
  missing?: true;
  /** fish ReviewRow `error`: the label and this text (instead of the value) in red. */
  error?: string;
  /** A line under the row (fee range, stand shortage). */
  note?: ReviewNote;
  /** A sector's row: its name (the coloured badge). */
  sector?: string;
};

export type ReviewSection = {
  id: ReviewSectionId;
  title: string;
  /** The step «Editează» / «Completează» returns to. */
  step: WizardStep;
  hasError: boolean;
  rows: ReviewRow[];
  /** A note under the section's rows, before the per-sector rows (the capacity warning). */
  warning?: ReviewNote;
  /** Rows after the warning (fish: the lake's error rows). */
  tail?: ReviewRow[];
  /** One row per sector (fish: after the error rows). */
  sectors?: ReviewRow[];
};

export type ReviewModel = {
  sections: ReviewSection[];
  errors: WizardReviewErrors;
  hasAnyError: boolean;
  /** Every problem in reading order: the error summary's lines (label · message · section). */
  problems: { key: string; section: ReviewSectionId; text: string }[];
  /** Fewer stands than places (not a blocker: publish stays allowed, the review says so). */
  capacity: StandCapacityWarning | null;
};

export type ReviewInput = {
  values: CreateCompetitionFormData;
  /** The selected lake's name; null while it loads; undefined when it could not be read. */
  lakeName: string | null | undefined;
};

export const SECTION_TITLES: Record<ReviewSectionId, string> = {
  basics: 'Detalii de bază',
  config: 'Configurare',
  ranking: 'Clasament',
  lakeSectors: 'Lac și sectoare',
};

const SECTION_STEPS: Record<ReviewSectionId, WizardStep> = {
  basics: 'detalii',
  config: 'configurare',
  ranking: 'clasament',
  lakeSectors: 'lac-si-sectoare',
};

export const MISSING = 'Lipsește';
export const FEE_RANGE_ERROR = 'Taxa de înscriere trebuie să fie între 0 și 50.000 RON.';

/** fish `format(date, 'd MMM yyyy, HH:mm')`, in Romanian (the detalii step's own label). */
export function formatReviewDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${formatDay(d)}, ${formatTime(d)}`;
}

/** fish: «X RON» when the fee is above 0, else «Gratuit». */
export function formatFee(registerFee: string | undefined): string {
  const n = registerFee ? Number(registerFee) : NaN;
  return Number.isFinite(n) && n > 0 ? `${registerFee} RON` : 'Gratuit';
}

const entity = (isTeam: boolean) => (isTeam ? { one: 'echipă', many: 'echipe' } : { one: 'participant', many: 'participanți' });

/**
 * fish step-review.tsx:350-367 — the red line under «Total participanți»: no stand, or only K,
 * for N participants / teams.
 */
export function standShortageText(w: StandCapacityWarning, isTeam: boolean): string {
  const e = entity(isTeam);
  const forWhom = formatCount(w.participantsLimit, e.one, e.many);
  return w.configuredStands === 0
    ? `Nu ai standuri pe lac pentru ${forWhom}.`
    : `Ai doar ${formatCount(w.configuredStands, 'stand', 'standuri')} pe lac pentru ${forWhom}.`;
}

/**
 * fish step-review.tsx:481-502 — the amber warning of «Lac și sectoare», with the plurals and the
 * participle agreeing (fish says «alocați» for teams too).
 */
export function capacityWarningText(w: StandCapacityWarning, isTeam: boolean): string {
  const e = entity(isTeam);
  const missing = formatCount(w.missingSlots, e.one, e.many);
  const verb = w.missingSlots === 1 ? 'nu va putea fi' : 'nu vor putea fi';
  const participle = isTeam ? (w.missingSlots === 1 ? 'alocată' : 'alocate') : w.missingSlots === 1 ? 'alocat' : 'alocați';
  return (
    `Avertisment: ai configurat ${formatCount(w.configuredStands, 'stand', 'standuri')} pentru ` +
    `${formatCount(w.participantsLimit, e.one, e.many)}. Cel puțin ${missing} ${verb} ${participle} pe stand.`
  );
}

/** fish step-review.tsx:425-438 — tiers that are not positive, strictly descending integers. */
export function tiersInvalidText(tiers: readonly number[] | undefined): string {
  return `Pragurile (${(tiers ?? []).join(', ')}) trebuie să fie întregi pozitive, ordonate descrescător și distincte.`;
}

/** fish step-review.tsx:440-452 — more tiers than allocated stands. */
export function tiersInsufficientText(tierCount: number, allocatedStands: number): string {
  const target = tierCount === 1 ? 'un stand' : formatCount(tierCount, 'stand', 'standuri');
  return `Ai ${formatCount(tierCount, 'prag', 'praguri')} dar doar ${formatCount(allocatedStands, 'stand', 'standuri')}. Alocă cel puțin ${target}.`;
}

/**
 * A schema error on a field no row shows (a type-owned value left over from another type — a
 * hydrated draft or an edited competition skips the clearing the steps do on a type switch): the
 * card it belongs to and the label it is listed under, so the frame gate never blocks silently.
 */
const FIELD_SECTION: Record<WizardField, ReviewSectionId> = {
  name: 'basics',
  description: 'basics',
  startDate: 'basics',
  endDate: 'basics',
  reward: 'basics',
  regulation: 'basics',
  banner: 'basics',
  registerFee: 'basics',
  sponsorIds: 'basics',
  competitionType: 'config',
  teamParticipants: 'config',
  participantsLimit: 'config',
  fishSpeciesIds: 'config',
  rankingType: 'ranking',
  excludeBiggestCatch: 'ranking',
  generalRankingWinnerMode: 'ranking',
  gridRule: 'ranking',
  bestOfFishCount: 'ranking',
  bestOfTierSizes: 'ranking',
  roundsCount: 'ranking',
  numberOfWinners: 'ranking',
  lake: 'lakeSectors',
  sectors: 'lakeSectors',
  standAllocations: 'lakeSectors',
};

const FIELD_LABELS: Partial<Record<WizardField, string>> = {
  name: 'Nume',
  description: 'Descriere',
  reward: 'Premii',
  regulation: 'Regulament',
  banner: 'Afiș',
  registerFee: 'Taxă înscriere',
  sponsorIds: 'Sponsori',
  competitionType: 'Tip competiție',
  teamParticipants: 'Participanți/echipă',
  participantsLimit: 'Total participanți',
  fishSpeciesIds: 'Specii de pește',
  rankingType: 'Tip clasament',
  generalRankingWinnerMode: 'Mod clasament general',
  gridRule: 'Regula departajare',
  bestOfFishCount: 'Nr. pești clasament',
  bestOfTierSizes: 'Praguri Best of',
  roundsCount: 'Număr de manșe',
  numberOfWinners: 'Nr. câștigători',
  lake: 'Lac',
  sectors: 'Sectoare',
  standAllocations: 'Standuri alocate',
};

const positiveNumber = (raw: string | undefined): number | null => {
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * One row: «Lipsește» when the frame's review gate says so; the schema's message when the field
 * fails createCompetitionSchema (a 2-letter name, 150 fish — the frame blocks publish on those too,
 * so the section must say why); else the value (empty → not listed, fish ReviewRow).
 */
function makeRow(schema: WizardFieldErrors, shown: Set<string>) {
  return (key: string, label: string, codes: readonly string[], value: string | null | undefined): ReviewRow | null => {
    shown.add(key);
    if (codes.includes(key)) return { key, label, value: null, missing: true };
    const invalid = schema[key as keyof WizardFieldErrors];
    if (invalid) return { key, label, value: null, error: invalid };
    if (value === undefined || value === '') return null;
    return { key, label, value };
  };
}

const compact = (rows: (ReviewRow | null)[]): ReviewRow[] => rows.filter((r): r is ReviewRow => r !== null);

export function buildReview({ values, lakeName }: ReviewInput): ReviewModel {
  const errors = reviewErrors(values);
  const schema = fieldErrors(values);
  // The fields whose schema error a row already says (the rest get a row of their own below).
  const shown = new Set<string>();
  const row = makeRow(schema, shown);
  const isTeam = values.competitionType === 'team';
  const limit = positiveNumber(values.participantsLimit);
  const capacity = limit !== null ? getStandCapacityWarning(limit, values.standAllocations) : null;
  const allocatedStands = Object.values(values.standAllocations ?? {}).flatMap((v) => (Array.isArray(v) ? v : [])).length;
  const minFish = requiresMinFishNumber(values.rankingType);

  /* ── Detalii de bază (c3) ── */
  const b = errors.basics;
  const fee: ReviewRow = { key: 'registerFee', label: 'Taxă înscriere', value: formatFee(values.registerFee) };
  shown.add('registerFee');
  if (b.includes('registerFee') || schema.registerFee) fee.note = { tone: 'danger', text: FEE_RANGE_ERROR };
  const basics = compact([
    row('name', 'Nume', b, values.name),
    row('startDate', 'Data început', b, formatReviewDate(values.startDate)),
    row('endDate', 'Data sfârșit', b, formatReviewDate(values.endDate)),
    fee,
  ]);

  /* ── Configurare (c4, c5) ── */
  const c = errors.config;
  const limitLabel = isTeam ? 'Total echipe' : 'Total participanți';
  const limitRow = row('participantsLimit', limitLabel, c, values.participantsLimit);
  if (limitRow && !limitRow.missing && capacity) limitRow.note = { tone: 'danger', text: standShortageText(capacity, isTeam) };
  const species = values.fishSpeciesIds?.length ?? 0;
  const config = compact([
    row('competitionType', 'Tip competiție', c, values.competitionType ? (isTeam ? 'Echipă' : 'Individual') : undefined),
    isTeam ? row('teamParticipants', 'Participanți/echipă', c, values.teamParticipants) : null,
    limitRow,
    row('fishSpeciesIds', 'Specii de pește', c, species > 0 ? formatCount(species, 'specie', 'specii') : undefined),
  ]);

  /* ── Clasament (c6, c7) ── */
  const r = errors.ranking;
  const type = values.rankingType;
  const tiers = values.bestOfTierSizes ?? [];
  const tierRow = (): ReviewRow | null => {
    shown.add('bestOfTierSizes');
    if (r.includes('bestOfTierSizes')) return { key: 'bestOfTierSizes', label: 'Praguri Best of', value: null, missing: true };
    if (r.includes('bestOfTierSizesInvalid')) return { key: 'bestOfTierSizes', label: 'Praguri Best of', value: null, error: tiersInvalidText(tiers) };
    return { key: 'bestOfTierSizes', label: 'Praguri Best of', value: tiers.join(', ') };
  };
  const ranking = compact([
    row('rankingType', 'Tip clasament', r, getRankingTypeLabel(type)),
    values.generalRankingWinnerMode
      ? row('generalRankingWinnerMode', 'Mod clasament general', r, getGeneralRankingWinnerModeLabel(values.generalRankingWinnerMode, type))
      : null,
    values.gridRule ? row('gridRule', 'Regula departajare', r, GRID_RULE_LABELS[values.gridRule] ?? values.gridRule) : null,
    type === 'bestOf' ? row('bestOfFishCount', 'Nr. pești clasament', r, values.bestOfFishCount) : null,
    type === 'bestOf' ? row('numberOfWinners', 'Nr. câștigători', r, values.numberOfWinners) : null,
    type === 'feederRounds' ? row('roundsCount', 'Număr de manșe', r, values.roundsCount ? legLabel(values.roundsCount) : undefined) : null,
    type === 'bestOfTiers' ? tierRow() : null,
    r.includes('bestOfTiersInsufficientStands')
      ? { key: 'allocatedStands', label: 'Standuri alocate', value: null, error: tiersInsufficientText(tiers.length, allocatedStands) }
      : null,
  ]);

  /* ── Lac și sectoare (c8, c9, c10) ── */
  const l = errors.lakeSectors;
  const sectors = values.sectors ?? [];
  const lakeRow: ReviewRow = l.includes('lake')
    ? { key: 'lake', label: 'Lac', value: null, missing: true }
    : // fish: the name, else «Selectat» (the lake could not be read: true, and nothing more).
      { key: 'lake', label: 'Lac', value: lakeName === undefined ? 'Selectat' : lakeName };
  const lake = compact([lakeRow, row('sectors', 'Sectoare', l, sectors.length ? formatCount(sectors.length, 'sector', 'sectoare') : undefined)]);
  const lakeTail = compact([
    l.includes('sectorCount') ? { key: 'sectorCount', label: 'Campionat Național / FIPSed', value: null, error: 'Necesită exact 3 sectoare' } : null,
    l.includes('bestOfTiersSectorCount') ? { key: 'bestOfTiersSectorCount', label: 'Best of cu praguri', value: null, error: 'Necesită exact 1 sector' } : null,
    l.includes('minFishNumber') ? { key: 'minFishNumber', label: 'Nr. minim pești', value: null, error: 'Minim 1 per sector' } : null,
  ]);
  const sectorRows = sectors.map((s): ReviewRow => {
    const stands = formatCount(values.standAllocations?.[s.name]?.length ?? 0, 'stand', 'standuri');
    const base = { key: `sector-${s.name}`, label: `Sector ${s.name}`, sector: s.name };
    if (minFish && s.minFishNumber < 1) return { ...base, value: null, error: `Min pești invalid (${s.minFishNumber})` };
    return { ...base, value: minFish ? `${stands}, min ${formatCount(s.minFishNumber, 'pește', 'pești')}` : stands };
  });

  // A schema error no row shows (teamParticipants «11» on an individual competition, bestOfFishCount
  // «150» when the type is not bestOf…): listed in its card, so «Publică» is never disabled silently.
  const hidden: Record<ReviewSectionId, ReviewRow[]> = { basics: [], config: [], ranking: [], lakeSectors: [] };
  for (const [key, message] of Object.entries(schema) as [WizardField, string][]) {
    if (shown.has(key)) continue;
    hidden[FIELD_SECTION[key] ?? 'basics'].push({ key, label: FIELD_LABELS[key] ?? key, value: null, error: message });
  }
  basics.push(...hidden.basics);
  config.push(...hidden.config);
  ranking.push(...hidden.ranking);
  lakeTail.push(...hidden.lakeSectors);

  const section = (id: ReviewSectionId, rows: ReviewRow[], extra: Partial<ReviewSection> = {}): ReviewSection => {
    const all = [...rows, ...(extra.tail ?? []), ...(extra.sectors ?? [])];
    return {
      id,
      title: SECTION_TITLES[id],
      step: SECTION_STEPS[id],
      // The stand shortage under «Total participanți» is a red note, not an error (fish: the card stays neutral).
      hasError: errors[id].length > 0 || all.some((x) => x.missing || x.error || (x.key === 'registerFee' && x.note)),
      rows,
      ...extra,
    };
  };

  const sections = [
    section('basics', basics),
    section('config', config),
    section('ranking', ranking),
    section('lakeSectors', lake, {
      ...(capacity ? { warning: { tone: 'warning' as const, text: capacityWarningText(capacity, isTeam) } } : {}),
      tail: lakeTail,
      sectors: sectorRows,
    }),
  ];

  // The error summary: one line per problem (a sector's own «Min pești invalid» is already said by
  // «Nr. minim pești: Minim 1 per sector»).
  const problems: ReviewModel['problems'] = [];
  for (const s of sections) {
    for (const rr of [...s.rows, ...(s.tail ?? [])]) {
      const key = `${s.id}-${rr.key}`;
      if (rr.missing) problems.push({ key, section: s.id, text: `${rr.label}: lipsește` });
      else if (rr.error) problems.push({ key, section: s.id, text: `${rr.label}: ${rr.error}` });
      else if (rr.key === 'registerFee' && rr.note) problems.push({ key, section: s.id, text: rr.note.text });
    }
  }

  const hasAnyError = sections.some((s) => s.hasError);
  return { sections, errors, hasAnyError, problems, capacity };
}

/**
 * The rail's status per step on the review page, from the same codes as the cards: a red card is a
 * red step; «Alocă standuri» is still to do while no stand is allocated or there are fewer stands
 * than places, and red when there are fewer stands than Best-of tiers.
 */
export function reviewStepStatus(values: CreateCompetitionFormData): Partial<Record<WizardStep, WizardStepStatus>> {
  const m = buildReview({ values, lakeName: null });
  const of = (id: ReviewSectionId): WizardStepStatus => (m.sections.find((s) => s.id === id)?.hasError ? 'error' : 'complete');
  const allocated = Object.values(values.standAllocations ?? {}).some((v) => Array.isArray(v) && v.length > 0);
  const standuri: WizardStepStatus = m.errors.ranking.includes('bestOfTiersInsufficientStands')
    ? 'error'
    : !allocated || m.capacity
      ? 'incomplete'
      : 'complete';
  return {
    detalii: of('basics'),
    configurare: of('config'),
    clasament: of('ranking'),
    'lac-si-sectoare': of('lakeSectors'),
    standuri,
  };
}
