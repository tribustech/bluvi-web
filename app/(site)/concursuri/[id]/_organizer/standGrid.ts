/*
 * StandOccupantList's grid, as plain strings (not in the 'use client' module, so a server skeleton
 * can import them): the pages' skeletons draw the same columns and tile height while loading, so
 * nothing moves when the data lands.
 */

/** The tile track, shared by the sector grid and each sector's tile grid so their columns line up. */
export const STAND_TRACK =
  'md:grid-cols-[repeat(auto-fill,minmax(--spacing(52),1fr))] xl:grid-cols-[repeat(auto-fill,minmax(--spacing(50),1fr))]';

/** A stand tile's minimum height. */
export const STAND_TILE_HEIGHT = 'min-h-16 md:min-h-18';
