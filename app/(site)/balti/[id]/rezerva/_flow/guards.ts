import {
  countNights,
  offeredExtras,
  seedFromSelection,
  type AvailabilityExtra,
  type GridSelectionState,
  type MergedAvailability,
  type SelectionSlot,
} from '@/core/booking';
import { buildGridModel, selectionFree } from '../_grid/model';
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

/** What the review says when it sends a tour that is no longer free back to the grid (the grid's own words). */
export const SELECTION_TAKEN_MESSAGE = 'Intervalul ales nu mai e liber.';

/**
 * The tour is no longer free to book at `nowMs` — taken (the angler's own booking too), blocked,
 * started, inside the lead time, or not a run of slots: the grid's own check (_grid/model.ts
 * selectionFree). null = the loaded months do not reach its end yet: it cannot be judged.
 */
export function selectionTaken(merged: MergedAvailability, sel: FlowSelection, nowMs: number): boolean | null {
  if (!(Date.parse(sel.end) <= Date.parse(merged.loadedRange.to))) return null;
  const model = buildGridModel(merged, nowMs);
  return !selectionFree(model, seedSelection(sel, model.slots));
}

/**
 * The redirect a later step needs before it can render, or null when it may (fish's step guards:
 * no selection or a stand the lake no longer has → the grid; the web adds: the extras step for a
 * tour the stand has nothing to add to → the review, keeping the selection; and, given `nowMs`, a
 * review whose tour is no longer free → the grid — the CMS quote never checks occupancy, so a review
 * reached again (Forward, a stale tab, a shared link) would otherwise price a taken slot). `merged`
 * null = the availability is still loading: only the URL can be judged yet.
 */
export function guardStep(
  lakeId: string,
  step: Exclude<FlowStep, 'grid'>,
  params: FlowParams,
  merged: MergedAvailability | null,
  nowMs?: number
): string | null {
  const sel = params.selection;
  const grid = stepHref(lakeId, 'grid', { selection: null, extras: [] });
  if (!sel) return grid;
  if (!merged) return null;
  if (!merged.bookingEnabled || !selectionStand(merged, sel)) return grid;
  if (step === 'review' && nowMs !== undefined && selectionTaken(merged, sel, nowMs) === true) return grid;
  if (step === 'extras' && offeredForSelection(merged, sel).length === 0) {
    return stepHref(lakeId, 'review', { selection: sel, extras: [] });
  }
  return null;
}

/**
 * The step before the review for this tour (fish: Back pops to whatever was pushed): the extras step
 * when the stand has something to add to it (Continuă went there), the grid otherwise (c35).
 */
export function previousStep(merged: MergedAvailability | null, sel: FlowSelection | null): 'extras' | 'grid' {
  return offeredForSelection(merged, sel).length > 0 ? 'extras' : 'grid';
}
