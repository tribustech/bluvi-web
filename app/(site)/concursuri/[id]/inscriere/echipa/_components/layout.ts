import { T4_TITLE_INDENT } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';

/*
 * The disclaimer's geometry, shared by the screen and its skeleton so nothing moves when the data
 * lands. Phone: fish's single centred column. From 768 ONE axis with the header: the column starts
 * on the header's left edge (the cards on the gutter, as every T4 card), the two cards side by side
 * from 1024. From 1280 the column starts under the title text (T4_TITLE_INDENT, the 40px back
 * control + 16) and the frame's right column holds the competition's facts with «Am înțeles» docked
 * under them (T4Frame aside + actions) — the full shell width, no centred island.
 */

/** The reading column: art, intro, cards. */
export const COLUMN = cn('flex w-full flex-col items-center gap-4 md:items-start md:gap-5 lg:gap-6 xl:w-auto', T4_TITLE_INDENT);

/** The two cards: stacked on a phone and a tablet, side by side from 1024 (equal heights). */
export const CARDS = 'grid w-full gap-4 md:gap-5 lg:grid-cols-2';

/** The intro under the illustration: centred on a phone (fish), on the column's edge from 768, a reading measure. */
export const INTRO = 't-body max-w-120 text-center text-muted md:max-w-180 md:text-left';

/** The illustration (FishermanArt is 320×200 at most — fish's 200px Lottie): kept whole in the column. */
export const ART = 'shrink-0';

/**
 * fish DisclaimerItem: a white card with a 2px indigo outline — on a page whose only content is two
 * rules, the outline is what says «rules», not info. The accent token (dark mode follows).
 */
export const RULE_CARD_FRAME = 'flex h-full flex-col gap-4 rounded-card border-2 bg-surface p-4 md:p-5 xl:p-6';
export const RULE_CARD = cn(RULE_CARD_FRAME, 'border-accent');

/** fish's indigo square marker, as the card's accent-filled icon disc. */
export const RULE_DISC = 'flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent [&>svg]:size-6';
