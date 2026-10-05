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

/** Pinned rows start right under the top bar. */
export const STICKY_TOP = 'top-14 md:top-16';

/** Sticky side columns (≥1280): under the 64px bar + 24px. */
export const COLUMN_STICKY_TOP = 'xl:top-22';

/** Section anchors: 56+46+58+12 = 172 · 64+58+12 = 134→136 · 64+24 = 88. */
export const SECTION_SCROLL_MARGIN = 'scroll-mt-43 md:scroll-mt-34 xl:scroll-mt-22';

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
