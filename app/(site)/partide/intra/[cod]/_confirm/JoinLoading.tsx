'use client';

import { FlowLoadingStatus } from '@/components/templates/T6';
import { JOIN_ACTIONS, JoinFrame } from './JoinFrame';

/**
 * While the session gate reads the viewer: the confirm step's boxes in grey (disc, two title lines,
 * two body lines), the header real — nothing moves when the step lands.
 */
export function JoinLoading() {
  const bar = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';
  return (
    <JoinFrame busy>
      <FlowLoadingStatus />
      <div aria-hidden className="flex flex-1 flex-col items-center px-2 py-8 md:pt-12 md:pb-4">
        <span className="flex-1 md:hidden" />
        <div className="flex w-full max-w-md flex-col items-center gap-5">
          <span className="size-14 rounded-full bg-soft-fill animate-shimmer" />
          <div className="flex w-full flex-col items-center gap-3">
            <span className="t-title2 block">
              <span className={`${bar} h-5 w-64`} />
            </span>
            <span className="t-body flex flex-col items-center">
              <span className={`${bar} h-3.5 w-72`} />
              <span className={`${bar} mt-2 h-3.5 w-40`} />
            </span>
          </div>
        </div>
        <span className="flex-2 md:hidden" />
      </div>
      <div aria-hidden className={JOIN_ACTIONS}>
        <span className="h-12 rounded-control bg-soft-fill animate-shimmer xl:h-10" />
        <span className="h-12 xl:h-10" />
      </div>
    </JoinFrame>
  );
}
