import { cn } from '@/components/ui/cn';

/*
 * The Sponsori strip's sizes, shared by SponsorsSection ('use client') and the page's skeleton (a
 * server component cannot read a string exported from a client module).
 */

/**
 * The chip: below 768 fish's home sponsor tile (245 × 150, radius 10, the image covering it —
 * ROADMAP §4b.25); from 768 a 176 × 80 logo slot (owner 2026-10-12: logos big enough to read;
 * 2026-10-13: no card around them — a logo strip, not a third row of tiles).
 */
export const SPONSOR_CHIP = 'h-37.5 w-61.25 max-md:rounded-control max-md:px-0 md:h-20 md:w-44';

/**
 * The strip's list layout: below 768 one row that scrolls (bleeding to the screen edge); from 768
 * the logos centred between two hairlines, wrapping when they must.
 */
export const SPONSOR_STRIP = cn(
  'flex gap-2.5 pt-1 pb-4 md:flex-wrap md:justify-center md:gap-x-8 md:gap-y-3 md:border-y md:border-hairline md:py-5 xl:gap-x-12',
  'max-md:-mx-5 max-md:overflow-x-auto max-md:px-5 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden'
);
