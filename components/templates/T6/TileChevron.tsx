'use client';

import { useLinkStatus } from 'next/link';
import { ArrowPathIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * The tile's «opens the next step» chevron; while the tap is navigating (a slow CMS) it turns into
 * a spinner of the same 24px box, so a tap never reads as dead and invites a second one. Must sit
 * inside the tile's <Link> (useLinkStatus). The sr-only line joins the link's name while pending.
 */
export function TileChevron() {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? (
        <ArrowPathIcon aria-hidden className="size-6 shrink-0 self-center text-ink-2 motion-safe:animate-spin" />
      ) : (
        <ChevronRightIcon aria-hidden className="size-6 shrink-0 self-center text-ink-2" />
      )}
      {pending ? <span className="sr-only">Se deschide…</span> : null}
    </>
  );
}
