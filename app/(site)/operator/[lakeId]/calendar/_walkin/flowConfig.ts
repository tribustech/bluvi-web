import { routes } from '@/lib/routes';
import type { FlowConfig } from '@/app/(site)/balti/[id]/rezerva/_flow/config';

/*
 * The operator's walk-in flow (fish app/(app)/operator/[lakeId]/walk-in/_layout.tsx:
 * `<BookingFlowProvider basePath="/operator/{lakeId}/walk-in" walkIn>` + index.tsx `allowInProgress`,
 * no `enforceLeadTime`) — operator.b.walk-in-shared-flow. The same grid → extras → review as the
 * angler's, mounted under /operator/[lakeId]/calendar:
 *  - title: the lake's name, «Balta» without one (c1);
 *  - in-progress slots sell until they end (c3), no lead time / yellow / too-soon panel (c4);
 *  - blocked bands open nothing (c5); booked bands open the booking (the screen's onBookedCell, c6);
 *  - the quote (and the submit) are walk-ins: the server skips the end-time rule (c7);
 *  - Continuă → …/calendar/extra or …/calendar/confirmare (c9); Back leaves to the panel (c11).
 */

export function walkInFlow(lakeId: string): FlowConfig {
  return {
    mode: 'walkIn',
    lakeId,
    enforceLeadTime: false,
    allowInProgress: true,
    paths: {
      grid: routes.operatorCalendar(lakeId),
      extras: (sel) => routes.operatorCalendarExtras(lakeId, sel),
      review: (sel) => routes.operatorCalendarReview(lakeId, sel),
      exit: routes.operator(lakeId),
    },
    eyebrow: 'Calendar · adaugă la poartă',
    titleFallback: 'Balta',
    walkIn: true,
    blockedCellOpens: false,
    continueHeld: null,
  };
}
