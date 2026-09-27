import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions, type InvalidationList } from '../shared';
import type { Transport } from '../transport';
import {
  acceptBooking,
  cancelBooking,
  createBlock,
  createBooking,
  createReservation,
  createWalkInBooking,
  deleteBlock,
  markNoShow,
  operatorCancelBooking,
  rejectBooking,
} from './api';
import { operatorStatsKeys } from '../lakes/queries';
import { reputationKeys } from '../social/queries';
import { bookingKeys } from './queries';
import type { AvailabilityBlockInput, CreateBookingInput, LakeReservation, WalkInBookingInput } from './schemas';

/**
 * What `invalidateOperatorSurfaces` invalidates.
 *
 * Two disjoint roots, and both are required:
 *  - `['bookings']` — availability, the operator inbox, the angler's "mine" list,
 *    the owned-lakes list and the availability grid.
 *  - `['operator-stats']` — the home "Bălțile mele" card and the per-lake panel.
 *    These sit under their own prefix, so the `['bookings']` invalidation alone
 *    never reached them: after accepting a request the operator went back to a
 *    panel still showing the pre-action counts, money and occupancy.
 *
 * No CDN purge: both endpoints are in the private deny bucket of
 * `src/middlewares/cache-control.ts`, so the only stale copy is this cache.
 */
export const OPERATOR_SURFACES: InvalidationList = [bookingKeys.all, operatorStatsKeys.all];

/** fish `services/mutations/invalidateOperatorSurfaces.ts` — invalidate every surface a booking write touches. */
export function invalidateOperatorSurfaces(qc: QueryClient) {
  for (const queryKey of OPERATOR_SURFACES) qc.invalidateQueries({ queryKey });
}

/** fish `useAcceptBooking` */
export function acceptBookingMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (id: string) => acceptBooking(t, id),
    onSuccess: () => {
      // Accept changes availability, the inbox, the angler's "mine" list AND every
      // operator stat (pending count, occupancy, cash due today).
      invalidateOperatorSurfaces(qc);
    },
  });
}

/** fish `useRejectBooking` */
export function rejectBookingMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectBooking(t, id, reason),
    onSuccess: () => {
      // Reject frees the slot and drops the request from the pending count.
      invalidateOperatorSurfaces(qc);
    },
  });
}

/** fish `useCancelBooking` — the angler's own cancel. */
export function cancelBookingMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => cancelBooking(t, id, reason),
    onSuccess: () => {
      // Cancel frees the stand and moves the operator's cash-due and occupancy.
      invalidateOperatorSurfaces(qc);
    },
  });
}

/** fish `useOperatorCancelBooking` */
export function operatorCancelBookingMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => operatorCancelBooking(t, id, reason),
    onSuccess: () => {
      // Operator cancel frees the stand and moves cash-due and occupancy.
      invalidateOperatorSurfaces(qc);
    },
  });
}

/** fish `useCreateBooking` */
export function createBookingMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (input: CreateBookingInput) => createBooking(t, input),
    onSuccess: () => {
      // A new request affects availability, the angler's "mine" list, the operator's
      // inbox and the operator's pending count.
      invalidateOperatorSurfaces(qc);
    },
  });
}

/** What `createWalkInBookingMutation` invalidates (narrower than OPERATOR_SURFACES, as in fish). */
export const WALK_IN_INVALIDATES: InvalidationList = [
  bookingKeys.all,
  operatorStatsKeys.owned,
  ['operator-stats', 'lake'],
];

/** fish `useCreateWalkInBooking` */
export function createWalkInBookingMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (input: WalkInBookingInput) => createWalkInBooking(t, input),
    onSuccess: () => {
      // A walk-in occupies a stand immediately → refresh availability, the lake
      // inbox, and the operator dashboard stats (occupancy / De încasat / upcoming).
      for (const queryKey of WALK_IN_INVALIDATES) qc.invalidateQueries({ queryKey });
    },
  });
}

/** fish `useCreateBlock` */
export function createBlockMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (input: AvailabilityBlockInput) => createBlock(t, input),
    onSuccess: () => {
      // A new block changes availability, the blocks list and what the panel counts
      // as sellable.
      invalidateOperatorSurfaces(qc);
    },
  });
}

/** fish `useDeleteBlock` */
export function deleteBlockMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: (id: string) => deleteBlock(t, id),
    onSuccess: () => {
      // Removing a block puts the stand back on the market.
      invalidateOperatorSurfaces(qc);
    },
  });
}

/** fish `useMarkNoShow` */
export function markNoShowMutation(t: Transport, qc: QueryClient) {
  return mutationOptions({
    mutationFn: ({ bookingId, comment }: { bookingId: string; comment: string }) => markNoShow(t, bookingId, comment),
    onSuccess: () => {
      // A no-show changes the inbox, the angler's "mine" list and the panel's money
      // (a no-show owes nothing at the gate), plus the angler's reputation.
      invalidateOperatorSurfaces(qc);
      qc.invalidateQueries({ queryKey: reputationKeys.all });
    },
  });
}

/** fish `useCreateLakeReservation` — legacy, no cache effects (the CMS always answers 400). */
export function createLakeReservationMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (data: LakeReservation) => createReservation(t, data),
  });
}
