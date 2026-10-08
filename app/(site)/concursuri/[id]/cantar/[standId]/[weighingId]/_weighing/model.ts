import type { CatchData, WeighingByStand, WeighingDetail } from '@/core/organizer';
import { splitWeightWithScaleConstraint } from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { formatDecimal } from '@/components/cards/format';
import type { CompetitionRole } from '../../../../_organizer/access';

/*
 * The weighing screen's pure rules (parity organizer.scale-weighing; fish app/(app)/scale/[competitionId]/add.tsx,
 * components/AddCatchSheet.tsx, ReopenWeighingSheet.tsx). No React, no storage: unit-tested in model.test.ts.
 */

/** fish AddCatchSheet MAX_QUANTITY and the «too big to be true» ceiling. */
export const MAX_QUANTITY = 20;
export const MAX_WEIGHT_KG = 60;
/** fish «Fișiere media (max. 3)»: the button turns off at 3. */
export const MAX_MEDIA = 3;
/** fish ReopenWeighingSheet maxLength. */
export const MAX_REASON = 100;
/** fish LAST_FISH_SPECIES_ID_KEY (AsyncStorage) — localStorage on the web, namespaced. */
export const LAST_SPECIES_KEY = 'bluvi:lastFishSpeciesId';

/** «x,xxx kg»'s number: three decimals, comma (fish toFixed(3) with the Romanian separator). */
export const kg = (n: number) => formatDecimal(n, 3, 3);

/** c1: the sum of the catches (fish `totalWeight`, reduce + toFixed(3)). */
export const totalKg = (weighing: Pick<WeighingDetail, 'catches'> | undefined) =>
  (weighing?.catches ?? []).reduce((acc, c) => acc + c.weight, 0);

/**
 * c1: «Cântar N» — N is the weighing's place in the stand's list (fish CantarItem «Cântar {index + 1}»,
 * the number the history shows); «(Extra)» as the history marks it. Unknown place: «Cântar» (fish
 * `Cântar {scaleNumber || ''}`).
 */
export function weighingTitle(
  weighingId: string,
  standWeighings: Pick<WeighingByStand, 'documentId'>[] | undefined,
  weighingType: string | undefined,
): string {
  const index = standWeighings?.findIndex((w) => w.documentId === weighingId) ?? -1;
  const base = index >= 0 ? `Cântar ${index + 1}` : 'Cântar';
  return weighingType === 'extra' ? `${base} (Extra)` : base;
}

/** c3: «Acest cântar a avut o modificare.» / «… N modificări.» (formatCount: «20 de modificări»). */
export function revisionsCopy(count: number): string {
  return `Acest cântar a avut ${count === 1 ? 'o modificare' : formatCount(count, 'modificare', 'modificări')}.`;
}

/** What decides whether the CMS would accept a reopen (reopenCantar). */
export type ReopenContext = {
  weighingId: string;
  competition: { competitionStatus?: string | null; roundStatus?: string | null } | undefined;
  /** The stand's weighings (GET /feed/weighings/by-stand); undefined = not known. */
  standWeighings: Pick<WeighingByStand, 'documentId' | 'weighingStatus'>[] | undefined;
};

/**
 * c19 — reopenCantar refuses unless the competition is `started`, the running leg is not closed and
 * no other weighing on the stand is open (docs/domain/competitions.md, invariants 15 and 40). fish
 * offers the button anyway and lets the CMS refuse it; the web hides an action it knows will fail
 * (owner rule 4) — and while the stand's list is unknown it cannot know, so it hides it too.
 */
export function reopenAllowed(ctx: ReopenContext | undefined): boolean {
  if (!ctx?.competition || !ctx.standWeighings) return false;
  if (ctx.competition.competitionStatus !== 'started' || ctx.competition.roundStatus === 'closed') return false;
  return !ctx.standWeighings.some((w) => w.weighingStatus === 'started' && w.documentId !== ctx.weighingId);
}

/**
 * What the viewer may do here (fish add.tsx:83-110). `role` undefined = the statute is not known yet:
 * nothing is offered (owner rule 4). fish reads `userRole` only; the web role also counts the CMS's
 * additive `isReferee` (access.ts) — the CMS stays the authority on every write.
 */
export function weighingPermissions(
  role: CompetitionRole | undefined,
  status: WeighingDetail['weighingStatus'] | undefined,
  reopen?: ReopenContext,
) {
  const finished = status === 'finished';
  return {
    /** c5: add, delete, finalize — author or referee while the weighing is open. */
    actions: (role === 'author' || role === 'referee') && status !== undefined && !finished,
    /** c17: anyone with a part in the competition, once finished. */
    signatures: finished && role !== undefined && role !== 'none',
    /** c19: the author only, once finished, and only when the CMS can accept it (reopenAllowed). */
    reopen: finished && role === 'author' && reopenAllowed(reopen),
  };
}

/* ------------------------------------------------------------------ */
/* Add catch — fish AddCatchSheet rules                                */
/* ------------------------------------------------------------------ */

/** While typing: digits and separators only, the first separator kept («4,2,5» → «4,25»). */
export const sanitizeWeight = (v: string) => v.replace(/[^\d.,]/g, '').replace(/([.,].*?)[.,]/g, '$1');

/** fish `parseFloat(value.replace(',', '.'))`. */
export const parseWeight = (raw: string) => Number.parseFloat(raw.trim().replace(',', '.'));

export type CatchErrors = { weight?: string; quantity?: string; species?: string };

/** fish's messages (diacritics restored), in fish's order: required, > 0, ≤ 60; quantity 1–20; species. */
export function validateCatch(weight: string, quantity: number, species: string): CatchErrors {
  const e: CatchErrors = {};
  const w = parseWeight(weight);
  if (!weight.trim()) e.weight = 'Acest câmp este obligatoriu';
  else if (!(w > 0)) e.weight = 'Greutatea trebuie să fie mai mare decât 0';
  else if (w > MAX_WEIGHT_KG) e.weight = 'Ai introdus o valoare prea mare ca să fie adevărată! Mai verifică o dată, te rog.';
  if (!Number.isFinite(quantity)) e.quantity = 'Acest câmp este obligatoriu';
  else if (quantity < 1) e.quantity = 'Cantitatea trebuie să fie mai mare ca 1';
  else if (quantity > MAX_QUANTITY) e.quantity = `Max ${MAX_QUANTITY}`;
  if (!species) e.species = 'Acest câmp este obligatoriu';
  // Deliberate break from fish (AddCatchSheet posts them): a split whose parts round to 0 kg would
  // post zero-weight catches (the CMS accepts weight ≥ 0).
  if (!e.weight && !e.quantity && splitPreview(weight, quantity).some((p) => p <= 0))
    e.weight = `Greutatea este prea mică pentru ${formatCount(quantity, 'pește', 'pești')}`;
  return e;
}

export const hasErrors = (e: CatchErrors) => Boolean(e.weight || e.quantity || e.species);

/**
 * c9: the «Pești» preview — above 1 fish, the weight split in 0.025 kg steps (fish displayFishSplitWeights:
 * quantity > 1, a weight typed, no quantity error).
 */
export function splitPreview(weight: string, quantity: number): number[] {
  const w = parseWeight(weight);
  if (!(Number.isInteger(quantity) && quantity > 1 && quantity <= MAX_QUANTITY) || !(w > 0)) return [];
  return splitWeightWithScaleConstraint(w, quantity);
}

/**
 * c9: the split's total when it differs from the typed weight (the 0.025 kg steps drop or add grams:
 * 4,26 kg in 2 → 2,125 + 2,125 = 4,250). null when they match or there is no split.
 */
export function splitDrift(weight: string, quantity: number): number | null {
  const parts = splitPreview(weight, quantity);
  if (parts.length === 0) return null;
  const sum = Math.round(parts.reduce((a, b) => a + b, 0) * 1000) / 1000;
  return Math.abs(sum - Math.round(parseWeight(weight) * 1000) / 1000) >= 0.0005 ? sum : null;
}

/** fish onSubmit's body: the split parts, or one catch rounded to 3 decimals. */
export function catchData(weight: string, quantity: number, fishType: string): CatchData {
  const split = splitPreview(weight, quantity);
  if (split.length > 0) return split.map((w) => ({ weight: w, fishType }));
  return [{ weight: Number(parseWeight(weight).toFixed(3)), fishType }];
}

/* ------------------------------------------------------------------ */
/* Reopen — fish ReopenWeighingSheet rules                             */
/* ------------------------------------------------------------------ */

export function validateReason(reason: string): string | undefined {
  if (!reason.trim()) return 'Acest câmp este obligatoriu';
  if (reason.length > MAX_REASON) return `Motivul trebuie să fie mai scurt de ${MAX_REASON} de caractere`;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Signatures — fish add.tsx handleEndCantar                           */
/* ------------------------------------------------------------------ */

/** fish's file names (`refereeSignature-weighingDocumentId-<id>.png`). */
export const signatureFilename = (who: 'referee' | 'witness', weighingDocumentId: string) =>
  `${who}Signature-weighingDocumentId-${weighingDocumentId}.png`;

/** fish `'CatchID_' + catch.id + '_' + name`. */
export const catchMediaFilename = (catchId: number, name: string) => `CatchID_${catchId}_${name || 'image.jpg'}`;
