'use client';

import { useParams } from 'next/navigation';
import { routes } from '@/lib/routes';
import { BookingFrame } from './BookingFrame';
import { GridSkeleton, SelectionCardSkeleton } from './GridSkeleton';
import { Legend } from './Legend';

/**
 * The step before anything is known but the URL (the gate, the lake read): the frame with its
 * header, the legend and the grid skeleton (10 rows × 4 days, c27). The title waits for the lake's
 * name as «Rezervare» (fish's fallback title, c3); «Azi» appears with the grid.
 */
export function BookingGridFallback() {
  const { id } = useParams<{ id: string }>();
  return (
    <BookingFrame title="Rezervare" back={{ href: id ? routes.lake(id) : routes.lakes(), label: 'Înapoi' }} busy legend={<Legend />} aside={<SelectionCardSkeleton />}>
      <GridSkeleton />
    </BookingFrame>
  );
}
