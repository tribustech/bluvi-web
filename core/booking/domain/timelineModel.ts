/** fish `features/bookings/ui/timelineModel.ts` (verbatim; `status` also accepts the raw DTO string). */
import type { BookingStatus } from '../schemas';

export type TimelineStepState = 'done' | 'current' | 'future';
export type TimelineStep = { key: string; title: string; detail?: string; state: TimelineStepState };

export type TimelineInput = {
  status: BookingStatus | (string & {});
  audience: 'angler' | 'operator';
  createdAtLabel?: string;
  confirmedAtLabel?: string;
  endedLabel?: string;
  /** Elapsed time on the waiting step, e.g. "de 2 ore". No deadline is implied. */
  ageLabel?: string;
};

/**
 * The booking lifecycle as a timeline. Rejection and cancellation are terminal:
 * they replace the remaining steps instead of greying them out, because a dead
 * request has no future.
 *
 * The waiting step shows elapsed age only. There is deliberately no response
 * deadline — no SLA exists in the product.
 */
export function buildTimeline(input: TimelineInput): TimelineStep[] {
  const sent: TimelineStep = {
    key: 'sent',
    title: 'Cerere trimisă',
    detail: input.createdAtLabel,
    state: 'done',
  };

  if (input.status === 'rejected') {
    return [sent, { key: 'rejected', title: 'Respinsă', detail: input.endedLabel, state: 'current' }];
  }
  if (input.status === 'cancelled') {
    return [sent, { key: 'cancelled', title: 'Anulată', detail: input.endedLabel, state: 'current' }];
  }

  const waiting: TimelineStep = {
    key: 'waiting',
    title: input.audience === 'operator' ? 'Așteaptă răspunsul tău' : 'Așteaptă răspunsul lacului',
    detail: input.ageLabel,
    state: input.status === 'pending' ? 'current' : 'done',
  };
  const confirmed: TimelineStep = {
    key: 'confirmed',
    title: 'Confirmată',
    detail: input.status === 'pending' ? undefined : input.confirmedAtLabel,
    state: input.status === 'pending' ? 'future' : input.status === 'confirmed' ? 'current' : 'done',
  };
  const ended: TimelineStep = {
    key: 'ended',
    title: 'Încheiată',
    detail: input.endedLabel,
    state: input.status === 'completed' ? 'done' : 'future',
  };

  return [sent, waiting, confirmed, ended];
}
