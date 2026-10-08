import type { RaffleState } from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { raffleCopy } from '../../_shared/copy';

const C = raffleCopy.receiptSubmitted;

/** fish receipt-submitted.tsx:14 — the entry every participant has before the receipt. */
export const BASE_CHANCES = 1;
/** The receipt's bonus (fish: 2, also BON_FISCAL_PESCARMANIA «2 șanse în plus»). */
export const RECEIPT_BONUS = 2;
/** fish: the total while the receipt is under verification (base + bonus, before the CMS counts it). */
const TOTAL_WHILE_VERIFYING = BASE_CHANCES + RECEIPT_BONUS;

export type ReceiptBreakdown = {
  /** c2: which line goes under the check. */
  message: string;
  approved: boolean;
  /** c3: the rows of «Detalii șanse». */
  previous: number;
  bonusLabel: string;
  bonus: number;
  bonusPending: boolean;
  total: number;
};

/**
 * fish app/(app)/raffle/receipt-submitted.tsx:12-30, 41-63, kept as fish has it:
 * - the message follows `receiptUploaded` (approved) — else «în curs de verificare»;
 * - «Bonus (în așteptare)» while `receiptUnderVerification`, else «Bonus»;
 * - the bonus is 2 when uploaded or under verification, else 0;
 * - the total is 3 while under verification, else the CMS's entries count.
 */
export function receiptBreakdown(
  state: Pick<RaffleState, 'receiptUploaded' | 'receiptUnderVerification' | 'entriesCount'>,
): ReceiptBreakdown {
  const verifying = state.receiptUnderVerification;
  return {
    message: state.receiptUploaded ? C.approvedMessage : C.underVerification,
    approved: state.receiptUploaded,
    previous: BASE_CHANCES,
    bonusLabel: verifying ? C.bonusPending : C.bonusApproved,
    bonus: state.receiptUploaded || verifying ? RECEIPT_BONUS : 0,
    bonusPending: verifying,
    total: verifying ? TOTAL_WHILE_VERIFYING : state.entriesCount,
  };
}

/** The unit after a figure, agreeing with it: «șansă» / «șanse» / «de șanse» (formatCount, the «de» from 20). */
export function chancesUnit(n: number): string {
  return formatCount(n, 'șansă', 'șanse').replace(/^\S+\s/, '');
}

/** The tile's spoken text, one phrase: «Total: 3 șanse». */
export function factLabel(label: string, n: number): string {
  return `${label}: ${formatCount(n, 'șansă', 'șanse')}`;
}
