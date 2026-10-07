'use client';

import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { GlobeEuropeAfricaIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

/**
 * fish features/partide/components/community/ExploreCta.tsx — the indigo banner closing the middle
 * section, «Vrei să vezi ce au prins alții?» / «Explorează capturile din comunitate», to the
 * Explorează tab (parity partide.comunitate.c12). The whole banner is the link; the decorative
 * circles sit behind the copy. Not rendered while that tab is not on the web.
 */
export function ExploreCta({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'relative isolate flex items-center gap-3.5 overflow-hidden rounded-card bg-linear-160 from-bento-indigo to-bento-indigo-2 px-4.25 py-4 text-on-bento-indigo shadow-glow',
        'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
      data-testid="explore-cta"
    >
      <span aria-hidden className="pointer-events-none absolute -top-3.5 -right-4.5 z-behind size-26 rounded-full bg-on-bento-indigo/10" />
      <span aria-hidden className="pointer-events-none absolute right-4 -bottom-6 z-behind size-16 rounded-full bg-on-bento-indigo/5" />
      <span aria-hidden className="flex size-11.5 shrink-0 items-center justify-center rounded-control bg-on-bento-indigo/15 [&>svg]:size-6">
        <GlobeEuropeAfricaIcon />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="t-heading">Vrei să vezi ce au prins alții?</span>
        <span className="t-label text-on-bento-indigo-2">Explorează capturile din comunitate</span>
      </span>
      <ChevronRightIcon aria-hidden className="size-5 shrink-0" />
    </Link>
  );
}
