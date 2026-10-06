/*
 * The header heights of Știre and Sponsor, shared by the loaded pages (Gallery) and their
 * skeletons (ArticleSkeleton), so the skeleton's picture header is exactly the loaded one's.
 * A plain module: a 'use client' file's exports reach a server component as references.
 */

/** The sponsor band: 224 on the phone, 192 at 768, 224 from 1280 (logo → title ≤ 24px). */
export const SPONSOR_HERO_HEIGHT = 'h-56 md:h-48 xl:h-56';

/**
 * The article strip: 300 on the phone (fish 250 + the status bar), the picture cover-cropped; from
 * 768 the card's width at `--strip-ratio` (the first picture's clamped ratio, imageSize.stripRatio;
 * 16:9 when unknown), never lower than 240 nor taller than 480.
 */
export const NEWS_HERO_HEIGHT = 'h-75 md:h-auto md:min-h-60 md:max-h-120 md:w-full md:aspect-(--strip-ratio)';

/**
 * A banner wider than 2:1 (imageSize.WIDE_RATIO): a 300px cover crop would cut its text off, so the
 * phone strip follows the banner's own ratio too (at least 200 high), the picture whole.
 */
export const NEWS_HERO_WIDE_HEIGHT = 'h-auto w-full min-h-50 max-h-120 aspect-(--strip-ratio) md:min-h-60';

/** The phone header without a picture: the loaded header's own height (fish's grey header). */
export const NEWS_HERO_EMPTY_HEIGHT = 'h-75';
export const SPONSOR_HERO_EMPTY_HEIGHT = 'h-56';
