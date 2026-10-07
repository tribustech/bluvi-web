import {
  countNights,
  offeredExtras,
  seedFromSelection,
  type AvailabilityExtra,
  type GridSelectionState,
  type MergedAvailability,
  type SelectionSlot,
} from '@/core/booking';
import { stepHref, type FlowParams, type FlowSelection, type FlowStep } from './params';

/*
 * Selection guards shared by the three steps (fish useBookingGridFlow + the step screens'
 * `<Redirect href={basePath}/>`, parity booking.b.flow-state, booking.rezerva-extra.c1/c2). Pure.
 */

type Stand = MergedAvailability['stands'][number];

/** The stand a selection names, when the lake still has it. */
export function selectionStand(merged: MergedAvailability | null, sel: FlowSelection | null): Stand | undefined {
  if (!merged || !sel) return undefined;
  return merged.stands.find(s => s.documentId === sel.stand);
}

/**
 * The extras this stand can add to THIS tour (fish `offeredForSelection`): the lake's extras the
 * stand provides, minus per-night ones when the tour crosses no lake-local midnight (c34).
 */
export function offeredForSelection(merged: MergedAvailability | null, sel: FlowSelection | null): AvailabilityExtra[] {
  const stand = selectionStand(merged, sel);
  if (!merged || !sel || !stand) return [];
  return offeredExtras(stand, merged.extras, countNights(sel.start, sel.end, merged.timezone));
}

/**
 * Where «Continuă» goes from the grid (fish goToNextFromSelect): the extras step only when the
 * stand can add something to this tour, straight to the review otherwise — Back from the review
 * then lands on the grid by itself (c35, booking.rezerva-extra.c2). Extras always start empty.
 */
export function nextStepFromGrid(merged: MergedAvailability | null, sel: FlowSelection): Exclude<FlowStep, 'grid'> {
  return offeredForSelection(merged, sel).length > 0 ? 'extras' : 'review';
}

/**
 * Map a URL selection onto the loaded slots (core seedFromSelection), matching instants rather
 * than strings: a link written by another step or another device may spell the same instant with
 * another offset. Null when a bound matches no loaded slot.
 */
export function seedSelection(sel: FlowSelection | null, slots: SelectionSlot[]): GridSelectionState | null {
  if (!sel) return null;
  const s = Date.parse(sel.start);
  const e = Date.parse(sel.end);
  const start = slots.find(x => Date.parse(x.start) === s)?.start;
  const end = slots.find(x => Date.parse(x.end) === e)?.end;
  if (!start || !end) return null;
  return seedFromSelection({ standDocumentId: sel.stand, startISO: start, endISO: end }, slots);
}

/**
 * The redirect a later step needs before it can render, or null when it may (fish's step guards:
 * no selection or a stand the lake no longer has → the grid; the web adds: the extras step for a
 * tour the stand has nothing to add to → the review, keeping the selection). `merged` null = the
 * availability is still loading: only the URL can be judged yet.
 */
export function guardStep(
  lakeId: string,
  step: Exclude<FlowStep, 'grid'>,
  params: FlowParams,
  merged: MergedAvailability | null
): string | null {
  const sel = params.selection;
  if (!sel) return stepHref(lakeId, 'grid', { selection: null, extras: [] });
  if (!merged) return null;
  if (!merged.bookingEnabled || !selectionStand(merged, sel)) return stepHref(lakeId, 'grid', { selection: null, extras: [] });
  if (step === 'extras' && offeredForSelection(merged, sel).length === 0) {
    return stepHref(lakeId, 'review', { selection: sel, extras: [] });
  }
  return null;
}
