import { UNDER_BAR_TOP } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';

/*
 * The inbox's one list layout, decided by the LIST's width (a size container), not the viewport's —
 * so the docked detail panel (≥1280, 420 wide) narrows the list without breaking it:
 *  - under 576 of list: fish's cards, one per row (the phone);
 *  - 576–767: the same cards, two per row (a tablet in portrait);
 *  - from 768: one surface of dense rows with a column head (owner: full-width tables on desktop) —
 *    Pescar · Stand · Perioadă · Sumă over Stare · ›;
 *  - from 1024: Sumă and Stare get their own columns, and the lists that owe a decision (De aprobat,
 *    De evaluat) get an «Acțiuni» column instead of a row of buttons under the card.
 * Every row lays its cells out with the same template (fixed side tracks), so the columns line up
 * from row to row and with the head. Plain strings (Tailwind must see each class whole).
 */

/** The list's size container. */
export const LIST_CONTAINER = '@container';

/** The list surface: nothing on the phone (each card is its own), one card with hairlines as a table. */
export const LIST_SURFACE = '@3xl:overflow-hidden @3xl:rounded-card @3xl:bg-surface @3xl:shadow-e0';

/** The items: a column of cards, two from 576, the table's rows (hairlines between) from 768. */
export const LIST_ITEMS =
  'flex flex-col gap-3 @xl:grid @xl:grid-cols-2 @xl:items-start @3xl:flex @3xl:items-stretch @3xl:gap-0 @3xl:divide-y @3xl:divide-hairline';

const CARD_AREAS = "[grid-template-areas:'av_name_price'_'av_stand_pill'_'av_period_period'_'note_note_note'_'reason_reason_reason'_'acts_acts_acts']";
const CARD_COLS = 'grid-cols-[auto_minmax(0,1fr)_auto]';
// Perioadă never narrower than one half of «Du 11 oct 00:50 →» / «Du 11 oct 12:50 · 12h» (its halves
// do not break, ./OperatorBookingRow PeriodText), so a date is never cut in two; name and stand give way.
const MID_COLS = '@3xl:grid-cols-[--spacing(10)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(--spacing(36),1.5fr)_--spacing(34)_--spacing(5)]';
const MID_AREAS =
  "@3xl:[grid-template-areas:'av_name_stand_period_price_end'_'av_name_stand_period_pill_end'_'._note_note_note_note_note'_'._reason_reason_reason_reason_reason'_'._acts_acts_acts_acts_acts']";
const WIDE_COLS_PLAIN = '@5xl:grid-cols-[--spacing(10)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(--spacing(36),1.6fr)_--spacing(26)_--spacing(40)_--spacing(5)]';
const WIDE_COLS_ACTIONS = '@5xl:grid-cols-[--spacing(10)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(--spacing(36),1.6fr)_--spacing(26)_--spacing(40)_--spacing(64)]';
const WIDE_AREAS_PLAIN =
  "@5xl:[grid-template-areas:'av_name_stand_period_price_pill_end'_'._note_note_note_note_note_.'_'._reason_reason_reason_reason_reason_.']";
const WIDE_AREAS_ACTIONS =
  "@5xl:[grid-template-areas:'av_name_stand_period_price_pill_acts'_'._note_note_note_note_note_.'_'._reason_reason_reason_reason_reason_.']";

/**
 * The grid template of one row (and of the head) — without `display` (add `grid` / `@3xl:grid`):
 * `withActions` = the list keeps buttons on its rows (c23).
 */
export function rowGrid(withActions: boolean) {
  return cn(
    'gap-x-3 @3xl:gap-x-4',
    CARD_COLS,
    CARD_AREAS,
    MID_COLS,
    MID_AREAS,
    withActions ? WIDE_COLS_ACTIONS : WIDE_COLS_PLAIN,
    withActions ? WIDE_AREAS_ACTIONS : WIDE_AREAS_PLAIN,
  );
}

/** Grid areas, by name (the items place themselves). */
export const AREA = {
  av: '[grid-area:av]',
  name: '[grid-area:name]',
  stand: '[grid-area:stand]',
  period: '[grid-area:period]',
  price: '[grid-area:price]',
  pill: '[grid-area:pill]',
  note: '[grid-area:note]',
  reason: '[grid-area:reason]',
  acts: '[grid-area:acts]',
  end: '[grid-area:end]',
} as const;

/** A card's / a row's own box: the phone card (fish BookingCard), then a table row from 768. */
export const ROW_BOX = 'p-4 @3xl:px-4 @3xl:py-3.5';

/**
 * The pinned chrome (c27, owner rule 3): the title row scrolls away, the bucket tabs and the sub
 * chips stay pinned under the top bar — and follow it to the top edge when the phone bar slides
 * away (UNDER_BAR_TOP), so the band never floats. Full bleed on the page ground at every width.
 */
export const CHROME = cn('sticky z-sticky -mx-4 bg-page px-4 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8', UNDER_BAR_TOP);

/**
 * The docked detail (≥1280, intent «context»): sticky beside the list, under the bar and the pinned
 * chrome (its height is LIST_CHROME_H_VAR), never taller than what is left of the viewport.
 * 360 wide under 1440 (420 from there): at 1280 with a classic 15px scrollbar the list keeps
 * 1265 − 64 − 24 − 360 = 817 ≥ 768, well clear of the table threshold — opening a row never flips
 * the list from the table to the card grid.
 */
export const DOCKED_PANEL = cn(
  'sticky self-start overflow-hidden rounded-card xl:w-[360px] min-[1440px]:w-[420px]',
  'xl:top-[calc(--spacing(20)_+_var(--list-chrome-h,0px)_+_var(--shell-banner-h,0px))]',
  'xl:max-h-[calc(100dvh_-_--spacing(26)_-_var(--list-chrome-h,0px)_-_var(--shell-banner-h,0px))]',
);
