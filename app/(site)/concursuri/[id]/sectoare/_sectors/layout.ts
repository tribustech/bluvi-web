/*
 * SlotGrid's boxes as plain strings (not in the 'use client' module, so the server skeleton can
 * import them): the loading state draws the same columns, slot track and slot height.
 */

/**
 * Phone: sectors stacked. From 768: side-by-side columns, more as the screen grows. auto-fit, not
 * auto-fill: the real columns stretch over the whole card (owner rule: full-width desktop), never
 * narrow columns beside empty tracks (4 sectors at 1920 were 4 × 176px and ~45% white).
 */
export const SECTOR_COLUMNS =
  'flex flex-col gap-6 md:grid md:grid-cols-[repeat(auto-fit,minmax(--spacing(40),1fr))] md:gap-3 xl:grid-cols-[repeat(auto-fit,minmax(--spacing(44),1fr))] xl:gap-4';
/** A container: a wide column (few sectors on a wide screen) lays its slots in 2–3 columns. */
export const SECTOR_CARD = 'flex flex-col gap-3 md:@container md:rounded-card md:border md:border-hairline md:p-3 md:pt-0 md:overflow-hidden';
export const SLOT_TRACK =
  'grid grid-cols-[repeat(auto-fill,minmax(--spacing(14),1fr))] gap-3 md:grid-cols-1 md:@min-[18rem]:grid-cols-2 md:@min-[30rem]:grid-cols-3';
export const SLOT_BOX = 'h-14 md:h-11';
