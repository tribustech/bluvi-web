/** fish `features/operator/blockReasons.ts` (verbatim). */
import type { BlockReason } from '../schemas';

/** RO labels for the availability-block reason enum. */
export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  competition: 'Concurs',
  closure: 'Închidere',
  maintenance: 'Întreținere',
  offlineReservation: 'Rezervare telefonică',
  other: 'Altele',
};

/**
 * What the form offers. `offlineReservation` is no longer one of them: a block
 * carries no contact details the angler could act on, so a phone booking is a
 * booking (walk-in), not a block. Existing rows with that reason still render
 * through the labels/tints above.
 */
export type OfferedBlockReason = Exclude<BlockReason, 'offlineReservation'>;
export const BLOCK_REASONS: OfferedBlockReason[] = ['competition', 'closure', 'maintenance', 'other'];

/** Dot + text tint per reason — literal colors, the dot sits on a white row. */
export const BLOCK_REASON_TINT: Record<BlockReason, { dot: string; bg: string }> = {
  competition: { dot: '#6366F1', bg: '#EEF2FF' },
  closure: { dot: '#EF4444', bg: '#FEF2F2' },
  maintenance: { dot: '#F59E0B', bg: '#FFFBEB' },
  offlineReservation: { dot: '#10B981', bg: '#ECFDF5' },
  other: { dot: '#98A2B3', bg: '#F2F4F7' },
};
