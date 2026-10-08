'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AllocationSkeleton } from './AllocationSkeleton';
import { allocationTitle, legRoundOf } from './model';

/**
 * The route's loading frame with the real title (c2): «Standuri manșa N» for ?mansa=N, else
 * «Alocare participanți». The query string is only known in the browser; until then (the static
 * shell) the title is a grey bar, never a title that would swap (rule 4).
 */
export function AllocationRouteSkeleton() {
  return (
    <Suspense fallback={<AllocationSkeleton />}>
      <Titled />
    </Suspense>
  );
}

function Titled() {
  const params = useSearchParams();
  return <AllocationSkeleton title={allocationTitle(legRoundOf(params.get('mansa')))} />;
}
