'use client';

import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { track } from '@/lib/analytics';
import { routes } from '@/lib/routes';
import { Card } from './Card';

/**
 * c10 — fish bookings/[id].tsx:85-101: a past booking (cancelled, rejected, or over) offers the way
 * back to that lake's booking grid, «Mergi din nou la {lake}?» / «Rezervă din nou», logging
 * rebook_button_pressed. Deliberately not gated on the lake still taking bookings (the DTO does not
 * say; the grid explains). `bare`: inside the action card (≥1024) — no card of its own.
 */
export function RebookCard({ lakeId, lakeName, bookingId, bare = false, className }: { lakeId: string; lakeName: string; bookingId: string; bare?: boolean; className?: string }) {
  const titleId = bare ? 'rezervare-din-nou-aside' : 'rezervare-din-nou';
  const body = (
    <ButtonLink
      href={routes.lakeBooking(lakeId)}
      block
      icon={<CalendarDaysIcon strokeWidth={2} />}
      onClick={() => track('rebook_button_pressed', { lake_id: lakeId, booking_id: bookingId })}
    >
      Rezervă din nou
    </ButtonLink>
  );
  if (bare) {
    return (
      <div data-testid="rebook" className={cn('flex flex-col gap-3', className)}>
        <h3 id={titleId} className="t-heading text-ink">{`Mergi din nou la ${lakeName}?`}</h3>
        {body}
      </div>
    );
  }
  return (
    <Card title={`Mergi din nou la ${lakeName}?`} titleId={titleId} data-testid="rebook" className={className}>
      {body}
    </Card>
  );
}
