/*
 * The allocation's boxes as plain strings (not in a 'use client' module, so the server skeleton can
 * import them): the loading state draws the same columns, rows and row height.
 */

/**
 * Phone: sectors stacked, one stand per row (fish's list). From 768: the sectors side by side as
 * columns (rule 14: a wide screen gets its own layout), as many as fit at 18rem (a 3-sector line at 1280 left rows ~150px of text); a sector left alone
 * on the last line grows over the whole width and lays its stands in 2–3 columns (its own
 * container), so no line ends in a blank (4 sectors at 1440 were 3 + 1 beside ~70% white).
 */
export const SECTOR_COLUMNS = 'flex flex-col gap-6 md:flex-row md:flex-wrap md:items-start md:gap-3 xl:gap-4';
/** A sector: plain on the phone; a card with the sector colour as its top edge from 768. */
export const SECTOR_CARD =
  'flex flex-col gap-3 md:@container md:min-w-0 md:grow md:basis-72 md:rounded-card md:border md:border-hairline md:bg-surface md:p-3 md:pt-0 md:overflow-hidden';
export const ROW_LIST = 'grid grid-cols-1 gap-2 md:@min-[34rem]:grid-cols-2 md:@min-[52rem]:grid-cols-3';
/** One stand row: two lines of text beside a 40px avatar (fish padding 8, radius 5). */
export const ROW_BOX = 'min-h-16';
