import { supportsPenalties } from '@/core/organizer';
import type { StandOccupant } from '../../../_organizer/occupant';

/*
 * The penalties' «Alege standul» rules (parity organizer.penalties-select-stand). Pure.
 *
 * - Picking a stand is only meaningful where a penalty can be applied: a started competition whose
 *   ranking type has penalties (fish penalties hub canApply; apply.tsx sends a ranking type without
 *   penalties back to the hub). Otherwise the page returns to the hub (apply c2).
 * - The target is the stand's registration (fish select-stand.tsx:71-76): no registration id → no
 *   target (nothing happens).
 */

export function canPickPenaltyStand(c: { rankingType?: string | null; competitionStatus?: string | null }): boolean {
  return supportsPenalties(c.rankingType) && c.competitionStatus === 'started';
}

/** The registration a stand's penalty is applied to; null for an unallocated stand or one without a registration id. */
export function penaltyTarget(stand: Pick<StandOccupant, 'allocated' | 'registrationId'>): string | null {
  return stand.allocated && stand.registrationId ? stand.registrationId : null;
}
