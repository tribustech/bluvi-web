'use client';

import { useParams } from 'next/navigation';
import { routes } from '@/lib/routes';
import { BookingFrame } from '@/app/(site)/balti/[id]/rezerva/_grid/BookingFrame';
import { GridSkeleton, SelectionCardSkeleton } from '@/app/(site)/balti/[id]/rezerva/_grid/GridSkeleton';
import { Legend } from '@/app/(site)/balti/[id]/rezerva/_grid/Legend';
import { useOwnedLakeName } from '../../../_shared/useOwnedLakeName';
import { walkInFlow } from './flowConfig';

/**
 * The calendar before anything is known but the URL (the session gate, the lake read): the frame,
 * the operator's legend (no «Doar telefonic», c4), the grid skeleton (c10) and, from 1024, the summary
 * card's placeholder (the loaded grid's column split from the first paint). The title is the lake's
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
      aside={<SelectionCardSkeleton />}
    >
      <GridSkeleton />
    </BookingFrame>
  );
}
