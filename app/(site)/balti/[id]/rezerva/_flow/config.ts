import { routes, type BookingSelection } from '@/lib/routes';

/*
 * One booking flow, two mounts (fish BookingFlowProvider `basePath` + `walkIn`, parity
 * operator.b.walk-in-shared-flow): the angler's /balti/[id]/rezerva and the operator's walk-in
 * /operator/[lakeId]/calendar are the same grid → extras → review, told apart only by this config.
 * Every _flow / _grid module takes it as an optional last argument and defaults to the angler's,
 * so the angler flow is exactly what it was before the walk-in shared it.
 *
 * No React state in it: built once per mount (it holds path builders, so it is built on the client
 * side of a page — functions cannot cross the server → client boundary).
 */

export type FlowMode = 'angler' | 'walkIn';

/** How the grid judges a slot (fish AvailabilityGrid `enforceLeadTime` / `allowInProgress`). */
export type GridRules = {
  /** Slots inside the lake's lead time are yellow «doar telefonic» (angler) — the operator has no lead time (operator.calendar.c4). */
  enforceLeadTime: boolean;
  /** A slot that started stays sellable until it ends (operator.calendar.c3); the angler's is past once it starts. */
  allowInProgress: boolean;
};

export type FlowConfig = GridRules & {
  mode: FlowMode;
  lakeId: string;
  paths: {
    /** The grid step's pathname (the flow's base: every step lives under it). */
    grid: string;
    /** The extras step for a selection (pathname + query). */
    extras: (sel: BookingSelection) => string;
    /** The review step for a selection (pathname + query). */
    review: (sel: BookingSelection) => string;
    /** Where the flow is left when this tab has no history to go back to. */
    exit: string;
  };
  /** The header's eyebrow over the title. */
  eyebrow: string;
  /** The title while the lake's name is unknown or empty (fish: «Rezervare» / «Balta»). */
  titleFallback: string;
  /** The quote (and the submit) skip the server's end-time rule for a walk-in (operator.calendar.c7). */
  walkIn: boolean;
  /** A labelled block / a competition explains itself in a dialog (angler c17); the operator's grid opens nothing (operator.calendar.c5). */
  blockedCellOpens: boolean;
  /**
   * The grid's «Continuă» is held, with this note under it, while the mount's next steps are not built
   * (owner rule 4: never a button into a 404). null: Continuă leads on to extras / review.
   */
  continueHeld: string | null;
};

/** The angler's flow: today's behaviour (booking.rezerva-grila). */
export const ANGLER_RULES: GridRules = { enforceLeadTime: true, allowInProgress: false };

export function anglerFlow(lakeId: string): FlowConfig {
  return {
    mode: 'angler',
    lakeId,
    ...ANGLER_RULES,
    paths: {
      grid: routes.lakeBooking(lakeId),
      extras: (sel) => routes.lakeBookingExtras(lakeId, sel),
      review: (sel) => routes.lakeBookingReview(lakeId, sel),
      exit: routes.lake(lakeId),
    },
    eyebrow: 'Rezervă un stand',
    titleFallback: 'Rezervare',
    walkIn: false,
    blockedCellOpens: true,
    continueHeld: null,
  };
}

/** The pathname of a step href (its query dropped). */
export const pathOf = (href: string) => {
  const q = href.indexOf('?');
  return q >= 0 ? href.slice(0, q) : href;
};
