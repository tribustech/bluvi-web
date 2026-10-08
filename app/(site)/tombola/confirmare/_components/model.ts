import type { RaffleState } from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { raffleCopy } from '../../_shared/copy';

const C = raffleCopy.confirmation;

/**
 * The words after the figure in the chances tile: formatCount without the number («șansă»,
 * «șanse», «de șanse» from 20), so the tile's unit and an inline «20 de șanse» never disagree (c3).
 */
export function chancesUnit(n: number): string {
  return formatCount(n, C.chanceSingular, C.chancePlural).replace(/^\S+\s/, '');
}

/** c2: «… pentru categoria {tip}!» with the type's label (else its key, as fish), else the plain line. */
export function confirmationHeading(state: Pick<RaffleState, 'types' | 'selectedTypeKey'>): string {
  const type = state.types.find((t) => t.key === state.selectedTypeKey);
  const category = type?.label ?? state.selectedTypeKey ?? null;
  return category ? C.messageWithCategory(category) : C.message;
}

export type ReceiptBlock = 'upload' | 'receipt' | null;

/**
 * c5 / c6: before the end, the upload card without a receipt and the receipt card with one; after
 * the end, neither (fish confirmation.tsx:179,228). Without a session there is nothing to upload to
 * (fish would open a sheet whose upload throws «Nu există o sesiune activă»), and without a
 * participation the CMS refuses the upload (400 «Trebuie să te înscrii…», uploadReceipt) — neither
 * shows a card. (A viewer who is not joined is sent to the intro anyway, see `notJoinedRedirect`.)
 */
export function receiptBlock(state: Pick<RaffleState, 'isEnded' | 'receiptUploaded' | 'sessionDocumentId' | 'joined'>): ReceiptBlock {
  if (state.isEnded || !state.sessionDocumentId || !state.joined) return null;
  return state.receiptUploaded ? 'receipt' : 'upload';
}

/**
 * c5 / c7: after registration closes (canChangeType false) and before the end, a FIRST upload stays
 * allowed — fish (confirmation.tsx:179) and the CMS (uploadReceipt checks only the participation)
 * both allow it — but once uploaded it can no longer be replaced or deleted (c7). The upload card
 * says so up front instead of letting the two cards contradict each other.
 */
export function firstUploadIsFinal(state: Pick<RaffleState, 'canChangeType'>): boolean {
  return !state.canChangeType;
}

/**
 * Web only (fish renders «Ești înscris…» with 0 chances): a viewer who is not joined — or who has no
 * session at all — has nothing to confirm, so the confirmation hands over to the intro, which shows
 * the join form or sends them home / to the winners itself (introRedirect). Decided only on settled
 * data: right after a join the participation refetch may still be in flight (`fetching`).
 */
export function notJoinedRedirect(state: Pick<RaffleState, 'joined'>, { fetching }: { fetching: boolean }): boolean {
  return !state.joined && !fetching;
}

/** c9: «Vezi câștigători» only once the session ended with winners. */
export function showWinnersLink(state: Pick<RaffleState, 'isEnded' | 'hasWinners'>): boolean {
  return state.isEnded && state.hasWinners;
}
