import type { RaffleState } from '@/core/organizer';
import { chancesLabel, raffleCopy } from '../../_shared/copy';

/*
 * «Șansele mele» (participant.raffle-status; fish app/(app)/raffle/status.tsx). The status strings
 * fish keeps inline or that the shared copy does not carry yet live here; the rest is
 * raffleCopy.status. fish spells them with the cedilla (Ş, ş); the web uses the comma below (Ș, ș).
 */
export const statusCopy = {
  /** status.tsx:158 */
  ended: 'Tragerea s-a încheiat.',
  /** status.tsx:174-178 */
  typesTitle: 'Tipul premiilor alese',
  typesBody: 'Poți schimba tipul (Crap, Feeder sau Răpitor) până la termenul limită stabilit în timpul tombolei.',
  /** status.tsx:196 */
  typeChangeFailed: 'Nu am putut schimba tipul. Te rugăm să încerci din nou.',
  /**
   * Web only: fish just greys the other types out after the deadline; the web says why — in place
   * of typesBody, which is no longer true then (rule 4).
   */
  typeLocked: 'Termenul limită a trecut: tipul nu mai poate fi schimbat.',
  /** Web only: the same after the draw. */
  typeLockedEnded: 'Tragerea s-a încheiat: tipul nu mai poate fi schimbat.',
  /** Web only: a type picked with the keyboard is not saved until confirmed (c5, explicit commit). */
  typeConfirmCta: (label: string) => `Schimbă în ${label}`,
  typeUnsaved: (saved: string) => `Tipul tău rămâne ${saved} până confirmi.`,
  /** Web only: the screen-reader word on the tile while the re-join runs. */
  typeChanging: 'Se schimbă tipul…',
  /** Web only (as the confirmation): registration closed, no receipt yet — a first upload is final. */
  firstUploadFinal: 'Înscrierile s-au închis: după ce îl încarci, bonul nu mai poate fi înlocuit sau șters.',
  /** Web only: a failed background refresh over data already on screen (rule 4). */
  refreshFailed: 'Nu am putut actualiza tombola. Ce vezi poate să nu fie la zi.',
  /** constants/raffleCopy.ts:150-156 — the three prizes shown while the session has none of its own. */
  staticPrizes: [
    { title: 'Echipament premium de pescuit', description: 'Lansete, mulinete și accesorii de pescuit de înaltă calitate' },
    { title: 'Merchandise Bluvi', description: 'Tricouri, șepci și alte produse oficiale Bluvi' },
    { title: 'Premii speciale expoziție', description: 'Premii exclusive disponibile doar la Bluvi Expo' },
  ],
} as const;

/** c2: fish counts 1 for the entry and 2 for an uploaded receipt (status.tsx:59-60). */
export const ENTRY_CHANCES = 1;
export function bonusChances(receiptUploaded: boolean): number {
  return receiptUploaded ? 2 : 0;
}

/**
 * c2: the words after the hero figure. fish always says «şanse de câștig»; the web agrees with the
 * figure (formatCount): «1 șansă de câștig», «3 șanse de câștig», «20 de șanse de câștig».
 */
export function chancesToWinUnit(n: number): string {
  return `${chancesLabel(n).replace(/^\S+\s/, '')} de câștig`;
}

/** c2: with a receipt, «Total șanse cu bon: {n} șanse» (fish: always «șanse»; the web: formatCount). */
export function totalWithReceiptLine(n: number): string {
  return `${raffleCopy.status.totalChancesWithReceipt} ${chancesLabel(n)}`;
}

/**
 * c5: a type tile is off once the type can no longer change (the deadline passed, or the end), except
 * the chosen one (fish status.tsx:184-186); every tile is off while a change runs (the fieldset).
 */
export function typeTileDisabled(key: string, chosen: string | null, canChangeType: boolean): boolean {
  return !canChangeType && key !== chosen;
}

/**
 * c5: the one line under the type card's title. While the type can change, fish's body; after the
 * deadline or the draw the body is no longer true, so the lock line replaces it (rule 4).
 */
export function typesNote(state: Pick<RaffleState, 'canChangeType' | 'isEnded'>): { text: string; locked: boolean } {
  if (state.isEnded) return { text: statusCopy.typeLockedEnded, locked: true };
  if (!state.canChangeType) return { text: statusCopy.typeLocked, locked: true };
  return { text: statusCopy.typesBody, locked: false };
}

export type StatusReceiptBlock = 'receipt' | 'upload' | null;

/**
 * c7: before the end, the receipt card with a receipt and the add card without one; after the end
 * neither (fish status.tsx:298). Without a session there is nothing to upload to.
 */
export function statusReceiptBlock(state: Pick<RaffleState, 'isEnded' | 'receiptUploaded' | 'sessionDocumentId'>): StatusReceiptBlock {
  if (state.isEnded || !state.sessionDocumentId) return null;
  return state.receiptUploaded ? 'receipt' : 'upload';
}

/**
 * Web only (as the confirmation): fish renders the page with 0 chances for a viewer who is not in
 * the raffle; the web hands over to the intro (/tombola), which shows the join form or sends the
 * viewer home / to the winners. Decided only on settled data.
 */
export function leaveForIntro(state: Pick<RaffleState, 'joined'>, { fetching }: { fetching: boolean }): boolean {
  return !state.joined && !fetching;
}
