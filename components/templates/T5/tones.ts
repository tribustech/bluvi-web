/**
 * The tinted icon square that fronts a KPI tile, an alert or a summary line (fish
 * features/bookings/ui/StatTile.tsx `IconSquare`: indigo / green / amber / rust), on the status
 * pairs so they follow the theme. `neutral` is the quiet fallback.
 *
 * One colour per meaning: `pending` (status-pending, the StatusPill `pending` pair and the
 * CountBadge) is «waiting for an answer» — the pending-requests alert; `amber` (status-warning) is
 * «money due» (the «Numerar» pill), never a request.
 */
export type T5Tone = 'indigo' | 'green' | 'amber' | 'pending' | 'red' | 'neutral';

export const TONE_SQUARE: Record<T5Tone, string> = {
  indigo: 'bg-accent-tint text-accent-ink',
  green: 'bg-status-success-bg text-status-success-fg',
  amber: 'bg-status-warning-bg text-status-warning-fg',
  pending: 'bg-status-pending-bg text-status-pending-fg',
  red: 'bg-status-danger-bg text-status-danger-fg',
  neutral: 'bg-status-neutral-bg text-status-neutral-fg',
};

/**
 * Tiles of the quick actions (fish OperatorQuickAction). One treatment for every tile of a row:
 * the tinted square, as the alert and the summary lines (TONE_SQUARE) — the accent pair for an
 * ordinary area, the status-danger pair for a blocking / destructive one (Blocaje). Never a filled
 * navy tile (navy + lavender is the signature number's CountTile alone) and never the live red,
 * which only ever means LIVE (Fundații).
 */
export type ActionTone = 'accent' | 'success' | 'danger';

export const ACTION_TILE: Record<ActionTone, string> = {
  accent: TONE_SQUARE.indigo,
  success: TONE_SQUARE.green,
  danger: TONE_SQUARE.red,
};

/**
 * The one icon tile of a T5 page (Fundații: 36px tiles, radius 10): the alert's square, a summary
 * line's badge and the shortcuts' tiles. The glyph is a 24px outline Heroicon at its own size
 * (§05: outlines are never scaled down). Pair it with a TONE_SQUARE or ACTION_TILE colour.
 */
const TILE = 'flex size-9 shrink-0 items-center justify-center rounded-control';
export const ICON_TILE = `${TILE} [&>svg]:size-6`;
/** The same tile around a 20px solid presence mark (§05: solid only for presence, at 20). */
export const ICON_TILE_SOLID = `${TILE} [&>svg]:size-5`;

/**
 * The one text-link action of a T5 page («Vezi», «Vezi toate», «Vezi toate (8 standuri)»): body
 * strong in the accent ink, a 44px hit area (WCAG 2.5.5) whatever the line height around it.
 * Inside a row whose height must not grow, add `-my-3` (44 − 20 = 2 × 12).
 */
export const LINK_ACTION_TEXT = 't-body-strong text-accent-ink hover:underline';
export const LINK_ACTION = `inline-flex min-h-11 shrink-0 items-center rounded-control ${LINK_ACTION_TEXT}`;

/**
 * One shortcut cell of the DashboardActions bar, shared with its skeleton (DashboardStates): equal
 * flex cells — tile over label on a phone, tile + label in a row from 768, centred in its share.
 */
export const BAR_CELL = 'flex flex-1 flex-col items-center justify-center gap-1.5 py-1 md:flex-row md:gap-2.5';

/**
 * The page-state cards (error, empty, signed out): 720px at most. From 768 the card starts at the
 * content edge, under the left-aligned page title — one axis per page, never a title at the
 * gutter over a card floating in the middle. Below 768 it fills the column.
 */
export const STATE_CARD = 'mx-auto w-full max-w-180 md:mx-0';
