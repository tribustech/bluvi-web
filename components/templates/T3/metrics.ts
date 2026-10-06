
/*
 * T3 «Detail with tabs» — the sticky offsets, in one place.
 *
 * The shell's top bar is sticky at 56px (phone) / 64px (from 768). Under it, a T3 page may pin:
 *  - phone: the mini title row (46, fish VenuePinnedNav PINNED_MINI_HEIGHT) + the chip row
 *    (58, fish CHIPS_ROW_HEIGHT);
 *  - 768–1279: the chip row only;
 *  - ≥1280: nothing (the section nav moves to the left column, which sticks under the bar).
 *
 * A section anchor lands below whatever is pinned, plus 12px of air (fish `navTopOffset + 12`).
 */

/**
 * Pinned rows start right under the top bar — and follow it to the top edge when the phone bar
 * slides away, so the chip row never hangs 56px in the air. The shell's UNDER_BAR_TOP offsets,
 * WITHOUT its `top` transition: the T3 rows jump to their new `top` and useFollowBar plays the move
 * as a compositor transform on the bar's timing (a `top` transition on a sticky row lags the bar's
 * composited slide on iOS Safari — owner rule 3). Use with usePinnedFollowingBar.
 */
export const STICKY_TOP = [
  'top-[calc(--spacing(14)_+_var(--shell-banner-h,0px))] md:top-[calc(--spacing(16)_+_var(--shell-banner-h,0px))]',
  'max-md:[html[data-bar-concealed]_&]:top-[var(--shell-banner-h,0px)]',
].join(' ');

/** STICKY_TOP below 768 only (a row that pins on the phone and does something else from 768). */
export const PINNED_TOP_PHONE =
  'max-md:top-[calc(--spacing(14)_+_var(--shell-banner-h,0px))] max-md:[html[data-bar-concealed]_&]:top-[var(--shell-banner-h,0px)]';

/*
 * Every offset below also adds the offline banner's height while it shows (`--shell-banner-h`, the
 * sticky stack in components/nav/stickyStack.ts), so nothing pinned ever slides under it.
 */

/** Sticky side columns (≥1280): under the 64px bar + 24px. */
export const COLUMN_STICKY_TOP = 'xl:top-[calc(--spacing(22)_+_var(--shell-banner-h,0px))]';

/** …under the bar and a sticky tab band (DetailBand `sticky`, 44px) + 24px: 132. */
export const COLUMN_STICKY_TOP_BELOW_TABS = 'xl:top-[calc(--spacing(33)_+_var(--shell-banner-h,0px))]';

/**
 * Section anchors: 56+46+58+12 = 172 · bar hidden (phone, html[data-bar-concealed]): 46+58+12 = 116
 * · 64+58+12 = 134→136 · 64+24 = 88. The scroll spy reads the same margin, so the active chip
 * switches exactly when a heading reaches the pinned rows, bar shown or not.
 */
export const SECTION_SCROLL_MARGIN = [
  'scroll-mt-[calc(--spacing(43)_+_var(--shell-banner-h,0px))]',
  'max-md:[html[data-bar-concealed]_&]:scroll-mt-[calc(--spacing(29)_+_var(--shell-banner-h,0px))]',
  'md:scroll-mt-[calc(--spacing(34)_+_var(--shell-banner-h,0px))]',
  'xl:scroll-mt-[calc(--spacing(22)_+_var(--shell-banner-h,0px))]',
].join(' ');

/**
 * The full-bleed surface trick: a band's background and bottom hairline are pseudo-elements
 * widened far past the column; the site layout's `overflow-x-clip` keeps them from adding a
 * horizontal scroll. The content stays in the shell column, aligned with the top bar.
 */
export const FULL_BLEED_SURFACE =
  "relative isolate before:absolute before:inset-y-0 before:-inset-x-[100vmax] before:z-behind before:bg-surface before:content-['']";

export const FULL_BLEED_HAIRLINE =
  "after:pointer-events-none after:absolute after:bottom-0 after:-inset-x-[100vmax] after:h-px after:bg-hairline after:content-['']";

/**
 * The 20/solid presence icons (the location pin, the rating star) sized to the text they sit in,
 * as the kit cards draw them (CompetitionCard pin, LakeCard star) and the Fundații specimen shows:
 *  - `meta`: beside 12–14px text (caption / label rows: the header's location, «★ 1 recenzie»);
 *  - `strong`: beside bodyStrong (the rating score, a review's note).
 * TODO(kit): move to components/ui and use it from the cards and the live Concurs header too.
 */
export const PRESENCE_ICON = { meta: 'size-3.5', strong: 'size-4' } as const;
