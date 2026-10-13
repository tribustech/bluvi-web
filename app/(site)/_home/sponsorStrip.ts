import { cn } from '@/components/ui/cn';

/*
 * The Sponsori strip's sizes, shared by SponsorsSection ('use client') and the page's skeleton (a
 * server component cannot read a string exported from a client module).
 */

/**
 * The chip: below 768 fish's home sponsor tile (245 × 150, radius 10, the image covering it —
 * ROADMAP §4b.25); from 768 96 tall, one track of the strip's grid (160 or more) — owner
 * 2026-10-12: the 64 × 112 chips made the logos too small to read.
 */
export const SPONSOR_CHIP = 'h-37.5 w-61.25 max-md:rounded-control max-md:px-0 md:h-24 md:w-full';

/**
 * The strip's list layout: below 768 one row that scrolls (bleeding to the screen edge); from 768
 * an auto-fill grid of equal chips that ends flush on the column edge (wrapping when it must).
 */
export const SPONSOR_STRIP = cn(
  'flex gap-2.5 pt-1 pb-4 md:gap-3 xl:gap-4 md:grid md:grid-cols-[repeat(auto-fill,minmax(--spacing(40),1fr))]',
  'max-md:-mx-5 max-md:overflow-x-auto max-md:px-5 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden'
);
