'use client';

import { useParams } from 'next/navigation';
import { routes } from '@/lib/routes';
import { BookingFrame } from '@/app/(site)/balti/[id]/rezerva/_grid/BookingFrame';
import { GridSkeleton } from '@/app/(site)/balti/[id]/rezerva/_grid/GridSkeleton';
import { Legend } from '@/app/(site)/balti/[id]/rezerva/_grid/Legend';
import { useOwnedLakeName } from '../../../_shared/useOwnedLakeName';
import { walkInFlow } from './flowConfig';

/**
 * The calendar before anything is known but the URL (the session gate, the lake read): the frame,
 * the operator's legend (no «Doar telefonic», c4) and the grid skeleton (c10; from 768 with the period
 * navigation's and the selection bar's placeholders). The title is the lake's
 * name once the owned-lakes list answered, «Balta» when it does not know the lake (fish
 * `lake?.name ?? 'Balta'`), and a title skeleton while it is loading — never «Balta» swapped for the
 * name (rule 4).
 */
export function WalkInGridFallback() {
  const { lakeId } = useParams<{ lakeId: string }>();
  const config = walkInFlow(lakeId);
  const name = useOwnedLakeName(lakeId);
  return (
    <BookingFrame
      title={name === undefined ? undefined : name || config.titleFallback}
      eyebrow={config.eyebrow}
      back={{ href: routes.operator(lakeId), label: 'Înapoi' }}
      busy
      legend={<Legend showTooSoon={false} />}
    >
      <GridSkeleton />
    </BookingFrame>
  );
}
