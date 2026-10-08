import type { RafflePrizeDto, RaffleState, RaffleWinnerEntry } from '@/core/organizer';
import { prizeTypeLabel } from '../../_shared/copy';

/*
 * The winners page's pure model (fish app/(app)/raffle/winners.tsx), unit-tested in
 * ./model.test.ts. Copy that only this page says lives here; the shared raffle copy is
 * ../../_shared/copy.ts (raffleCopy.winners).
 */

export const WINNERS_NOTICE_TITLE = 'Câștigătorii vor fi contactați de către echipa Bluvi.';
export const WINNERS_NOTICE_BODY = 'În cazul în care nu răspund în timp util, se va mai face o tragere la sorți.';
export const BACK_HOME = 'Înapoi acasă';
export const WINNERS_DESCRIPTION = 'Câștigătorii tragerii la sorți Bluvi & PescarMania, pe categorii de premii.';

/** c1: the page exists only for an ended session that has winners; anything else goes home. */
export function shouldLeave(state: Pick<RaffleState, 'isEnded' | 'hasWinners'>): boolean {
  return !(state.isEnded && state.hasWinners);
}

export type WinnerGroup = {
  typeKey: string;
  /** «Crap»: the session type's label, else the static key's word, else the key. */
  label: string;
  /** The CMS colour, or null (→ the accent, fish's default indigo). */
  badgeColor: string | null;
  /** The type's prize, from the session only; null = none (no row). */
  prize: RafflePrizeDto | null;
  winners: RaffleWinnerEntry[];
};

/**
 * c4: one group per winnersByTypeKey key, in the CMS's order. The prize is the session's prize of
 * that type, or none (no row). Deliberate deviation from fish, which falls back to the static
 * intro prizes (STATIC_PRIZES) when the session has none: on a results page that would state as
 * fact a prize and a value the CMS never gave (owner rule 4, when we don't know, don't show).
 */
export function winnerGroups(state: Pick<RaffleState, 'winnersByTypeKey' | 'types' | 'sessionPrizes'>): WinnerGroup[] {
  return Object.keys(state.winnersByTypeKey).map((typeKey) => {
    const type = state.types.find((t) => t.key === typeKey);
    return {
      typeKey,
      label: prizeTypeLabel(typeKey, type?.label),
      badgeColor: type?.badgeColor?.trim() ? type.badgeColor : null,
      prize: state.sessionPrizes.find((p) => p.typeKey === typeKey) ?? null,
      winners: state.winnersByTypeKey[typeKey] ?? [],
    };
  });
}

/** c5: the username, else «Câștigător #{i}» (1-based, fish). */
export function winnerName(winner: Pick<RaffleWinnerEntry, 'username'>, index: number): string {
  return winner.username?.trim() || `Câștigător #${index + 1}`;
}
