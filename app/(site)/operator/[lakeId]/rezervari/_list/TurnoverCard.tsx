'use client';

import { Fragment, memo } from 'react';
import type { BookingDTO } from '@/core/booking';
import { OperatorBookingRow, type RowHandlers } from './OperatorBookingRow';

/**
 * c14 — a stand that changes hands today, in Confirmate · Azi (fish OperatorTurnoverCard): one card,
 * the anglers as a vertical timeline — each row without a card of its own, an in/out badge on the
 * avatar, today's moment instead of the period — joined by a thread between the avatars. The same
 * picture the panel draws, so the operator meets one shape for one situation. On the phone it is a
 * card; in the table (from 768 of list width) a group of rows with an accent edge.
 */
function TurnoverCardComponent({
  bookings,
  nowMs,
  actingId,
  selectedId,
  lakeId,
  lakeName,
  handlers,
}: {
  bookings: BookingDTO[];
  nowMs: number;
  actingId: string | null;
  /** The booking the docked detail shows. */
  selectedId: string | null;
  lakeId: string;
  lakeName?: string | null;
  handlers: RowHandlers;
}) {
  const stand = bookings[0]?.stand?.name;
  return (
    <div
      role="group"
      aria-label={stand ? `Standul ${stand}: schimb de tură azi` : 'Schimb de tură azi'}
      data-testid="inbox-turnover"
      className="flex flex-col rounded-card bg-surface py-1 shadow-e1 @3xl:rounded-none @3xl:py-0 @3xl:shadow-[inset_3px_0_0_var(--color-accent)]"
    >
      {bookings.map((b, i) => (
        <Fragment key={b.documentId}>
          <OperatorBookingRow
            booking={b}
            nowMs={nowMs}
            cardActions={false}
            withActions={false}
            acting={actingId === b.documentId}
            selected={selectedId === b.documentId}
            bare
            turnover
            lakeId={lakeId}
            lakeName={lakeName}
            handlers={handlers}
          />
          {i < bookings.length - 1 ? (
            // The thread: line · dot · line under the avatar column (40 wide, the row's 16 inset).
            <div aria-hidden data-testid="inbox-thread" className="-my-2.5 flex h-5 w-10 flex-col items-center self-start ml-4">
              <span className="w-0.5 flex-1 bg-indigo-2" />
              <span className="size-1.5 rounded-full bg-indigo-4" />
              <span className="w-0.5 flex-1 bg-indigo-2" />
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

export const TurnoverCard = memo(TurnoverCardComponent);
